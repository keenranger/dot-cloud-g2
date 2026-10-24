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
  /** Bytes queued by the platform but not yet transmitted, when the platform reports it. */
  readonly bufferedAmount?: number;
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
  | "no-audio"
  | "credential"
  | "aborted"
  | "timeout"
  | "connection"
  | "provider"
  | "protocol"
  | "overflow";

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
    get bufferedAmount() {
      return ws.bufferedAmount;
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

export interface SonioxStreamOptions extends SonioxClipOptions {
  /** Audio held while the socket connects; more than this fails the stream instead of dropping audio. */
  queueBytes?: number;
  /** Unsent socket bytes tolerated once open; a stalled network fails the stream instead of buffering forever. */
  maxBufferedBytes?: number;
  /** Deadline for `finished` once `end()` is called. */
  finishTimeoutMs?: number;
  /** Non-final running text for local display only; never a submission. */
  onPartial?: (text: string) => void;
}

/** One live Soniox session: audio is written while it is captured, then `end()` waits for the final tokens. */
export interface SonioxStream {
  /** Queues or sends one PCM16LE frame. Returns false once the stream is ended, failed or aborted. */
  write(pcm: Uint8Array): boolean;
  /** Sends end-of-audio once and resolves with the final text; repeated calls return the same promise. */
  end(): Promise<string>;
  /** Settles exactly once, whether or not `end()` was called. */
  readonly result: Promise<string>;
}

/**
 * Opens a bounded mono PCM16LE 16 kHz Korean real-time session. Audio written before the socket opens is held in a
 * bounded queue and flushed in order right after the start message. Every failure closes the socket, and nothing is
 * sent afterwards. There is no retry, since each opened session is billable.
 */
export function openSonioxStream(options: SonioxStreamOptions): SonioxStream {
  const {
    signal,
    createSocket = browserSocket,
    timeoutMs = 75_000,
    connectTimeoutMs = 10_000,
    queueBytes = 10 * SAMPLE_RATE * 2,
    maxBufferedBytes = 10 * SAMPLE_RATE * 2,
    finishTimeoutMs = 15_000,
    onPartial,
  } = options;
  const lookup = new AbortController();
  const finals: string[] = [];
  const seen = new Set<string>();
  let queue: Uint8Array[] = [];
  let queued = 0;
  let written = 0;
  let socket: SonioxSocket | undefined;
  let opened = false;
  let ending = false;
  let endSent = false;
  let connectTimer: ReturnType<typeof setTimeout> | undefined;
  let finishTimer: ReturnType<typeof setTimeout> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let done = false;
  let settle!: (failure?: SonioxTranscriptionError) => void;
  const result = new Promise<string>((resolve, reject) => {
    settle = (failure) => (failure ? reject(failure) : resolve(finals.join("").trim()));
  });

  const finish = (failure?: SonioxTranscriptionError) => {
    if (done) return;
    done = true;
    clearTimeout(deadline);
    clearTimeout(connectTimer);
    clearTimeout(finishTimer);
    signal?.removeEventListener("abort", onAbort);
    lookup.abort();
    queue = [];
    queued = 0;
    if (socket) {
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
      if (socket.readyState < CLOSING) socket.close(1000);
    }
    settle(failure);
  };
  const fail = (kind: SonioxFailure, status?: number) => finish(new SonioxTranscriptionError(kind, status));
  const onAbort = () => fail("aborted");

  const send = (data: string | Uint8Array) => {
    if (done) return false;
    // Once open, a socket that cannot take a frame is a failure, never a silent drop.
    if (!socket || socket.readyState !== OPEN) {
      fail("connection");
      return false;
    }
    try {
      socket.send(data);
    } catch {
      fail("connection");
      return false;
    }
    if ((socket.bufferedAmount ?? 0) > maxBufferedBytes) {
      fail("overflow");
      return false;
    }
    return true;
  };
  const sendAudio = (pcm: Uint8Array) => {
    for (let offset = 0; offset < pcm.byteLength; offset += CHUNK_BYTES)
      if (!send(pcm.subarray(offset, offset + CHUNK_BYTES))) return false;
    return true;
  };
  const sendEnd = () => {
    if (endSent) return;
    // Nothing was captured, which is not malformed audio: the microphone delivered no frames.
    if (written === 0) return fail("no-audio");
    endSent = true;
    // An empty text frame ends the stream; an empty binary frame would not.
    if (!send("")) return;
    finishTimer = setTimeout(() => fail("timeout"), finishTimeoutMs);
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
    let pending = "";
    if (Array.isArray(message.tokens)) {
      for (const token of message.tokens as SonioxToken[]) {
        if (typeof token?.text !== "string" || MARKERS.has(token.text)) continue;
        if (token.is_final !== true) {
          pending += token.text;
          continue;
        }
        // Final tokens are emitted once; drop an exact repeat of an already finalized token defensively.
        if (typeof token.start_ms === "number" && typeof token.end_ms === "number") {
          const key = `${token.start_ms}:${token.end_ms}:${token.text}`;
          if (seen.has(key)) continue;
          seen.add(key);
        }
        finals.push(token.text);
      }
    }
    // `finished` before our end-of-audio means the server dropped the session; its finals cover only part of the speech.
    if (message.finished === true) return endSent ? finish() : fail("protocol");
    if (onPartial && Array.isArray(message.tokens) && message.tokens.length) {
      try {
        onPartial((finals.join("") + pending).trim());
      } catch {
        // Display is best effort and must not affect the session.
      }
    }
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
      opened = true;
      const held = queue;
      queue = [];
      queued = 0;
      for (const pcm of held) if (!sendAudio(pcm)) return;
      if (ending) sendEnd();
    };
    socket.onmessage = receive;
    socket.onerror = () => fail("connection");
    socket.onclose = () => fail("connection");
  };

  if (signal?.aborted) fail("aborted");
  else {
    deadline = setTimeout(() => fail("timeout"), timeoutMs);
    signal?.addEventListener("abort", onAbort, { once: true });
    Promise.resolve()
      .then(() => options.credential(lookup.signal))
      .then(open, () => fail("credential"));
  }

  let ended: Promise<string> | undefined;
  return {
    result,
    write(pcm) {
      if (done || ending) return false;
      if (pcm.byteLength % 2 !== 0 || written + pcm.byteLength > MAX_CLIP_BYTES) {
        fail("invalid-audio");
        return false;
      }
      if (pcm.byteLength === 0) return true;
      written += pcm.byteLength;
      if (opened) return sendAudio(pcm);
      if (queued + pcm.byteLength > queueBytes) {
        fail("overflow");
        return false;
      }
      queue.push(pcm.slice()); // The SDK may reuse its input buffer.
      queued += pcm.byteLength;
      return true;
    },
    end() {
      if (!ended) {
        ending = true;
        if (opened) sendEnd();
        ended = result;
      }
      return ended;
    },
  };
}

/**
 * Transcribes one bounded mono PCM16LE 16 kHz Korean clip over the Soniox real-time WebSocket.
 * Resolves with the joined final tokens once Soniox reports `finished`.
 */
export function transcribeSonioxClip(pcm: Uint8Array, options: SonioxClipOptions): Promise<string> {
  if (pcm.byteLength === 0 || pcm.byteLength % 2 !== 0 || pcm.byteLength > MAX_CLIP_BYTES)
    return Promise.reject(new SonioxTranscriptionError("invalid-audio"));
  const { timeoutMs = 45_000 } = options;
  const stream = openSonioxStream({
    ...options,
    timeoutMs,
    queueBytes: MAX_CLIP_BYTES,
    maxBufferedBytes: Infinity,
    finishTimeoutMs: timeoutMs,
  });
  stream.write(pcm);
  return stream.end();
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
    case "no-audio":
      return "G2 마이크 오디오를 받지 못해 전사하지 않았습니다. 다시 길게 눌러 말하세요.";
    case "protocol":
      return "Soniox 응답을 해석하지 못했습니다. 다시 시도하세요.";
    case "aborted":
      return "음성 전사를 취소했습니다.";
    case "overflow":
      return "Soniox 전송이 녹음 속도를 따라가지 못해 중단했습니다. 네트워크를 확인하고 다시 시도하세요.";
  }
}
