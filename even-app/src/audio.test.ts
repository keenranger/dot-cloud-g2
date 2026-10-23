import { test } from "node:test";
import assert from "node:assert/strict";
import { PcmRecording, wavPcm } from "./audio.ts";
import { wav } from "./protocol.ts";

const pcm = new Uint8Array([1, 2, 3, 4, 5, 6]);

function riff(chunks: [string, Uint8Array][]): Uint8Array {
  const parts = chunks.flatMap(([id, body]) => {
    const head = new Uint8Array(8);
    head.set(Array.from(id, (c) => c.charCodeAt(0)));
    new DataView(head.buffer).setUint32(4, body.byteLength, true);
    return body.byteLength % 2 ? [head, body, new Uint8Array(1)] : [head, body];
  });
  const size = parts.reduce((n, p) => n + p.byteLength, 4);
  const out = new Uint8Array(8 + size);
  out.set(Array.from("RIFF", (c) => c.charCodeAt(0)));
  new DataView(out.buffer).setUint32(4, size, true);
  out.set(
    Array.from("WAVE", (c) => c.charCodeAt(0)),
    8,
  );
  let offset = 12;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

function fmt(overrides: { format?: number; channels?: number; rate?: number; bits?: number } = {}): Uint8Array {
  const body = new Uint8Array(16);
  const view = new DataView(body.buffer);
  view.setUint16(0, overrides.format ?? 1, true);
  view.setUint16(2, overrides.channels ?? 1, true);
  view.setUint32(4, overrides.rate ?? 16_000, true);
  view.setUint32(8, 32_000, true);
  view.setUint16(12, 2, true);
  view.setUint16(14, overrides.bits ?? 16, true);
  return body;
}

test("strips exactly the header from both clip sources", () => {
  assert.deepEqual(wavPcm(wav([pcm])), pcm);
  const recording = new PcmRecording(1);
  recording.append(pcm);
  assert.deepEqual(wavPcm(recording.toWav()), pcm);
});

test("walks extra and odd-sized chunks instead of assuming a 44-byte header", () => {
  const clip = riff([
    ["fmt ", fmt()],
    ["LIST", new Uint8Array(3)],
    ["data", pcm],
  ]);
  assert.deepEqual(wavPcm(clip), pcm);
  const offset = new Uint8Array(clip.byteLength + 5);
  offset.set(clip, 5);
  assert.deepEqual(wavPcm(offset.subarray(5)), pcm);
});

test("rejects anything but non-empty mono PCM16 16 kHz audio", () => {
  const cases = [
    new Uint8Array(0),
    pcm,
    riff([["data", pcm]]),
    riff([["fmt ", fmt()]]),
    riff([
      ["fmt ", fmt()],
      ["data", new Uint8Array(0)],
    ]),
    riff([
      ["fmt ", fmt()],
      ["data", new Uint8Array(3)],
    ]),
    ...[{ format: 3 }, { channels: 2 }, { rate: 48_000 }, { bits: 8 }].map((o) =>
      riff([
        ["fmt ", fmt(o)],
        ["data", pcm],
      ]),
    ),
  ];
  for (const clip of cases) assert.throws(() => wavPcm(clip));
  const truncated = wav([pcm]).slice(0, 48);
  assert.throws(() => wavPcm(truncated));
});
