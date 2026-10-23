import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  openSonioxStream,
  transcribeSonioxClip,
  type SonioxSocket,
  type SonioxSocketFactory,
} from "./soniox-transcriber.ts";
import { completeVoice, utteranceBody } from "./voice-flow.ts";
import { wavPcm } from "./audio.ts";
import { wav } from "./protocol.ts";

// Sentinels: neither the key nor any recognizable run of the audio may reach the relay.
const KEY = "snx_relay_sentinel_key_000111222";
const PCM = new Uint8Array(Array.from("PCMSENTINEL_".repeat(400), (c) => c.charCodeAt(0)));
const ID = "0b0c4a52-7e0f-4c38-9a8e-5f2b1d3c4e5f";

class FakeSocket implements SonioxSocket {
  readyState = 0;
  sent: (string | Uint8Array)[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((data: unknown) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  send(data: string | Uint8Array) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
  }
}

type Script = (socket: FakeSocket) => void;
const finals =
  (text: string): Script =>
  (socket) => {
    socket.onmessage?.(JSON.stringify({ tokens: [{ text, is_final: true, start_ms: 0, end_ms: 10 }] }));
    socket.onmessage?.(JSON.stringify({ tokens: [], finished: true }));
  };

async function run(
  script: Script,
  options: { automatic?: boolean; current?: () => boolean; signal?: AbortSignal; relayFails?: boolean } = {},
) {
  const relay: { path: string; body: string }[] = [];
  const sockets: { url: string; protocols: string[]; socket: FakeSocket }[] = [];
  const createSocket: SonioxSocketFactory = (url, protocols) => {
    const socket = new FakeSocket();
    sockets.push({ url, protocols, socket });
    setImmediate(() => {
      socket.readyState = 1;
      socket.onopen?.();
      script(socket);
    });
    return socket;
  };
  const reviewed: string[] = [];
  // Mirrors main.ts: the clip arrives as WAV, is stripped to PCM, transcribed directly, then only text is posted.
  const error = await completeVoice({
    transcribe: () =>
      transcribeSonioxClip(wavPcm(wav([PCM])), {
        credential: () => KEY,
        createSocket,
        timeoutMs: 50,
        ...(options.signal ? { signal: options.signal } : {}),
      }),
    current: options.current ?? (() => true),
    automatic: () => options.automatic ?? true,
    review: (text) => void reviewed.push(text),
    send: async (text) => {
      const body = utteranceBody(ID, text);
      relay.push({ path: "/api/device/utterances", body });
      if (options.relayFails) throw new Error("서버 요청 실패 (500)");
    },
  }).then(
    () => undefined,
    (e: unknown) => e,
  );
  return { relay, sockets, reviewed, error };
}

function assertClean(result: Awaited<ReturnType<typeof run>>) {
  const pcmText = new TextDecoder().decode(PCM);
  for (const { body } of result.relay) {
    assert.ok(!body.includes(KEY), "key reached the relay");
    assert.ok(!body.includes("PCMSENTINEL"), "audio reached the relay");
    assert.ok(!body.includes(Buffer.from(PCM).toString("base64").slice(0, 32)), "encoded audio reached the relay");
    assert.deepEqual(Object.keys(JSON.parse(body)).sort(), ["id", "text"]);
  }
  if (result.error !== undefined) {
    const error = result.error as Error;
    assert.ok(!String(error.message).includes(KEY) && !String(error.stack).includes(KEY));
    assert.ok(!String(error.message).includes(pcmText.slice(0, 11)));
  }
}

test("audio and key go only to Soniox; the relay receives one text body with the stable id", async () => {
  const result = await run(finals("내일 일정 알려줘"));
  assert.equal(result.error, undefined);
  assert.equal(result.sockets.length, 1);
  assert.equal(result.sockets[0].url, "wss://stt-rt.soniox.com/transcribe-websocket");
  assert.deepEqual(result.sockets[0].protocols, ["soniox-api-key", KEY]);
  const audio = Buffer.concat(result.sockets[0].socket.sent.filter((f): f is Uint8Array => f instanceof Uint8Array));
  assert.deepEqual(audio, Buffer.from(PCM), "WAV header stripped exactly, PCM streamed unchanged");
  assert.deepEqual(result.relay, [
    { path: "/api/device/utterances", body: JSON.stringify({ id: ID, text: "내일 일정 알려줘" }) },
  ]);
  assertClean(result);
});

test("review mode never posts; the transcript waits for an explicit send", async () => {
  const result = await run(finals("검토할 내용"), { automatic: false });
  assert.deepEqual(result.reviewed, ["검토할 내용"]);
  assert.equal(result.relay.length, 0);
});

test("every failure path posts nothing to the relay and leaks neither key nor audio", async () => {
  const echoKey: Script = (socket) =>
    socket.onmessage?.(JSON.stringify({ error_code: 401, error_message: `bad key ${KEY}` }));
  const drop: Script = (socket) => {
    socket.readyState = 3;
    socket.onclose?.();
  };
  const scripts: [string, Script, Parameters<typeof run>[1]?][] = [
    ["provider error", echoKey],
    ["connection drop", drop],
    ["protocol garbage", (socket) => socket.onmessage?.(`{"raw":"${KEY}`)],
    ["timeout", () => {}],
    ["empty transcript", finals("   ")],
    ["stale after transcription", finals("늦은 결과"), { current: () => false }],
    ["aborted", () => {}, { signal: AbortSignal.timeout(5) }],
  ];
  for (const [name, script, options] of scripts) {
    const result = await run(script, options);
    assert.equal(result.relay.length, 0, name);
    if (name !== "stale after transcription") assert.ok(result.error instanceof Error, name);
    assertClean(result);
  }
});

test("a relay failure after transcription surfaces without the key and posts only text", async () => {
  const result = await run(finals("전송 실패"), { relayFails: true });
  assert.equal(result.relay.length, 1);
  assert.ok(result.error instanceof Error);
  assertClean(result);
});

test("the companion no longer uploads audio to the relay", () => {
  const main = readFileSync(new URL("main.ts", import.meta.url), "utf8");
  assert.ok(!main.includes("/api/device/transcribe"));
  assert.ok(!main.includes("audio/wav"));
  // Every authenticated POST body is the text-only utterance body.
  const posts = [...main.matchAll(/request<[^>]+>\(([^;]+?)\);/gs)]
    .map((m) => m[1])
    .filter((a) => a.includes('"POST"'));
  assert.ok(posts.length > 0);
  for (const args of posts) assert.match(args, /"POST", utteranceBody\(id, text\)$/);
});

test("live voice: frames reach Soniox while recording, release finalizes once and submits one text body", async () => {
  const sockets: FakeSocket[] = [];
  const createSocket: SonioxSocketFactory = () => {
    const socket = new FakeSocket();
    sockets.push(socket);
    return socket;
  };
  const relay: string[] = [];
  const partials: string[] = [];
  // Mirrors main.ts: the stream opens at record start, frames are written as the SDK delivers them.
  const stream = openSonioxStream({ credential: () => KEY, createSocket, onPartial: (t) => void partials.push(t) });
  stream.write(PCM.subarray(0, 640));
  await new Promise((resolve) => setImmediate(resolve));
  const socket = sockets[0];
  socket.readyState = 1;
  socket.onopen?.();
  stream.write(PCM.subarray(640, 1280));
  const beforeStop = socket.sent.filter((f) => f instanceof Uint8Array).length;
  assert.equal(beforeStop, 2, "audio is streamed before the user releases");
  socket.onmessage?.(JSON.stringify({ tokens: [{ text: "회의", is_final: false, start_ms: 0, end_ms: 10 }] }));
  assert.equal(relay.length, 0, "a partial transcript never submits");
  const work = completeVoice({
    transcribe: () => stream.end(),
    current: () => true,
    automatic: () => true,
    review: () => {},
    send: async (text) => void relay.push(utteranceBody(ID, text)),
  });
  socket.onmessage?.(JSON.stringify({ tokens: [{ text: "회의 3시", is_final: true, start_ms: 0, end_ms: 10 }] }));
  socket.onmessage?.(JSON.stringify({ tokens: [], finished: true }));
  socket.onmessage?.(JSON.stringify({ tokens: [], finished: true }));
  await work;
  await stream.end();
  assert.deepEqual(partials, ["회의", "회의 3시"], "running display text only; never a submission");
  assert.deepEqual(relay, [JSON.stringify({ id: ID, text: "회의 3시" })]);
  assert.equal(socket.sent.filter((f) => f === "").length, 1);
  for (const body of relay) assert.ok(!body.includes(KEY) && !body.includes("PCMSENTINEL"));
});

test("live voice aborted during recording sends no later frames and submits nothing", async () => {
  const sockets: FakeSocket[] = [];
  const controller = new AbortController();
  const stream = openSonioxStream({
    credential: () => KEY,
    signal: controller.signal,
    createSocket: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
  });
  await new Promise((resolve) => setImmediate(resolve));
  sockets[0].readyState = 1;
  sockets[0].onopen?.();
  stream.write(PCM.subarray(0, 640));
  const sent = sockets[0].sent.length;
  controller.abort();
  sockets[0].readyState = 1;
  stream.write(PCM.subarray(640, 1280));
  let relayed = 0;
  await assert.rejects(
    completeVoice({
      transcribe: () => stream.end(),
      current: () => !controller.signal.aborted,
      automatic: () => true,
      review: () => {},
      send: async () => void relayed++,
    }),
    { kind: "aborted" },
  );
  sockets[0].onmessage?.(JSON.stringify({ tokens: [{ text: "늦음", is_final: true }], finished: true }));
  assert.equal(sockets[0].sent.length, sent);
  assert.equal(relayed, 0);
});

test("live voice: an early server finished while recording relays nothing", async () => {
  const sockets: FakeSocket[] = [];
  const stream = openSonioxStream({
    credential: () => KEY,
    createSocket: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
  });
  await new Promise((resolve) => setImmediate(resolve));
  sockets[0].readyState = 1;
  sockets[0].onopen?.();
  stream.write(PCM.subarray(0, 640));
  sockets[0].onmessage?.(JSON.stringify({ tokens: [{ text: "잘린", is_final: true, start_ms: 0, end_ms: 10 }] }));
  sockets[0].onmessage?.(JSON.stringify({ tokens: [], finished: true }));
  // Mirrors main.ts: the failed session stops the recording, and release still goes through end().
  stream.write(PCM.subarray(640, 1280));
  const relay: string[] = [];
  await assert.rejects(
    completeVoice({
      transcribe: () => stream.end(),
      current: () => true,
      automatic: () => true,
      review: () => {},
      send: async (text) => void relay.push(text),
    }),
    { kind: "protocol" },
  );
  assert.deepEqual(relay, []);
});
