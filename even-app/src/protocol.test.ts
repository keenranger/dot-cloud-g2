import { test } from "node:test";
import assert from "node:assert/strict";
import { pages, relayOrigin, wav } from "./protocol.ts";
test("relay accepts only HTTPS origins without embedded credentials or paths", () => {
  assert.equal(relayOrigin("https://relay.example"), "https://relay.example");
  for (const origin of [
    "http://relay.example",
    "https://name:secret@relay.example",
    "https://relay.example/api",
    "https://relay.example/?token=secret",
  ])
    assert.throws(() => relayOrigin(origin));
});
test("WAV preserves PCM frames and describes signed 16-bit mono at 16kHz", () => {
  const out = wav([new Uint8Array([1, 2]), new Uint8Array([3, 4])]);
  const header = new DataView(out.buffer);
  assert.equal(header.getUint32(24, true), 16000);
  assert.equal(header.getUint16(22, true), 1);
  assert.equal(header.getUint16(34, true), 16);
  assert.equal(header.getUint32(40, true), 4);
  assert.deepEqual(Array.from(out.slice(44)), [1, 2, 3, 4]);
  assert.throws(() => wav([]));
  assert.throws(() => wav([new Uint8Array([1])]));
});
test("display pages retain Unicode text within a conservative SDK update bound", () => {
  const text = "한글😀".repeat(1000);
  const result = pages(text);
  assert.equal(result.join(""), text);
  assert.ok(result.every((page) => page.length <= 480));
});
