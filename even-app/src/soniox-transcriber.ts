import { MAX_RECORDING_SECONDS, SAMPLE_RATE } from "./audio.ts";

export const SONIOX_URL = "wss://stt-rt.soniox.com/transcribe-websocket";
export const SONIOX_MODEL = "stt-rt-v5";
export const MAX_CLIP_BYTES = MAX_RECORDING_SECONDS * SAMPLE_RATE * 2;
const CHUNK_BYTES = SAMPLE_RATE * 2;
const OPEN = 1;
const CLOSING = 2;
// RFC 6455 subprotocol values must be RFC 7230 tokens; anything else makes the browser throw with the value in the message.
const TOKEN = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/;
const MARKERS = new Set(["<end>", "<fin>"]);

/** Minimal socket boundary so tests never touch the network and the browser adapter stays trivial. */
export interface SonioxSocket {
  readonly readyState: number;
  send(data: string | Uint8Array): void;
  close(code?: number): void;
  onopen: (() => void) | null;
  onmessage: ((data: unknown) => void) | null;
  onerror: (() => void) | null;
  onclose: (() => void) | null;
}

export type SonioxSocketFactory = (url: string, protocols: string[]) => SonioxSocket;

export type SonioxFailure =
  | "invalid-audio"
  | "credential"
  | "aborted"
  | "timeout"
  | "connection"
  | "provider"
  | "protocol";

/** Messages are fixed per kind: never the key, the provider's error text or a response payload. */
export class SonioxTranscriptionError extends Error {
  readonly kind: SonioxFailure;
  readonly status: number | undefined;

  constructor(kind: SonioxFailure, status?: number) {
    super(
      status === undefined ? `Soniox transcription failed: ${kind}` : `Soniox transcription failed: ${kind} ${status}`,
    );
    this.name = "SonioxTranscriptionError";
    this.kind = kind;
    this.status = status;
  }
}

export interface SonioxClipOptions {
  /** Returns the key (or temporary key) for this one call; it is not retained after the socket opens. */
  credential: (signal: AbortSignal) => string | Promise<string>;
  signal?: AbortSignal;
  createSocket?: SonioxSocketFactory;
  /** Whole-call deadline, including credential lookup and waiting for `finished`. */
  timeoutMs?: number;
  connectTimeoutMs?: number;
}

export const browserSocket: SonioxSocketFactory = (url, protocols) => {
  const ws = new WebSocket(url, protocols);
  const socket: SonioxSocket = {
    get readyState() {
      return ws.readyState;
    },
    send: (data) => ws.send(data),
    close: (code) => ws.close(code),
    onopen: null,
    onmessage: null,
    onerror: null,
    onclose: null,
  };
  ws.onopen = () => socket.onopen?.();
  ws.onmessage = (event) => socket.onmessage?.(event.data);
  ws.onerror = () => socket.onerror?.();
  ws.onclose = () => socket.onclose?.();
  return socket;
};

interface SonioxToken {
  text?: unknown;
  is_final?: unknown;
  start_ms?: unknown;
  end_ms?: unknown;
}

/**
 * Transcribes one bounded mono PCM16LE 16 kHz Korean clip over the Soniox real-time WebSocket.
 * Resolves with the joined final tokens once Soniox reports `finished`; every failure closes the socket
 * and nothing is sent afterwards. There is no retry, since each opened session is billable.
 */
export function transcribeSonioxClip(pcm: Uint8Array, options: SonioxClipOptions): Promise<string> {
  if (pcm.byteLength === 0 || pcm.byteLength % 2 !== 0 || pcm.byteLength > MAX_CLIP_BYTES)
    return Promise.reject(new SonioxTranscriptionError("invalid-audio"));
  const { signal, createSocket = browserSocket, timeoutMs = 45_000, connectTimeoutMs = 10_000 } = options;
  if (signal?.aborted) return Promise.reject(new SonioxTranscriptionError("aborted"));

  return new Promise<string>((resolve, reject) => {
    const lookup = new AbortController();
    const finals: string[] = [];
    const seen = new Set<string>();
    let socket: SonioxSocket | undefined;
    let connectTimer: ReturnType<typeof setTimeout> | undefined;
    let done = false;

    const finish = (failure?: SonioxTranscriptionError) => {
      if (done) return;
      done = true;
      clearTimeout(deadline);
      clearTimeout(connectTimer);
      signal?.removeEventListener("abort", onAbort);
      lookup.abort();
      if (socket) {
        socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
        if (socket.readyState < CLOSING) socket.close(1000);
      }
      if (failure) reject(failure);
      else resolve(finals.join("").trim());
    };
    const fail = (kind: SonioxFailure, status?: number) => finish(new SonioxTranscriptionError(kind, status));
    const onAbort = () => fail("aborted");
    const deadline = setTimeout(() => fail("timeout"), timeoutMs);
    signal?.addEventListener("abort", onAbort, { once: true });

    const send = (data: string | Uint8Array) => {
      if (done || !socket || socket.readyState !== OPEN) return false;
      try {
        socket.send(data);
        return true;
      } catch {
        fail("connection");
        return false;
      }
    };

    const receive = (data: unknown) => {
      if (done) return;
      if (typeof data !== "string") return fail("protocol");
      let message: { tokens?: unknown; finished?: unknown; error_code?: unknown; error_type?: unknown };
      try {
        message = JSON.parse(data);
      } catch {
        return fail("protocol");
      }
      if (typeof message !== "object" || message === null) return fail("protocol");
      if (message.error_code !== undefined || message.error_type !== undefined)
        return fail("provider", Number.isInteger(message.error_code) ? (message.error_code as number) : undefined);
      if (Array.isArray(message.tokens)) {
        for (const token of message.tokens as SonioxToken[]) {
          if (token?.is_final !== true || typeof token.text !== "string" || MARKERS.has(token.text)) continue;
          // Final tokens are emitted once; drop an exact repeat of an already finalized token defensively.
          if (typeof token.start_ms === "number" && typeof token.end_ms === "number") {
            const key = `${token.start_ms}:${token.end_ms}:${token.text}`;
            if (seen.has(key)) continue;
            seen.add(key);
          }
          finals.push(token.text);
        }
      }
      if (message.finished === true) finish();
    };

    const open = (key: unknown) => {
      if (done) return;
      if (typeof key !== "string" || !TOKEN.test(key)) return fail("credential");
      try {
        socket = createSocket(SONIOX_URL, ["soniox-api-key", key]);
      } catch {
        return fail("connection");
      }
      connectTimer = setTimeout(() => fail("timeout"), connectTimeoutMs);
      socket.onopen = () => {
        clearTimeout(connectTimer);
        const config = {
          model: SONIOX_MODEL,
          audio_format: "pcm_s16le",
          sample_rate: SAMPLE_RATE,
          num_channels: 1,
          language_hints: ["ko"],
        };
        if (!send(JSON.stringify(config))) return;
        for (let offset = 0; offset < pcm.byteLength; offset += CHUNK_BYTES)
          if (!send(pcm.subarray(offset, offset + CHUNK_BYTES))) return;
        // An empty text frame ends the stream; an empty binary frame would not.
        send("");
      };
      socket.onmessage = receive;
      socket.onerror = () => fail("connection");
      socket.onclose = () => fail("connection");
    };

    Promise.resolve()
      .then(() => options.credential(lookup.signal))
      .then(open, () => fail("credential"));
  });
}

/** User-facing notice built only from the failure kind and numeric code, never provider text. */
export function sttMessage(error: SonioxTranscriptionError): string {
  switch (error.kind) {
    case "credential":
      return "Soniox 키를 사용할 수 없습니다. 설정에서 키를 다시 입력하세요.";
    case "provider":
      return error.status === 401 || error.status === 403
        ? "Soniox가 키를 거부했습니다. 키 권한과 상태를 확인하거나 새 키로 교체하세요."
        : `Soniox 전사에 실패했습니다${error.status === undefined ? "" : ` (코드 ${error.status})`}. 다시 시도하세요.`;
    case "timeout":
      return "Soniox 응답 시간이 초과되었습니다. 다시 시도하세요.";
    case "connection":
      return "Soniox에 연결하지 못했습니다. 네트워크를 확인하고 다시 시도하세요.";
    case "invalid-audio":
      return "녹음 데이터 형식이 올바르지 않습니다.";
    case "protocol":
      return "Soniox 응답을 해석하지 못했습니다. 다시 시도하세요.";
    case "aborted":
      return "음성 전사를 취소했습니다.";
  }
}
