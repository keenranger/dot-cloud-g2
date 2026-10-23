import { test } from "node:test";
import assert from "node:assert/strict";
import { completeVoice } from "./voice-flow.ts";
test("a voice clip automatically submits once without a phone action", async () => {
  const actions: string[] = [];
  await completeVoice({
    transcribe: async () => "  안녕  ",
    current: () => true,
    automatic: () => true,
    review: (text) => {
      actions.push(`review:${text}`);
    },
    send: async (text) => {
      actions.push(`send:${text}`);
    },
  });
  assert.deepEqual(actions, ["review:안녕", "send:안녕"]);
});
test("disconnect during transcription prevents both stale draft and submission", async () => {
  let connected = true;
  let resolve!: (text: string) => void;
  const pending = new Promise<string>((done) => {
    resolve = done;
  });
  const actions: string[] = [];
  const work = completeVoice({
    transcribe: () => pending,
    current: () => connected,
    automatic: () => true,
    review: () => {
      actions.push("review");
    },
    send: async () => {
      actions.push("send");
    },
  });
  connected = false;
  resolve("stale");
  await work;
  assert.deepEqual(actions, []);
});
test("review preference keeps transcript without sending and empty STT cannot submit", async () => {
  const actions: string[] = [];
  const options = {
    transcribe: async () => "hello",
    current: () => true,
    automatic: () => false,
    review: (text: string) => {
      actions.push(text);
    },
    send: async () => {
      actions.push("send");
    },
  };
  await completeVoice(options);
  assert.deepEqual(actions, ["hello"]);
  await assert.rejects(completeVoice({ ...options, automatic: () => true, transcribe: async () => " " }));
  assert.deepEqual(actions, ["hello"]);
});
