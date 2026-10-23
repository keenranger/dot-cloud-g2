import { test } from "node:test";
import assert from "node:assert/strict";
import { DISPLAY_LIMIT, boundaryStep, pairCode, relayOrigin, segmentContent, segments, wav } from "./protocol.ts";
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
test("a reply that fits one display update is shown whole without a page header or marker", () => {
  const text = "안녕하세요. 이 답변은 G2에서 한 번에 표시되고 안경에서 스크롤해 읽습니다.\n".repeat(10);
  const parts = segments(text);
  assert.deepEqual(parts, [text]);
  assert.equal(segmentContent(parts, 0), text);
  // Korean text up to the limit is one update; a UTF-8 byte count would have split it near 666 syllables.
  assert.deepEqual(segments("가".repeat(DISPLAY_LIMIT)), ["가".repeat(DISPLAY_LIMIT)]);
  assert.deepEqual(segments(""), [" "]);
});
test("long replies split only above the update limit and keep every character", () => {
  for (const text of [
    "가".repeat(DISPLAY_LIMIT + 1),
    "한글😀".repeat(1000),
    "😀".repeat(3000),
    "가나다 라마바 사아자\n".repeat(400),
    "a".repeat(5000),
  ]) {
    const parts = segments(text);
    assert.ok(parts.length > 1);
    assert.equal(parts.join(""), text);
    for (let i = 0; i < parts.length; i++) {
      assert.ok(segmentContent(parts, i).length <= DISPLAY_LIMIT);
      // No surrogate pair is cut in half.
      assert.doesNotMatch(parts[i], /^[\udc00-\udfff]|[\ud800-\udbff]$/);
    }
    assert.match(segmentContent(parts, 0), /\n\(계속\)$/);
    assert.match(segmentContent(parts, parts.length - 1), /^\(이어서\)\n/);
  }
  assert.equal(segments("가".repeat(5000)).length, 3);
  assert.ok(
    segments("단어 ".repeat(1000))
      .slice(0, -1)
      .every((part) => part.endsWith(" ")),
  );
  assert.ok(
    segments("문장입니다.\n".repeat(400))
      .slice(0, -1)
      .every((part) => part.endsWith("\n")),
  );
});
test("G2 boundary events move between parts, then to the adjacent message", () => {
  assert.deepEqual(boundaryStep(0, 1, 1), { message: 1 });
  assert.deepEqual(boundaryStep(0, 1, -1), { message: -1 });
  assert.deepEqual(boundaryStep(0, 3, 1), { part: 1 });
  assert.deepEqual(boundaryStep(2, 3, 1), { message: 1 });
  assert.deepEqual(boundaryStep(1, 3, -1), { part: 0 });
});
test("pairing codes tolerate pasted spaces and capitalization but nothing else", () => {
  const code = "ab".repeat(32);
  assert.equal(pairCode(` ${code.slice(0, 10)} ${code.slice(10).toUpperCase()}\n`), code);
  for (const bad of ["", code.slice(1), code + "a", "g".repeat(64)]) assert.throws(() => pairCode(bad), /64자리/);
});
