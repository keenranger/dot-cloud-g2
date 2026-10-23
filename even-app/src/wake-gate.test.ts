import { test } from "node:test";
import assert from "node:assert/strict";
import { canListen, finishWakeClip, type WakeConditions } from "./wake-gate.ts";
const permitted: WakeConditions = {
  enabled: true,
  active: true,
  ready: true,
  connected: true,
  transcriber: true,
  busy: false,
  manual: false,
  draft: false,
};
test("local listening requires explicit opt-in, foreground app, initialized G2, pairing and a Soniox key", () => {
  assert.equal(canListen(permitted), true);
  for (const flag of ["enabled", "active", "ready", "connected", "transcriber"] as const)
    assert.equal(canListen({ ...permitted, [flag]: false }), false, flag);
});
test("STT/send, manual recording and unsent review draft each prevent wake capture", () => {
  for (const flag of ["busy", "manual", "draft"] as const)
    assert.equal(canListen({ ...permitted, [flag]: true }), false, flag);
});

test("no-speech completion restores the reply without uploading", async () => {
  let display = "speak now";
  let uploads = 0;
  await finishWakeClip({
    canUpload: () => true,
    upload: async () => {
      uploads++;
    },
    restore: () => {
      display = "previous reply";
    },
  });
  assert.equal(display, "previous reply");
  assert.equal(uploads, 0);
});
test("withdrawn wake generation before queued processing cannot start an upload", async () => {
  let epoch = 1;
  const expected = epoch;
  let uploads = 0;
  let restored = false;
  let settle!: () => void;
  const microphoneStopped = new Promise<void>((resolve) => {
    settle = resolve;
  });
  const work = microphoneStopped.then(() =>
    finishWakeClip({
      clip: new Uint8Array([1, 2]),
      canUpload: () => expected === epoch,
      upload: async () => {
        uploads++;
      },
      restore: () => {
        restored = true;
      },
    }),
  );
  epoch++;
  settle();
  await work;
  assert.equal(uploads, 0);
  assert.equal(restored, true);
});
