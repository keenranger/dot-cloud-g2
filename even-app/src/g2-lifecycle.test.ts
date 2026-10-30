import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { OsEventTypeList } from "@evenrealities/even_hub_sdk";
import { g2LifecycleStep, gesture } from "./g2-lifecycle.ts";

const main = readFileSync(new URL("./main.ts", import.meta.url), "utf8");

test("only host G2 events pause, resume or end the session", () => {
  assert.equal(g2LifecycleStep(OsEventTypeList.SYSTEM_EXIT_EVENT), "exit");
  assert.equal(g2LifecycleStep(OsEventTypeList.ABNORMAL_EXIT_EVENT), "exit");
  assert.equal(g2LifecycleStep(OsEventTypeList.FOREGROUND_EXIT_EVENT), "leave");
  assert.equal(g2LifecycleStep(OsEventTypeList.FOREGROUND_ENTER_EVENT), "enter");
  for (const type of [
    undefined,
    OsEventTypeList.CLICK_EVENT,
    OsEventTypeList.DOUBLE_CLICK_EVENT,
    OsEventTypeList.LONG_PRESS_EVENT,
    OsEventTypeList.SCROLL_BOTTOM_EVENT,
    OsEventTypeList.IMU_DATA_REPORT,
  ])
    assert.equal(g2LifecycleStep(type), undefined, String(type));
});

test("a G2 gesture counts as foreground input, but audio frames and lifecycle events do not", () => {
  for (const type of [
    OsEventTypeList.LONG_PRESS_EVENT,
    OsEventTypeList.LONG_PRESS_RELEASE_EVENT,
    OsEventTypeList.SCROLL_TOP_EVENT,
    OsEventTypeList.SCROLL_BOTTOM_EVENT,
  ])
    assert.equal(gesture(type), true, String(type));
  // An audio event carries no event type.
  for (const type of [
    undefined,
    OsEventTypeList.IMU_DATA_REPORT,
    OsEventTypeList.FOREGROUND_EXIT_EVENT,
    OsEventTypeList.SYSTEM_EXIT_EVENT,
  ])
    assert.equal(gesture(type), false, String(type));
});

test("hiding or locking the phone does not pause listening, capture or polling", () => {
  // Phone page visibility is not G2 foreground state, so the companion registers no listener for it.
  assert.doesNotMatch(main, /visibilitychange|document\.hidden|visibilityState|\bblur\b/);
  // Only a genuine page unload fences the session: pagehide marks the page unloaded and pageshow brings it back.
  assert.match(
    main,
    /addEventListener\("pagehide", \(event\) => \{\s+\/\/[^\n]*\n\s+if \(event\.persisted\) return;\s+pageLoaded = false;\s+pause\(\);\s+status\(\s*\(\) =>\s*t\(\s*"[^"]+",\s*"[^"]+",?\s*\),?\s*\);\s+\}\);/,
  );
  assert.match(
    main,
    /addEventListener\("pageshow", \(\) => \{\s+pageLoaded = true;\s+if \(!active && !exited\)\s+status\(\s*\(\) =>\s*t\(\s*"[^"]+",\s*"[^"]+",?\s*\),?\s*\);\s+resume\(\);\s+\}\);/,
  );
  // A G2 startup that settles after pagehide stays paused.
  assert.match(main, /ready = true;\s+active = pageLoaded;/);
  assert.match(main, /let active = true;/);
  // The lifecycle step drives pause and resume.
  assert.match(main, /step === "leave"\) \{\s+pause\(\);/);
  assert.match(main, /step === "enter"\) \{[^}]*return resume\(\);/);
  // An actual G2 exit still closes the microphone, aborts requests and transcriptions, and never resumes.
  assert.match(main, /step === "exit"\) \{\s+pause\(\);\s+exited = true;\s+cancelRequests\(\);/);
});

test("every microphone the companion opens is the G2 microphone, never the phone's", () => {
  const opens = main.match(/audioControl\(true[^)]*\)/g) ?? [];
  assert.ok(opens.length >= 2);
  for (const call of opens) assert.equal(call, "audioControl(true, AudioInputSource.Glasses)");
  assert.doesNotMatch(main, /AudioInputSource\.Phone\)/);
});

// Source guards for the resume path; the runtime proof is the mocked-bridge harness under outputs/qa-0.4.0.
const body = (name: string) => main.slice(main.indexOf(`function ${name}(`)).split("\n}\n")[0];

test("an ENTER for a page that is already active returns before any rewrite, poll or wake change", () => {
  const resume = body("resume");
  const guard = resume.indexOf("if (exited || active || !pageLoaded) return;");
  assert.ok(guard > 0, "resume() must be a no-op while active");
  for (const effect of ["g2.forget()", "syncWake(true)", "void poll()", "renderDisplay()"])
    assert.ok(resume.indexOf(effect) > guard, effect);
});

test("an early poll replaces the scheduled one instead of starting a second chain", () => {
  const poll = body("poll");
  const clear = poll.indexOf("clearTimeout(pollTimer);");
  assert.ok(clear > poll.indexOf("if (pollRunning"), "the pending timer is cleared only by a poll that actually runs");
  assert.ok(clear < poll.indexOf("pollRunning = true;"));
});

test("capture notices are tracked, so resume replaces them instead of resending them", () => {
  for (const text of ["Hey dots 감지됨", "음성 전사 마무리 중", "녹음 중 · 손을 떼면"]) {
    // Each notice is written as () => t(English, Korean); the Korean form identifies it.
    assert.match(main, new RegExp(`captureText\\(\\s*\\(\\) =>\\s*t\\(\\s*"[^"]*",\\s*"${text}`), text);
    assert.doesNotMatch(main, new RegExp(`displayText\\(\\s*(\\(\\) =>\\s*)?t\\(\\s*"[^"]*",\\s*"${text}`), text);
  }
  const resume = body("resume");
  assert.match(resume, /if \(selection === captureNotice\) \{\s+if \(history\.selected\) showSelectedReply\(\);/);
  // The draft in the text field is not part of the display, so resume never touches it.
  assert.doesNotMatch(resume, /el<HTMLTextAreaElement>\("text"\)|draft =/);
});
