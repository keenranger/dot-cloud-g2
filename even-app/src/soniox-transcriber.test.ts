import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_CLIP_BYTES,
  SonioxTranscriptionError,
  openSonioxStream,
  sttMessage,
  transcribeSonioxClip,
  type SonioxSocket,
  type SonioxSocketFactory,
} from "./soniox-transcriber.ts";

const KEY = "snx_test_key_0123456789";

class FakeSocket implements SonioxSocket {
  readyState = 0;
  bufferedAmount = 0;
  sent: (string | Uint8Array)[] = [];
  closes = 0;
  onopen: (() => void) | null = null;
  onmessage: ((data: unknown) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  send(data: string | Uint8Array) {
    if (this.readyState !== 1) throw new Error("not open");
    this.sent.push(data);
  }
  close() {
    this.closes++;
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  reply(message: unknown) {
    this.onmessage?.(typeof message === "string" ? message : JSON.stringify(message));
  }
}

function harness() {
  const calls: { url: string; protocols: string[]; socket: FakeSocket }[] = [];
  const createSocket: SonioxSocketFactory = (url, protocols) => {
    const socket = new FakeSocket();
    calls.push({ url, protocols, socket });
    return socket;
  };
  return { calls, createSocket };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));
const clip = (bytes: number) => new Uint8Array(bytes).map((_, i) => i & 0xff);

function assertKeyAbsent(error: unknown) {
  assert.ok(error instanceof SonioxTranscriptionError);
  assert.ok(!error.message.includes(KEY));
  assert.ok(!String(error.stack).includes(KEY));
  assert.ok(!JSON.stringify(error).includes(KEY));
}

test("connects only to the Soniox endpoint with subprotocol auth and streams config, audio, end frame", async () => {
  const { calls, createSocket } = harness();
  const audio = clip(32_000 * 2 + 100);
  const result = transcribeSonioxClip(audio, { credential: () => KEY, createSocket });
  await tick();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "wss://stt-rt.soniox.com/transcribe-websocket");
  assert.deepEqual(calls[0].protocols, ["soniox-api-key", KEY]);
  const socket = calls[0].socket;
  socket.open();
  const [config, ...rest] = socket.sent;
  assert.deepEqual(JSON.parse(config as string), {
    model: "stt-rt-v5",
    audio_format: "pcm_s16le",
    sample_rate: 16_000,
    num_channels: 1,
    language_hints: ["ko"],
  });
  assert.ok(!(config as string).includes(KEY), "key must not be repeated in the start message");
  assert.equal(rest.at(-1), "");
  const frames = rest.slice(0, -1) as Uint8Array[];
  assert.ok(frames.every((frame) => frame instanceof Uint8Array && frame.byteLength > 0));
  assert.deepEqual(Buffer.concat(frames), Buffer.from(audio));
  socket.reply({ tokens: [], finished: true });
  assert.equal(await result, "");
  assert.equal(socket.closes, 1);
});

test("joins only final tokens, ignores markers and finalized duplicates", async () => {
  const { calls, createSocket } = harness();
  const result = transcribeSonioxClip(clip(3200), { credential: async () => KEY, createSocket });
  await tick();
  const socket = calls[0].socket;
  socket.open();
  socket.reply({ tokens: [{ text: "안녕", is_final: false, start_ms: 0, end_ms: 200 }] });
  socket.reply({
    tokens: [
      { text: "안녕", is_final: true, start_ms: 0, end_ms: 200 },
      { text: "하세요", is_final: true, start_ms: 200, end_ms: 500 },
      { text: " 내일", is_final: false, start_ms: 600, end_ms: 800 },
    ],
  });
  socket.reply({
    tokens: [
      { text: "하세요", is_final: true, start_ms: 200, end_ms: 500 },
      { text: " 내일", is_final: true, start_ms: 600, end_ms: 800 },
      { text: "<end>", is_final: true },
      { text: "<fin>", is_final: true },
    ],
  });
  socket.reply({ tokens: [], finished: true });
  assert.equal(await result, "안녕하세요 내일");
  socket.reply({ tokens: [{ text: " 늦음", is_final: true, start_ms: 900, end_ms: 950 }], finished: true });
});

test("rejects unbounded or malformed audio before fetching a credential or opening a socket", async () => {
  const { calls, createSocket } = harness();
  let lookups = 0;
  const credential = () => {
    lookups++;
    return KEY;
  };
  for (const audio of [new Uint8Array(0), new Uint8Array(3), new Uint8Array(MAX_CLIP_BYTES + 2)])
    await assert.rejects(transcribeSonioxClip(audio, { credential, createSocket }), { kind: "invalid-audio" });
  assert.equal(MAX_CLIP_BYTES, 30 * 16_000 * 2);
  assert.equal(lookups, 0);
  assert.equal(calls.length, 0);
});

test("provider errors expose only the numeric code, never the provider body or key", async () => {
  const { calls, createSocket } = harness();
  const result = transcribeSonioxClip(clip(3200), { credential: () => KEY, createSocket });
  await tick();
  const socket = calls[0].socket;
  socket.open();
  socket.reply({ error_code: 401, error_type: "unauthenticated", error_message: `Invalid key ${KEY}` });
  const error = await result.catch((e: unknown) => e);
  assert.ok(error instanceof SonioxTranscriptionError);
  assert.equal(error.kind, "provider");
  assert.equal(error.status, 401);
  assert.ok(!error.message.includes("Invalid") && !error.message.includes("unauthenticated"));
  assertKeyAbsent(error);
  assert.equal(socket.closes, 1);
});

test("credential failures and unusable keys never echo the key or open a socket", async () => {
  const { calls, createSocket } = harness();
  const thrown = await transcribeSonioxClip(clip(2), {
    credential: () => {
      throw new Error(`vault said ${KEY}`);
    },
    createSocket,
  }).catch((e: unknown) => e);
  assert.equal((thrown as SonioxTranscriptionError).kind, "credential");
  assertKeyAbsent(thrown);
  for (const bad of ["", `${KEY} extra`, `${KEY},x`, 42])
    await assert.rejects(transcribeSonioxClip(clip(2), { credential: () => bad as string, createSocket }), {
      kind: "credential",
    });
  assert.equal(calls.length, 0);
  const factoryError = await transcribeSonioxClip(clip(2), {
    credential: () => KEY,
    createSocket: () => {
      throw new SyntaxError(`The subprotocol '${KEY}' is invalid`);
    },
  }).catch((e: unknown) => e);
  assert.equal((factoryError as SonioxTranscriptionError).kind, "connection");
  assertKeyAbsent(factoryError);
});

test("abort closes the socket and nothing is sent afterwards", async () => {
  const { calls, createSocket } = harness();
  const controller = new AbortController();
  const result = transcribeSonioxClip(clip(3200), { credential: () => KEY, createSocket, signal: controller.signal });
  await tick();
  const socket = calls[0].socket;
  controller.abort();
  await assert.rejects(result, { kind: "aborted" });
  assert.equal(socket.closes, 1);
  assert.equal(socket.onopen, null);
  socket.readyState = 1;
  // A late open event from the platform must not resume streaming; the handler was detached above.
  (socket.onopen as (() => void) | null)?.();
  assert.equal(socket.sent.length, 0);
});

test("abort during credential lookup cancels it and never opens a socket", async () => {
  const { calls, createSocket } = harness();
  const controller = new AbortController();
  let lookupSignal: AbortSignal | undefined;
  let release: (key: string) => void = () => {};
  const result = transcribeSonioxClip(clip(2), {
    credential: (signal) => {
      lookupSignal = signal;
      return new Promise<string>((resolve) => (release = resolve));
    },
    createSocket,
    signal: controller.signal,
  });
  await tick();
  controller.abort();
  await assert.rejects(result, { kind: "aborted" });
  assert.equal(lookupSignal?.aborted, true);
  release(KEY);
  await tick();
  assert.equal(calls.length, 0);
  await assert.rejects(
    transcribeSonioxClip(clip(2), { credential: () => KEY, createSocket, signal: AbortSignal.abort() }),
    { kind: "aborted" },
  );
});

test("missing finished times out once, closes the socket and does not retry", async () => {
  const { calls, createSocket } = harness();
  const result = transcribeSonioxClip(clip(3200), { credential: () => KEY, createSocket, timeoutMs: 30 });
  await tick();
  const socket = calls[0].socket;
  socket.open();
  socket.reply({ tokens: [{ text: "부분", is_final: true, start_ms: 0, end_ms: 100 }] });
  const sentBefore = socket.sent.length;
  await assert.rejects(result, { kind: "timeout" });
  assert.equal(socket.closes, 1);
  assert.equal(socket.sent.length, sentBefore);
  assert.equal(calls.length, 1);
});

test("connect timeout and unexpected close fail without retrying", async () => {
  const slow = harness();
  await assert.rejects(
    transcribeSonioxClip(clip(2), { credential: () => KEY, createSocket: slow.createSocket, connectTimeoutMs: 10 }),
    { kind: "timeout" },
  );
  assert.equal(slow.calls.length, 1);
  assert.equal(slow.calls[0].socket.closes, 1);

  const dropped = harness();
  const result = transcribeSonioxClip(clip(2), { credential: () => KEY, createSocket: dropped.createSocket });
  await tick();
  const socket = dropped.calls[0].socket;
  socket.open();
  socket.readyState = 3;
  socket.onclose?.();
  await assert.rejects(result, { kind: "connection" });
  assert.equal(dropped.calls.length, 1);
});

test("malformed or binary server frames fail as protocol errors without echoing the payload", async () => {
  for (const frame of ["{not json", new Uint8Array([1])]) {
    const { calls, createSocket } = harness();
    const result = transcribeSonioxClip(clip(2), { credential: () => KEY, createSocket });
    await tick();
    calls[0].socket.open();
    calls[0].socket.onmessage?.(frame);
    const error = await result.catch((e: unknown) => e);
    assert.equal((error as SonioxTranscriptionError).kind, "protocol");
    assert.ok(!(error as Error).message.includes("not json"));
    assert.equal(calls[0].socket.closes, 1);
  }
});

test("never writes to the console", async () => {
  const methods = ["log", "info", "warn", "error", "debug"] as const;
  const originals = methods.map((m) => console[m]);
  const written: unknown[] = [];
  for (const m of methods) console[m] = (...args: unknown[]) => void written.push(args);
  try {
    const { calls, createSocket } = harness();
    const ok = transcribeSonioxClip(clip(2), { credential: () => KEY, createSocket });
    await tick();
    calls[0].socket.open();
    calls[0].socket.reply({ error_code: 500, error_message: KEY });
    await ok.catch(() => undefined);
    await transcribeSonioxClip(clip(2), {
      credential: () => {
        throw new Error(KEY);
      },
      createSocket,
    }).catch(() => undefined);
  } finally {
    methods.forEach((m, i) => (console[m] = originals[i]));
  }
  assert.deepEqual(written, []);
});

test("user notices are fixed per failure kind and carry at most the numeric provider code", () => {
  const kinds = [
    "invalid-audio",
    "credential",
    "aborted",
    "timeout",
    "connection",
    "provider",
    "protocol",
    "overflow",
  ] as const;
  const notices = kinds.map((kind) => sttMessage(new SonioxTranscriptionError(kind)));
  assert.equal(new Set(notices).size, kinds.length);
  assert.match(sttMessage(new SonioxTranscriptionError("provider", 401)), /키/);
  assert.match(sttMessage(new SonioxTranscriptionError("provider", 503)), /503/);
  for (const notice of notices) assert.ok(!notice.includes(KEY));
});

const audioFrames = (socket: FakeSocket) => socket.sent.filter((f): f is Uint8Array => f instanceof Uint8Array);

test("live stream holds audio while connecting, then sends each frame as it is written, before end", async () => {
  const { calls, createSocket } = harness();
  const stream = openSonioxStream({ credential: () => KEY, createSocket });
  const early = clip(640);
  assert.equal(stream.write(early), true);
  // Callers may reuse or mutate their buffer; the held preroll must keep the original bytes.
  const expected = Buffer.from(early);
  early.fill(0);
  await tick();
  const socket = calls[0].socket;
  assert.equal(socket.sent.length, 0, "nothing is sent before the socket opens");
  socket.open();
  assert.equal(JSON.parse(socket.sent[0] as string).model, "stt-rt-v5");
  assert.deepEqual(Buffer.concat(audioFrames(socket)), expected);
  const live = clip(320);
  assert.equal(stream.write(live), true);
  assert.equal(audioFrames(socket).length, 2, "a frame written after open is sent immediately, not at stop");
  assert.ok(!socket.sent.includes(""), "end-of-audio is not sent until end()");
  socket.reply({ tokens: [{ text: "안녕", is_final: true, start_ms: 0, end_ms: 100 }] });
  const ended = stream.end();
  assert.equal(stream.end(), ended, "end is idempotent");
  assert.equal(stream.write(clip(2)), false, "audio after end is refused");
  assert.equal(socket.sent.filter((f) => f === "").length, 1, "end-of-audio is sent exactly once");
  socket.reply({ tokens: [], finished: true });
  assert.equal(await ended, "안녕");
  assert.equal(await stream.result, "안녕");
});

test("end before the socket opens flushes held audio, then sends end-of-audio once", async () => {
  const { calls, createSocket } = harness();
  const stream = openSonioxStream({ credential: () => KEY, createSocket });
  stream.write(clip(640));
  const ended = stream.end();
  stream.end();
  await tick();
  const socket = calls[0].socket;
  socket.open();
  assert.deepEqual(
    socket.sent.slice(1).map((f) => (f instanceof Uint8Array ? "audio" : f)),
    ["audio", ""],
  );
  socket.reply({ tokens: [], finished: true });
  assert.equal(await ended, "");
});

test("the connecting queue is bounded: overflow fails loudly instead of dropping audio", async () => {
  const { calls, createSocket } = harness();
  const stream = openSonioxStream({ credential: () => KEY, createSocket, queueBytes: 1000 });
  assert.equal(stream.write(clip(640)), true);
  assert.equal(stream.write(clip(640)), false);
  await assert.rejects(stream.result, { kind: "overflow" });
  await tick();
  assert.equal(calls.length, 0, "a failed stream never opens a billable socket");
  assert.equal(stream.write(clip(2)), false);
});

test("a socket that stops draining fails as overflow instead of buffering without limit", async () => {
  const { calls, createSocket } = harness();
  const stream = openSonioxStream({ credential: () => KEY, createSocket, maxBufferedBytes: 1000 });
  await tick();
  const socket = calls[0].socket;
  socket.open();
  assert.equal(stream.write(clip(640)), true);
  socket.bufferedAmount = 2000;
  assert.equal(stream.write(clip(640)), false);
  await assert.rejects(stream.end(), { kind: "overflow" });
  assert.equal(socket.closes, 1);
});

test("abort mid-stream closes the socket; later frames and end send nothing", async () => {
  const { calls, createSocket } = harness();
  const controller = new AbortController();
  const stream = openSonioxStream({ credential: () => KEY, createSocket, signal: controller.signal });
  await tick();
  const socket = calls[0].socket;
  socket.open();
  stream.write(clip(640));
  const before = socket.sent.length;
  controller.abort();
  await assert.rejects(stream.result, { kind: "aborted" });
  socket.readyState = 1;
  assert.equal(stream.write(clip(640)), false);
  await assert.rejects(stream.end(), { kind: "aborted" });
  assert.equal(socket.sent.length, before);
  assert.equal(socket.closes, 1);
  assert.equal(socket.onmessage, null);
});

test("partial text is reported for display only and never resolves the stream", async () => {
  const { calls, createSocket } = harness();
  const partials: string[] = [];
  const stream = openSonioxStream({ credential: () => KEY, createSocket, onPartial: (t) => void partials.push(t) });
  let settled = false;
  void stream.result.then(() => (settled = true));
  await tick();
  const socket = calls[0].socket;
  socket.open();
  stream.write(clip(640));
  socket.reply({
    tokens: [
      { text: "내일", is_final: true, start_ms: 0, end_ms: 100 },
      { text: " 회", is_final: false, start_ms: 100, end_ms: 200 },
    ],
  });
  socket.reply({ tokens: [{ text: " 회의", is_final: false, start_ms: 100, end_ms: 300 }] });
  await tick();
  assert.deepEqual(partials, ["내일 회", "내일 회의"]);
  assert.equal(settled, false, "only finished settles the stream");
  const ended = stream.end();
  socket.reply({ tokens: [{ text: " 회의", is_final: true, start_ms: 100, end_ms: 300 }] });
  socket.reply({ tokens: [], finished: true });
  assert.equal(await ended, "내일 회의");
});

test("end with no audio fails without waiting, and a missing finished after end times out once", async () => {
  const empty = harness();
  const stream = openSonioxStream({ credential: () => KEY, createSocket: empty.createSocket });
  await tick();
  empty.calls[0].socket.open();
  await assert.rejects(stream.end(), { kind: "invalid-audio" });
  assert.ok(!empty.calls[0].socket.sent.includes(""));

  const slow = harness();
  const late = openSonioxStream({ credential: () => KEY, createSocket: slow.createSocket, finishTimeoutMs: 20 });
  await tick();
  slow.calls[0].socket.open();
  late.write(clip(640));
  await assert.rejects(late.end(), { kind: "timeout" });
  assert.equal(slow.calls.length, 1);
});

test("finished before end-of-audio is a protocol failure, never a truncated transcript", async () => {
  const { calls, createSocket } = harness();
  const stream = openSonioxStream({ credential: () => KEY, createSocket });
  await tick();
  const socket = calls[0].socket;
  socket.open();
  stream.write(clip(640));
  socket.reply({ tokens: [{ text: "앞부분", is_final: true, start_ms: 0, end_ms: 100 }] });
  socket.reply({ tokens: [], finished: true });
  await assert.rejects(stream.result, { kind: "protocol" });
  await assert.rejects(stream.end(), { kind: "protocol" });
  assert.ok(!socket.sent.includes(""));
  assert.equal(stream.write(clip(2)), false);
  assert.equal(socket.closes, 1);
});
