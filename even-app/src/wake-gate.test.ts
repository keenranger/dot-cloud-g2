import { test } from "node:test";
import assert from "node:assert/strict";
import { WAKE_BLOCKED, canListen, finishWakeClip, wakeBlocker, type WakeConditions } from "./wake-gate.ts";
const permitted: WakeConditions = {
  settings: true,
  enabled: true,
  active: true,
  ready: true,
  connected: true,
  transcriber: true,
  busy: false,
  manual: false,
  draft: false,
};
test("local listening requires the enabled setting, foreground app, initialized G2, pairing and a Soniox key", () => {
  assert.equal(canListen(permitted), true);
  for (const flag of ["settings", "enabled", "active", "ready", "connected", "transcriber"] as const)
    assert.equal(canListen({ ...permitted, [flag]: false }), false, flag);
});
test("an unread saved choice outranks the page default, and quiet G2 audio is never a blocker", () => {
  // The checkbox still shows the page default while the saved choice is read, so it says nothing yet.
  assert.equal(wakeBlocker({ ...permitted, settings: false, enabled: true }), "settings");
  // Missing frames are reported by the companion, never turned into a reason to stop listening.
  assert.equal("audio" in WAKE_BLOCKED, false);
  assert.match(WAKE_BLOCKED.settings, /설정/);
});
test("STT/send, manual recording and unsent review draft each prevent wake capture", () => {
  for (const flag of ["busy", "manual", "draft"] as const)
    assert.equal(canListen({ ...permitted, [flag]: true }), false, flag);
});
test("default-on startup names the missing prerequisite instead of claiming a recording or draft pause", () => {
  // As the companion starts: setting on, G2 not ready, not paired, no key yet.
  const startup = { ...permitted, ready: false, connected: false, transcriber: false };
  assert.equal(wakeBlocker(startup), "ready");
  assert.equal(wakeBlocker({ ...startup, ready: true }), "connected");
  assert.equal(wakeBlocker({ ...startup, ready: true, connected: true }), "transcriber");
  assert.equal(wakeBlocker(permitted), undefined);
  // Turning it off wins over every other condition, so the label always confirms the user's choice.
  assert.equal(wakeBlocker({ ...startup, enabled: false, busy: true }), "enabled");
  for (const blocker of ["enabled", "active", "ready", "connected", "transcriber"] as const)
    assert.doesNotMatch(WAKE_BLOCKED[blocker], /녹음|처리|작성/, blocker);
  assert.match(WAKE_BLOCKED.enabled, /꺼짐/);
  assert.equal(new Set(Object.values(WAKE_BLOCKED)).size, Object.keys(WAKE_BLOCKED).length);
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
