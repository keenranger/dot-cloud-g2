import { test } from "node:test";
import assert from "node:assert/strict";
import { CAPTION_LIVE, captionBody } from "./g2-caption.ts";
import { DISPLAY_LIMIT } from "./protocol.ts";

test("running text follows a one-line unconfirmed label, whole while it fits one update", () => {
  assert.equal(captionBody(CAPTION_LIVE, "내일 일정 알려줘"), "실시간 인식 (미확정)\n내일 일정 알려줘");
  const long = "가".repeat(DISPLAY_LIMIT - CAPTION_LIVE.length - 1);
  const body = captionBody(CAPTION_LIVE, long);
  assert.equal(body.length, DISPLAY_LIMIT, "exactly at the limit nothing is dropped");
  assert.equal(body.includes("…"), false);
});

test("text beyond the update limit keeps its newest part behind an ellipsis, never splitting a surrogate pair", () => {
  const text = "앞".repeat(1500) + "😀".repeat(600) + "끝";
  const body = captionBody(CAPTION_LIVE, text);
  assert.ok(body.length <= DISPLAY_LIMIT);
  assert.ok(body.startsWith(`${CAPTION_LIVE}\n…`));
  assert.ok(body.endsWith("😀끝"), "the most recent words stay");
  assert.equal(body.isWellFormed(), true, "no lone surrogate");
  // The cut lands inside a pair at one parity or the other; both stay well formed and within the bound.
  const shifted = captionBody(CAPTION_LIVE, "x" + text);
  assert.ok(shifted.length <= DISPLAY_LIMIT);
  assert.equal(shifted.isWellFormed(), true);
});
