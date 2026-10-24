import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "../even-app/node_modules/typescript/lib/typescript.js";

// Execute the real companion entry point, replacing only the DOM/host/HTTP/WebSocket/wake-worker boundaries.
// No provider, account, device, or network credentials are used; the Soniox key below is a synthetic token.
const KEY = "synthetic-soniox-key-0001";
const DEVICE = JSON.stringify({ origin: "https://fixture.example", token: "synthetic-device-token" });
const PREFS = "dot-cloud-preferences-v1";
const EVENT = {
  SCROLL_TOP: 1,
  DOUBLE_CLICK: 3,
  ENTER: 4,
  LEAVE: 5,
  ABNORMAL_EXIT: 6,
  SYSTEM_EXIT: 7,
  LONG_PRESS: 9,
  RELEASE: 10,
};
const events = `const OsEventTypeList = {CLICK_EVENT:0,SCROLL_TOP_EVENT:1,SCROLL_BOTTOM_EVENT:2,DOUBLE_CLICK_EVENT:3,FOREGROUND_ENTER_EVENT:4,FOREGROUND_EXIT_EVENT:5,ABNORMAL_EXIT_EVENT:6,SYSTEM_EXIT_EVENT:7,IMU_DATA_REPORT:8,LONG_PRESS_EVENT:9,LONG_PRESS_RELEASE_EVENT:10};`;
const sdk = /import \{[\s\S]*?\} from "@evenrealities\/even_hub_sdk";/;
const moduleUrl = (code) =>
  "data:text/javascript;base64," +
  Buffer.from(
    ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } })
      .outputText,
  ).toString("base64");
// The real SDK bundle needs a host WebView, so modules that only read its event enum get the same values inline.
const lifecycle = moduleUrl(
  readFileSync(new URL("../even-app/src/g2-lifecycle.ts", import.meta.url), "utf8").replace(sdk, events),
);
// The packaged wake worker needs a browser Worker; the companion only sees this detector interface.
const wakeModule = moduleUrl(
  "export const loadWakeDetector = (event, error, name) => globalThis.__wakeLoad(event, error, name);",
);
let boots = 0;

/** Boots a fresh copy of main.ts against fakes; every observable host call is recorded. */
async function boot(options = {}) {
  const names = [
    "document",
    "window",
    "fetch",
    "setTimeout",
    "clearTimeout",
    "WebSocket",
    "__runtimeBridge",
    "__wakeLoad",
  ];
  const saved = new Map(names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const elements = new Map();
  const listeners = new Map();
  const timers = new Map();
  let timerId = 0;
  const h = {
    storage: new Map(Object.entries(options.storage ?? {})),
    held: new Map(),
    readFail: new Set(options.readFail ?? []),
    writeFail: false,
    storageWrites: [],
    audio: [],
    audioResults: [],
    writes: [],
    shutdown: [],
    sockets: [],
    detectors: [],
    polls: 0,
    posts: [],
    listeners,
    timers,
  };
  h.get = (id) => {
    if (!elements.has(id))
      elements.set(id, {
        value: "",
        textContent: "",
        checked: false,
        disabled: false,
        hidden: false,
        setAttribute() {},
        removeAttribute() {},
        focus() {},
        click() {
          this.onclick?.();
        },
      });
    return elements.get(id);
  };
  // index.html ships both voice preferences checked.
  h.get("wake-enabled").checked = true;
  h.get("auto-send").checked = true;
  h.flush = async () => {
    for (let i = 0; i < 80; i++) await Promise.resolve();
  };
  // Storage reads named in `hold` stay pending until `release(key)`.
  const releases = new Map();
  for (const key of options.hold ?? []) h.held.set(key, new Promise((resolve) => releases.set(key, resolve)));
  h.release = async (key) => {
    releases.get(key)();
    await h.flush();
  };
  const host = {
    async createStartUpPageContainer() {
      if (options.holdStartup) return new Promise((resolve) => (h.settleStartup = () => resolve(0)));
      return 0;
    },
    onEvenHubEvent(callback) {
      h.onHostEvent = callback;
    },
    async getLocalStorage(key) {
      if (h.held.has(key)) await h.held.get(key);
      if (h.readFail.has(key)) throw new Error("storage read failed");
      return h.storage.get(key) ?? "";
    },
    async setLocalStorage(key, value) {
      h.storageWrites.push([key, value]);
      if (h.writeFail) return false;
      h.storage.set(key, value);
      return true;
    },
    async audioControl(open, source) {
      const ok = h.audioResults.length ? h.audioResults.shift() : true;
      h.audio.push({ open, source, ok });
      return ok;
    },
    async textContainerUpgrade(update) {
      h.writes.push(update);
      return options.write ? options.write(update) : true;
    },
    async shutDownPageContainer(mode) {
      h.shutdown.push(mode);
      return true;
    },
  };
  globalThis.document = { hidden: false, getElementById: h.get, addEventListener: (n, c) => listeners.set(n, c) };
  globalThis.window = { addEventListener: (n, c) => listeners.set(n, c) };
  globalThis.__runtimeBridge = host;
  globalThis.fetch =
    options.fetch ??
    (async (_url, init) => {
      if (init?.method === "POST") {
        h.posts.push(init);
        return new Response(JSON.stringify({ status: "stored" }), { status: 200 });
      }
      h.polls++;
      return new Response(JSON.stringify({ messages: options.messages ?? [] }), { status: 200 });
    });
  globalThis.setTimeout = (callback, ms) => {
    const id = ++timerId;
    timers.set(id, { callback, ms });
    return id;
  };
  globalThis.clearTimeout = (id) => timers.delete(id);
  globalThis.WebSocket = class {
    constructor(url, protocols) {
      this.url = url;
      this.protocols = protocols;
      this.readyState = 0;
      this.bufferedAmount = 0;
      this.sent = [];
      this.closed = false;
      h.sockets.push(this);
      queueMicrotask(() => {
        if (this.closed) return;
        this.readyState = 1;
        this.onopen?.();
      });
    }
    send(data) {
      this.sent.push(data);
    }
    close() {
      this.closed = true;
      this.readyState = 3;
    }
    reply(message) {
      this.onmessage?.({ data: JSON.stringify(message) });
    }
  };
  globalThis.__wakeLoad = async (event, error) => {
    const detector = {
      event,
      error,
      appended: 0,
      listening: 0,
      disposed: false,
      listen() {
        this.listening++;
      },
      cancel() {},
      hold() {},
      finish() {},
      append(pcm) {
        this.appended += pcm.length;
      },
      dispose() {
        this.disposed = true;
      },
    };
    h.detectors.push(detector);
    return detector;
  };
  h.timer = (ms) => [...timers].find(([, timer]) => timer.ms === ms);
  h.fire = async (ms) => {
    const entry = h.timer(ms);
    assert.ok(entry, `a ${ms} ms timer is scheduled`);
    timers.delete(entry[0]);
    entry[1].callback();
    await h.flush();
  };
  h.pollTimers = () => [...timers.values()].filter((t) => t.ms === 2500).length;
  h.event = async (type, kind = "sysEvent") => {
    h.onHostEvent({ [kind]: { eventType: type } });
    await h.flush();
  };
  h.frame = async (bytes = 640) => {
    h.onHostEvent({ audioEvent: { source: "glasses", audioPcm: new Uint8Array(bytes) } });
    await h.flush();
  };
  h.opens = () => h.audio.filter((a) => a.open).length;
  h.last = () => h.audio.at(-1);
  h.restore = () => {
    for (const name of names) {
      const d = saved.get(name);
      if (d) Object.defineProperty(globalThis, name, d);
      else delete globalThis[name];
    }
  };
  try {
    let source = readFileSync(new URL("../even-app/src/main.ts", import.meta.url), "utf8");
    source = source.replace(
      sdk,
      `const AudioInputSource = {Glasses: "glasses", Phone: "phone"}; ${events}
       const CreateStartUpPageContainer = class {constructor(p){Object.assign(this,p)}};
       const TextContainerProperty = CreateStartUpPageContainer; const TextContainerUpgrade = CreateStartUpPageContainer;
       const waitForEvenAppBridge = async () => globalThis.__runtimeBridge;`,
    );
    source = source.replace('from "./g2-lifecycle.ts"', `from "${lifecycle}"`);
    source = source.replace('from "./wake-detector.ts"', `from "${wakeModule}"`);
    source = source.replace('import "./style.css";', "");
    source = source.replace(
      /from "(\.\/[^"]+)"/g,
      (_, path) => `from "${new URL("../even-app/src/" + path.slice(2), import.meta.url).href}"`,
    );
    // Each boot is a separate module instance with its own state.
    await import(moduleUrl(`${source}\n// boot ${++boots}`));
    await h.flush();
  } catch (e) {
    h.restore();
    throw e;
  }
  return h;
}

/** Never asks the host to open the G2 microphone while an earlier stop is unconfirmed or a microphone is open. */
function assertNoConcurrentOpen(audio) {
  let state = "closed";
  for (const [i, call] of audio.entries()) {
    if (call.open) {
      assert.equal(state, "closed", `open #${i} requested while the microphone was ${state}`);
      if (call.ok) state = "open";
    } else state = call.ok ? "closed" : "unknown";
  }
}

const ready = { [PREFS]: "", "dot-cloud-device-v1": DEVICE, "dot-cloud-soniox-key-v1": KEY };

test("same-message display recovery, locked-phone polling, G2 foreground pause, unload and confirmed host exit", async () => {
  let failBody = true;
  let failHeader = true;
  const h = await boot({
    holdStartup: true,
    storage: { "dot-cloud-device-v1": DEVICE },
    messages: [{ message_id: "fixture-reply", text: "안경 답변 확인", createdAt: "2026-10-23T00:00:00Z" }],
    write(update) {
      if (update.containerID === 2 && failHeader) {
        failHeader = false;
        throw new Error("header rejected");
      }
      if (update.containerID === 1 && update.content === "안경 답변 확인" && failBody) {
        failBody = false;
        return false;
      }
      return true;
    },
  });
  const nextPoll = () => h.fire(2500);
  try {
    assert.ok(h.settleStartup);
    h.listeners.get("pagehide")({ persisted: false });
    assert.match(h.get("status").textContent, /페이지/, "an unload pause is named on the phone");
    h.settleStartup();
    await h.flush();
    assert.equal(h.polls, 0, "late startup cannot reactivate an unloaded page");
    assert.equal(h.pollTimers(), 0);
    h.listeners.get("pageshow")();
    await h.flush();
    assert.equal(h.get("reply").textContent, "안경 답변 확인");
    assert.match(h.get("display").textContent, /실패/);
    const bodies = () => h.writes.filter((w) => w.containerID === 1).length;
    const firstBodies = bodies();
    await nextPoll();
    assert.equal(bodies(), firstBodies + 1, "unchanged server reply retries its failed body");
    assert.match(h.get("display").textContent, /확인했습니다/);
    const acknowledgedBodies = bodies();
    await nextPoll();
    assert.equal(bodies(), acknowledgedBodies, "acknowledged reply keeps native scroll");
    // Phone visibility is not a lifecycle input at all: there is no hide gate to reinstate.
    assert.equal(h.listeners.has("visibilitychange"), false, "no phone visibility gate");
    document.hidden = true;
    const beforeLockPoll = h.polls;
    await nextPoll();
    assert.equal(h.polls, beforeLockPoll + 1, "phone lock does not pause a ready glasses session");
    h.listeners.get("pagehide")({ persisted: true });
    await h.flush();
    assert.equal(h.pollTimers(), 1, "a back-forward-cache pagehide is not an unload and keeps polling");
    await h.event(EVENT.LEAVE);
    assert.equal(h.pollTimers(), 0, "G2 foreground exit pauses polling");
    h.listeners.get("pagehide")({ persisted: false });
    h.onHostEvent({ sysEvent: { eventType: EVENT.ENTER } });
    h.onHostEvent({ textEvent: { eventType: EVENT.SCROLL_TOP } });
    await h.flush();
    assert.equal(h.pollTimers(), 0, "G2 events cannot resume an unloaded page");
    h.listeners.get("pageshow")();
    await h.flush();
    assert.equal(h.pollTimers(), 1, "pageshow resumes a single poll chain");
    h.onHostEvent({ sysEvent: { eventType: EVENT.ENTER } });
    h.listeners.get("pageshow")();
    await h.flush();
    assert.equal(h.pollTimers(), 1, "repeated resume keeps one poll chain");
    await h.event(EVENT.DOUBLE_CLICK, "textEvent");
    assert.deepEqual(h.shutdown, [1], "root double tap uses system confirmation");
    await nextPoll(); // A cancelled confirmation has not ended the session.
    h.listeners.get("pagehide")({ persisted: false });
    assert.equal(h.pollTimers(), 0, "unload stops polling");
    h.listeners.get("pageshow")();
    await h.flush();
    await h.event(EVENT.SYSTEM_EXIT);
    assert.equal(h.pollTimers(), 0, "confirmed host exit stops polling");
    assert.match(h.get("status").textContent, /종료/, "a host exit is named on the phone");
    const afterExit = h.polls;
    h.listeners.get("pageshow")();
    await h.flush();
    assert.equal(h.polls, afterExit, "a terminated session cannot resume");
  } finally {
    h.restore();
  }
});

test("a saved OFF is restored before any microphone opens, and explicit choices persist through SDK storage", async () => {
  const h = await boot({
    storage: { ...ready, [PREFS]: JSON.stringify({ wake: false, autoSend: false }) },
    hold: [PREFS],
  });
  try {
    // G2, pairing and the Soniox key are all ready; only the preference read is pending.
    assert.equal(h.pollTimers(), 1, "the session is otherwise ready");
    assert.equal(h.opens(), 0, "no microphone before the saved preference is known");
    assert.equal(h.get("wake-enabled").disabled, true, "the choice cannot be overwritten while it is being read");
    await h.release(PREFS);
    assert.equal(h.get("wake-enabled").checked, false);
    assert.equal(h.get("auto-send").checked, false);
    assert.equal(h.get("wake-enabled").disabled, false);
    assert.equal(h.opens(), 0, "a saved OFF never opens the microphone");
    assert.match(h.get("wake-status").textContent, /꺼짐/);
    assert.equal(
      h.storageWrites.filter(([key]) => key === PREFS).length,
      0,
      "restoring does not rewrite the saved choice",
    );
    // Turning it on is an explicit choice that is saved and opens only the G2 microphone.
    h.get("wake-enabled").checked = true;
    h.get("wake-enabled").onchange();
    await h.flush();
    assert.deepEqual(JSON.parse(h.storage.get(PREFS)), { wake: true, autoSend: false });
    assert.deepEqual(
      h.audio.map((a) => [a.open, a.source]),
      [[true, "glasses"]],
    );
    // A failed write is reported instead of claiming the choice will survive the next launch.
    h.writeFail = true;
    h.get("auto-send").checked = true;
    h.get("auto-send").onchange();
    await h.flush();
    assert.match(h.get("status").textContent, /설정을 저장하지 못/);
    assert.equal(h.get("auto-send").checked, true, "the choice still applies to this session");
    assert.deepEqual(JSON.parse(h.storage.get(PREFS)), { wake: true, autoSend: false });
    assert.equal(
      h.storageWrites.some(([key]) => key === "dot-cloud-soniox-key-v1"),
      false,
      "the key is never written",
    );
  } finally {
    h.restore();
  }
});

test("defaults apply only without a saved choice, and an unreadable choice keeps Hey dots off", async () => {
  const fresh = await boot({ storage: ready });
  try {
    assert.equal(fresh.get("wake-enabled").checked, true);
    assert.equal(fresh.get("auto-send").checked, true);
    assert.equal(fresh.opens(), 1, "default ON listens once everything is ready");
    assert.equal(fresh.storageWrites.filter(([key]) => key === PREFS).length, 0, "defaults are not written");
  } finally {
    fresh.restore();
  }
  const unreadable = await boot({ storage: ready, readFail: [PREFS] });
  try {
    assert.equal(unreadable.opens(), 0, "an unknown saved choice may be OFF, so the microphone stays closed");
    assert.equal(unreadable.get("wake-enabled").checked, false);
    assert.match(unreadable.get("status").textContent, /설정을 불러오지 못/);
    assert.equal(unreadable.get("wake-enabled").disabled, false, "the user can turn it on again");
  } finally {
    unreadable.restore();
  }
});

test("an unconfirmed G2 microphone stop is retried before any reopen, on resume and on a manual start", async () => {
  const h = await boot({ storage: ready });
  try {
    assert.equal(h.opens(), 1);
    h.audioResults.push(false);
    await h.event(EVENT.LEAVE);
    assert.deepEqual(h.last(), { open: false, source: "glasses", ok: false });
    assert.match(h.get("wake-status").textContent, /마이크 중지를 확인하지 못/);
    // Resume retries the stop once; it fails again, so nothing opens.
    h.audioResults.push(false);
    await h.event(EVENT.ENTER);
    assert.equal(h.opens(), 1, "no reopen while the stop is unconfirmed");
    assert.match(h.get("wake-status").textContent, /마이크 중지를 확인하지 못/);
    const attempts = h.audio.length;
    // Nothing retries on its own: polling and timers leave the microphone alone.
    await h.fire(2500);
    assert.equal(h.audio.length, attempts, "no automatic retry loop");
    // A long press retries the stop once, and on confirmation the manual capture opens the G2 microphone.
    await h.event(EVENT.LONG_PRESS, "textEvent");
    assert.deepEqual(
      h.audio.slice(attempts).map((a) => [a.open, a.ok]),
      [
        [false, true],
        [true, true],
      ],
    );
    assert.match(h.get("status").textContent, /녹음 중/);
    // An unconfirmed manual stop leaves Hey dots closed until a later trigger confirms it.
    h.audioResults.push(false);
    await h.frame();
    await h.event(EVENT.RELEASE, "textEvent");
    assert.match(h.get("status").textContent, /마이크 중지를 확인하지 못/);
    const afterManual = h.opens();
    h.get("text").value = "";
    h.get("text").oninput();
    await h.flush();
    assert.equal(h.opens(), afterManual, "Hey dots does not reopen over an unconfirmed manual stop");
    await h.event(EVENT.LEAVE);
    await h.event(EVENT.ENTER);
    assert.equal(h.opens(), afterManual + 1, "a confirmed stop on resume lets Hey dots listen again");
    assertNoConcurrentOpen(h.audio);
  } finally {
    h.restore();
  }
});

test("quiet for more than 20 seconds is only reported; later G2 frames, a cue and manual speech are still accepted", async () => {
  const h = await boot({ storage: ready });
  try {
    assert.equal(h.opens(), 1);
    // The SDK acknowledgement means the request was accepted, not that audio arrives.
    assert.match(h.get("wake-status").textContent, /오디오 수신 대기/);
    assert.doesNotMatch(h.get("wake-status").textContent, /마이크 켜짐/);
    await h.fire(4000);
    // No frame yet is reported as unknown, on the phone and the G2 header, and nothing else changes.
    assert.match(h.get("wake-status").textContent, /G2 오디오 수신 확인 안 됨/);
    assert.match(h.writes.filter((w) => w.containerID === 2).at(-1).content, /G2 오디오 수신 확인 안 됨/);
    assert.equal(h.audio.length, 1, "quiet neither closes nor reopens the microphone");
    assert.equal(h.detectors.at(-1).disposed, false, "the detector keeps listening");
    assert.equal(h.timer(4000) ?? h.timer(6000), undefined, "an idle observation leaves no timer running");
    for (let i = 0; i < 9; i++) await h.fire(2500); // 22.5 seconds of polling with no frames
    assert.equal(h.audio.length, 1, "more than 20 seconds of quiet causes no microphone call");
    // The first real frame clears the unknown state and reaches the detector.
    await h.frame();
    assert.equal(h.detectors.at(-1).appended, 640);
    assert.match(h.get("wake-status").textContent, /마이크 켜짐/);
    assert.ok(h.timer(6000), "observation resumes after a frame");
    await h.fire(6000);
    assert.match(h.get("wake-status").textContent, /G2 오디오 수신 확인 안 됨/);
    assert.equal(h.audio.length, 1, "a pause in frames is still not a failure");
    // A cue after the quiet is accepted and opens a Soniox session.
    await h.frame();
    h.detectors.at(-1).event({ type: "wake" });
    await h.flush();
    assert.equal(h.sockets.length, 1);
    assert.match(h.get("wake-status").textContent, /Hey dots 감지됨/);
    // The user's OFF still closes promptly, with the cue's Soniox session.
    h.get("wake-enabled").checked = false;
    h.get("wake-enabled").onchange();
    await h.flush();
    assert.equal(h.last().open, false);
    assert.equal(h.sockets[0].closed, true);
    assert.equal(h.timer(4000) ?? h.timer(6000), undefined, "closing stops the observation");
    h.get("wake-enabled").checked = true;
    h.get("wake-enabled").onchange();
    await h.flush();
    // A manual capture that hears nothing for a while keeps recording, and speech after the quiet is sent.
    await h.event(EVENT.LONG_PRESS, "textEvent");
    assert.match(h.get("wake-status").textContent, /수동 녹음 오디오 수신 대기/);
    await h.fire(4000);
    assert.match(h.get("status").textContent, /녹음 중/);
    assert.match(h.get("wake-status").textContent, /수동 녹음 중 · G2 오디오 수신 확인 안 됨/);
    await h.frame();
    assert.match(h.get("wake-status").textContent, /마이크 켜짐 · 수동 녹음 중/);
    await h.event(EVENT.RELEASE, "textEvent");
    const socket = h.sockets.at(-1);
    assert.ok(
      socket.sent.some((data) => data instanceof Uint8Array),
      "the speech reached Soniox",
    );
    socket.reply({ tokens: [{ text: "조용한 뒤 질문", is_final: true }], finished: true });
    await h.flush();
    assert.equal(h.posts.length, 1, "the transcript is submitted");
    // Every microphone call came from an explicit action: start, OFF, ON, long press, release, then Hey dots again.
    assert.deepEqual(
      h.audio.map((a) => a.open),
      [true, false, true, false, true, false, true],
    );
    assertNoConcurrentOpen(h.audio);
  } finally {
    h.restore();
  }
});

test("a manual capture with no G2 frames runs to its 30-second cap and says no audio arrived, not malformed audio", async () => {
  const h = await boot({ storage: ready });
  try {
    await h.event(EVENT.LONG_PRESS, "textEvent");
    assert.match(h.get("status").textContent, /녹음 중/);
    await h.event(EVENT.RELEASE, "textEvent");
    assert.match(h.get("status").textContent, /오디오를 받지 못/);
    assert.doesNotMatch(h.get("status").textContent, /형식/);
    assert.equal(h.posts.length, 0, "nothing is submitted");
    // Quiet does not cut a capture short; the existing cap ends it.
    const before = h.audio.length;
    await h.event(EVENT.LONG_PRESS, "textEvent");
    await h.fire(4000);
    assert.match(h.get("status").textContent, /녹음 중/);
    assert.deepEqual(
      h.audio.slice(before).map((a) => a.open),
      [false, true],
      "Hey dots closed for the capture, which stays open",
    );
    await h.fire(30000);
    assert.equal(h.audio.at(before + 2).open, false, "the 30-second cap closes the G2 microphone");
    assert.match(h.get("status").textContent, /오디오를 받지 못/);
    assert.ok(
      h.sockets.every((s) => s.closed),
      "the Soniox session is closed",
    );
    assertNoConcurrentOpen(h.audio);
  } finally {
    h.restore();
  }
});

test("a confirmed host exit while waiting for G2 audio closes the microphone and leaves no observation timer", async () => {
  const h = await boot({ storage: ready });
  try {
    assert.ok(h.timer(4000), "waiting for the first frame");
    await h.event(EVENT.SYSTEM_EXIT);
    assert.equal(h.last().open, false);
    assert.equal(h.timer(4000) ?? h.timer(6000), undefined);
    assert.equal(h.pollTimers(), 0);
  } finally {
    h.restore();
  }
});

test("an abnormal host exit closes the microphone and Soniox, stops polling, says why and never resumes", async () => {
  const h = await boot({ storage: ready });
  try {
    await h.frame();
    h.detectors.at(-1).event({ type: "wake" });
    await h.flush();
    assert.equal(h.sockets.length, 1, "the wake capture opened a Soniox session");
    assert.ok(h.timer(6000), "frames are being observed");
    await h.event(EVENT.ABNORMAL_EXIT);
    assert.equal(h.last().open, false, "the G2 microphone is closed");
    assert.equal(h.timer(4000) ?? h.timer(6000), undefined, "no observation timer outlives the exit");
    assert.equal(h.sockets[0].closed, true, "the Soniox session is closed");
    assert.equal(h.pollTimers(), 0);
    assert.match(h.get("status").textContent, /비정상/);
    const audio = h.audio.length;
    await h.event(EVENT.ENTER);
    h.listeners.get("pageshow")();
    await h.event(EVENT.LONG_PRESS, "textEvent");
    assert.equal(h.audio.length, audio, "nothing reopens after a terminal exit");
    assert.equal(h.pollTimers(), 0);
  } finally {
    h.restore();
  }
});

test("a send in flight across a G2 foreground exit keeps the typed text, and resume respects the draft", async () => {
  const pending = [];
  const h = await boot({
    storage: ready,
    fetch: (_url, init) => {
      if (init?.method !== "POST")
        return Promise.resolve(new Response(JSON.stringify({ messages: [] }), { status: 200 }));
      return new Promise((_resolve, reject) => {
        pending.push(init);
        init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    },
  });
  try {
    h.get("text").value = "내일 일정 알려줘";
    h.get("text").oninput();
    await h.flush();
    assert.equal(h.last().open, false, "a draft closes Hey dots");
    h.get("send").onclick();
    await h.flush();
    assert.equal(pending.length, 1);
    await h.event(EVENT.LEAVE);
    assert.equal(pending[0].signal.aborted, true, "the in-flight submission is aborted");
    assert.equal(h.get("text").value, "내일 일정 알려줘", "the typed text stays");
    assert.match(h.get("status").textContent, /남아 있습니다/);
    const opens = h.opens();
    await h.event(EVENT.ENTER);
    assert.equal(h.opens(), opens, "resume keeps Hey dots closed while the draft is pending");
    assert.match(h.get("wake-status").textContent, /작성 중인 내용/);
  } finally {
    h.restore();
  }
});

/** A relay fake whose snapshot, revision and submission answers the test changes between polls. */
function relay(state) {
  state.posts = [];
  return (_url, init) => {
    if (init?.method === "POST") {
      state.posts.push(JSON.parse(init.body));
      return state.post ? state.post(init) : Promise.resolve(Response.json({ status: "stored" }));
    }
    const body = { messages: state.messages };
    if (state.revision !== undefined) body.conversation_revision = state.revision;
    return Promise.resolve(Response.json(body));
  };
}
const msg = (id, text) => ({ message_id: id, text, createdAt: "2026-10-23T00:00:00Z" });
const bodyWrites = (h) => h.writes.filter((w) => w.containerID === 1).map((w) => w.content);
const headerWrites = (h) => h.writes.filter((w) => w.containerID === 2).map((w) => w.content);

test("an owner deletion clears old replies on the phone and G2, keeps the draft, rejects older snapshots and shows new replies", async () => {
  const server = { revision: 3, messages: [msg("old-1", "삭제 전 답변 하나"), msg("old-2", "삭제 전 답변 둘")] };
  const h = await boot({ storage: ready, fetch: relay(server) });
  try {
    assert.equal(h.get("reply").textContent, "삭제 전 답변 둘");
    assert.equal(bodyWrites(h).at(-1), "삭제 전 답변 둘");
    h.get("prev-message").onclick();
    assert.equal(h.get("reply").textContent, "삭제 전 답변 하나", "the reader moved back");
    h.get("text").value = "삭제 후에도 남을 초안";
    h.get("text").oninput();
    await h.flush();
    const audio = h.audio.length;
    const writesBefore = h.storageWrites.length;
    // Same revision with a capped batch that omits an ID is not a deletion.
    server.messages = [msg("old-2", "삭제 전 답변 둘")];
    await h.fire(2500);
    assert.equal(h.get("message-position").textContent, "1 / 2개 메시지");
    // The owner deleted the conversation.
    server.revision = 4;
    server.messages = [];
    await h.fire(2500);
    assert.match(h.get("reply").textContent, /대화 기록이 삭제/);
    assert.match(h.get("status").textContent, /대화 기록이 삭제/);
    assert.match(bodyWrites(h).at(-1), /대화 기록이 삭제/, "G2 no longer shows the deleted reply");
    assert.doesNotMatch(headerWrites(h).at(-1), /답변 \d/, "no stale position in the G2 header");
    assert.equal(h.get("message-position").textContent, "아직 받은 메시지가 없습니다.");
    assert.equal(h.get("prev-message").disabled, true);
    assert.equal(h.get("next-message").disabled, true);
    assert.equal(h.get("text").value, "삭제 후에도 남을 초안", "unsent typed text stays");
    assert.equal(h.storageWrites.length, writesBefore, "pairing, key and preferences are not touched");
    assert.equal(h.audio.length, audio, "the microphone is neither opened nor closed by a deletion");
    // A snapshot read before the deletion cannot bring the replies back.
    server.revision = 3;
    server.messages = [msg("old-1", "삭제 전 답변 하나"), msg("old-2", "삭제 전 답변 둘")];
    const bodies = bodyWrites(h).length;
    await h.fire(2500);
    assert.match(h.get("reply").textContent, /대화 기록이 삭제/);
    assert.equal(h.get("message-position").textContent, "아직 받은 메시지가 없습니다.");
    assert.equal(bodyWrites(h).length, bodies, "the stale snapshot writes nothing to G2");
    // A reply written after the deletion is shown and followed as usual.
    server.revision = 4;
    server.messages = [msg("new-1", "삭제 후 새 답변")];
    await h.fire(2500);
    assert.equal(h.get("reply").textContent, "삭제 후 새 답변");
    assert.equal(bodyWrites(h).at(-1), "삭제 후 새 답변");
    assert.match(headerWrites(h).at(-1), /답변 1\/1/);
    // Once a revision is known, a response without one is dropped whole, and the baseline still refuses older ones.
    server.revision = undefined;
    server.messages = [msg("old-1", "삭제 전 답변 하나"), msg("new-1", "삭제 후 새 답변")];
    await h.fire(2500);
    assert.equal(h.get("message-position").textContent, "1 / 1개 메시지");
    server.revision = 3;
    await h.fire(2500);
    assert.equal(h.get("message-position").textContent, "1 / 1개 메시지");
    assert.equal(h.get("text").value, "삭제 후에도 남을 초안");
  } finally {
    h.restore();
  }
});

test("a submission in flight across a deletion neither redisplays old history nor claims a waiting state, and is not resent", async () => {
  let settle;
  const server = {
    revision: 1,
    messages: [msg("old-1", "삭제될 답변")],
    post: () => new Promise((resolve) => (settle = resolve)),
  };
  const h = await boot({ storage: ready, fetch: relay(server) });
  try {
    h.get("text").value = "삭제 직전 질문";
    h.get("text").oninput();
    h.get("send").onclick();
    await h.flush();
    assert.equal(server.posts.length, 1);
    server.revision = 2;
    server.messages = [];
    await h.fire(2500);
    assert.match(bodyWrites(h).at(-1), /대화 기록이 삭제/);
    settle(Response.json({ status: "accepted" }));
    await h.flush();
    assert.match(h.get("status").textContent, /지워졌을 수 있습니다/);
    assert.match(h.get("reply").textContent, /대화 기록이 삭제/, "the old reply is not restored");
    assert.match(bodyWrites(h).at(-1), /대화 기록이 삭제/, "no waiting notice replaces the deletion notice");
    assert.ok(
      !bodyWrites(h)
        .slice(-1)
        .some((b) => b.includes("삭제될 답변")),
    );
    assert.equal(h.get("text").value, "", "the relay accepted the text");
    await h.fire(2500);
    assert.equal(server.posts.length, 1, "nothing is resent");
  } finally {
    h.restore();
  }
});

test("a 410 for a deleted utterance ID is said plainly, never replayed, and a deliberate resend uses a new ID", async () => {
  const server = {
    revision: 1,
    messages: [],
    post: () => Promise.resolve(Response.json({ error: "Utterance was deleted" }, { status: 410 })),
  };
  const h = await boot({ storage: ready, fetch: relay(server) });
  try {
    h.get("text").value = "지워진 질문";
    h.get("text").oninput();
    h.get("send").onclick();
    await h.flush();
    assert.match(h.get("status").textContent, /서버가 이 질문을 받지 않았습니다/);
    assert.match(h.get("status").textContent, /자동으로 다시 보내지 않으며/);
    assert.equal(h.get("text").value, "지워진 질문", "the typed text stays");
    await h.fire(2500);
    await h.fire(2500);
    assert.equal(server.posts.length, 1, "no automatic replay");
    server.post = undefined;
    h.get("send").onclick();
    await h.flush();
    assert.equal(server.posts.length, 2);
    assert.equal(server.posts[1].text, "지워진 질문");
    assert.notEqual(server.posts[1].id, server.posts[0].id, "the resend is a new utterance");
    assert.equal(h.get("text").value, "");
    // An automatically sent transcript refused with 410 is kept in the field under a fresh ID as well.
    server.post = () => Promise.resolve(Response.json({ error: "Utterance expired" }, { status: 410 }));
    await h.event(EVENT.LONG_PRESS, "textEvent");
    await h.frame();
    await h.event(EVENT.RELEASE, "textEvent");
    h.sockets.at(-1).reply({ tokens: [{ text: "만료된 음성 질문", is_final: true }], finished: true });
    await h.flush();
    assert.equal(server.posts.length, 3);
    assert.equal(h.get("text").value, "만료된 음성 질문");
    assert.match(h.get("status").textContent, /서버가 이 질문을 받지 않았습니다/);
    await h.fire(2500);
    assert.equal(server.posts.length, 3, "the voice utterance is not replayed");
    server.post = undefined;
    h.get("send").onclick();
    await h.flush();
    assert.equal(server.posts.length, 4);
    assert.notEqual(server.posts[3].id, server.posts[2].id);
    assertNoConcurrentOpen(h.audio);
  } finally {
    h.restore();
  }
});

test("replies past the relay retention cutoff leave the phone and G2, and an older cutoff cannot bring them back", async () => {
  const day = (d) => `2026-10-${String(d).padStart(2, "0")}T00:00:00.000Z`;
  const server = {
    revision: 1,
    retention: day(1),
    messages: [
      { message_id: "m-2", text: "열흘 전 답변", createdAt: day(2) },
      { message_id: "m-legacy", text: "시각 없는 답변", createdAt: "" },
      { message_id: "m-5", text: "닷새 전 답변", createdAt: day(5) },
    ],
  };
  const fetch = relay(server);
  const h = await boot({
    storage: ready,
    fetch: async (url, init) => {
      const response = await fetch(url, init);
      if (init?.method === "POST") return response;
      return Response.json({ ...(await response.json()), retention_cutoff: server.retention });
    },
  });
  try {
    h.get("prev-message").onclick();
    h.get("prev-message").onclick();
    assert.equal(h.get("reply").textContent, "열흘 전 답변", "the reader is on the oldest reply");
    h.get("text").value = "보관 만료와 무관한 초안";
    h.get("text").oninput();
    await h.flush();
    // The relay no longer returns the expired reply, and the companion drops its cached copy.
    server.retention = day(3);
    server.messages = server.messages.slice(1);
    await h.fire(2500);
    assert.equal(h.get("message-position").textContent, "1 / 2개 메시지");
    assert.equal(
      h.get("reply").textContent,
      "시각 없는 답변",
      "an unreadable timestamp is kept and becomes the reader",
    );
    assert.equal(bodyWrites(h).at(-1), "시각 없는 답변", "G2 no longer shows the expired reply");
    assert.match(h.get("status").textContent, /보관 기간이 지난 답변/);
    // A response carrying an older cutoff and the expired reply cannot restore it.
    server.retention = day(1);
    server.messages = [{ message_id: "m-2", text: "열흘 전 답변", createdAt: day(2) }, ...server.messages];
    const bodies = bodyWrites(h).length;
    await h.fire(2500);
    assert.equal(h.get("message-position").textContent, "1 / 2개 메시지");
    assert.ok(!bodyWrites(h).slice(bodies).includes("열흘 전 답변"));
    // A reader on a newer reply that expires later moves to the oldest reply still kept.
    h.get("next-message").onclick();
    assert.equal(h.get("reply").textContent, "닷새 전 답변");
    server.retention = day(6);
    server.messages = [{ message_id: "m-legacy", text: "시각 없는 답변", createdAt: "" }];
    await h.fire(2500);
    assert.equal(h.get("reply").textContent, "시각 없는 답변");
    assert.equal(h.get("text").value, "보관 만료와 무관한 초안", "unsent typed text stays");
  } finally {
    h.restore();
  }
});

test("when the only reply on screen expires, the phone and G2 say so instead of keeping it", async () => {
  const server = {
    revision: 1,
    messages: [{ message_id: "m-1", text: "곧 만료될 답변", createdAt: "2026-09-25T00:00:00.000Z" }],
  };
  let retention = "2026-09-24T00:00:00.000Z";
  const fetch = relay(server);
  const h = await boot({
    storage: ready,
    fetch: async (url, init) =>
      Response.json({ ...(await (await fetch(url, init)).json()), retention_cutoff: retention }),
  });
  try {
    assert.equal(bodyWrites(h).at(-1), "곧 만료될 답변");
    retention = "2026-09-25T00:00:00.000Z";
    server.messages = [];
    await h.fire(2500);
    assert.match(h.get("reply").textContent, /보관 기간이 지난 답변/);
    assert.match(bodyWrites(h).at(-1), /보관 기간이 지난 답변/);
    assert.equal(h.get("message-position").textContent, "아직 받은 메시지가 없습니다.");
  } finally {
    h.restore();
  }
});

test("a reply expiring while G2 shows a waiting notice leaves the phone, and the notice stays on G2", async () => {
  const server = {
    revision: 1,
    messages: [{ message_id: "m-1", text: "대기 중 만료될 답변", createdAt: "2026-09-25T00:00:00.000Z" }],
  };
  let retention = "2026-09-24T00:00:00.000Z";
  const fetch = relay(server);
  const h = await boot({
    storage: ready,
    fetch: async (url, init) => {
      const response = await fetch(url, init);
      if (init?.method === "POST") return response;
      return Response.json({ ...(await response.json()), retention_cutoff: retention });
    },
  });
  try {
    assert.equal(h.get("reply").textContent, "대기 중 만료될 답변");
    h.get("text").value = "새 질문";
    h.get("text").oninput();
    h.get("send").onclick();
    await h.flush();
    const notice = bodyWrites(h).at(-1);
    assert.match(notice, /서버에 저장됨/, "G2 waits for the answer to the new question");
    h.get("text").value = "만료와 무관한 초안";
    h.get("text").oninput();
    await h.flush();
    const bodies = bodyWrites(h).length;
    retention = "2026-09-25T00:00:00.000Z";
    server.messages = [];
    await h.fire(2500);
    assert.match(h.get("reply").textContent, /보관 기간이 지난 답변/, "the phone no longer shows the expired reply");
    assert.deepEqual(bodyWrites(h).slice(bodies), [], "the waiting notice is not rewritten");
    assert.equal(bodyWrites(h).at(-1), notice);
    assert.equal(h.get("message-position").textContent, "아직 받은 메시지가 없습니다.");
    assert.equal(h.get("text").value, "만료와 무관한 초안", "unsent typed text stays");
    // An older cutoff cannot bring the reply back to the phone.
    retention = "2026-09-24T00:00:00.000Z";
    server.messages = [{ message_id: "m-1", text: "대기 중 만료될 답변", createdAt: "2026-09-25T00:00:00.000Z" }];
    await h.fire(2500);
    assert.match(h.get("reply").textContent, /보관 기간이 지난 답변/);
    assert.ok(!bodyWrites(h).includes("대기 중 만료될 답변", bodies));
  } finally {
    h.restore();
  }
});

test("expiry alone is not a reply: a waiting notice stays on G2 while the phone moves to a kept reply", async () => {
  const day = (d) => `2026-10-${String(d).padStart(2, "0")}T00:00:00.000Z`;
  const server = {
    revision: 1,
    messages: [
      { message_id: "m-2", text: "먼저 만료될 답변", createdAt: day(2) },
      { message_id: "m-5", text: "남을 답변", createdAt: day(5) },
    ],
  };
  let retention = day(1);
  const fetch = relay(server);
  const h = await boot({
    storage: ready,
    fetch: async (url, init) => {
      const response = await fetch(url, init);
      if (init?.method === "POST") return response;
      return Response.json({ ...(await response.json()), retention_cutoff: retention });
    },
  });
  try {
    h.get("prev-message").onclick();
    assert.equal(h.get("reply").textContent, "먼저 만료될 답변");
    h.get("text").value = "새 질문";
    h.get("text").oninput();
    h.get("send").onclick();
    await h.flush();
    const notice = bodyWrites(h).at(-1);
    assert.match(notice, /서버에 저장됨/);
    const bodies = bodyWrites(h).length;
    retention = day(3);
    server.messages = server.messages.slice(1);
    await h.fire(2500);
    assert.equal(h.get("reply").textContent, "남을 답변");
    assert.deepEqual(bodyWrites(h).slice(bodies), [], "the waiting notice is not replaced");
    assert.doesNotMatch(h.get("status").textContent, /답변 수신/, "no reply is claimed");
    // The answer that does arrive still replaces the waiting notice; the reader was on the newest kept reply.
    server.messages = [...server.messages, { message_id: "m-9", text: "새 질문의 답변", createdAt: day(9) }];
    await h.fire(2500);
    assert.equal(bodyWrites(h).at(-1), "새 질문의 답변");
    assert.equal(h.get("reply").textContent, "새 질문의 답변");
    assert.match(h.get("status").textContent, /답변 수신/);
  } finally {
    h.restore();
  }
});

test("a reply expiring during a capture moves the phone to a kept reply while the capture notice stays on G2", async () => {
  const day = (d) => `2026-10-${String(d).padStart(2, "0")}T00:00:00.000Z`;
  const server = {
    revision: 1,
    messages: [
      { message_id: "m-2", text: "먼저 만료될 답변", createdAt: day(2) },
      { message_id: "m-5", text: "남을 답변", createdAt: day(5) },
    ],
  };
  let retention = day(1);
  const fetch = relay(server);
  const h = await boot({
    storage: ready,
    fetch: async (url, init) => {
      const response = await fetch(url, init);
      if (init?.method === "POST") return response;
      return Response.json({ ...(await response.json()), retention_cutoff: retention });
    },
  });
  try {
    h.get("prev-message").onclick();
    assert.equal(h.get("reply").textContent, "먼저 만료될 답변");
    await h.event(EVENT.LONG_PRESS, "textEvent");
    await h.frame();
    assert.match(h.get("status").textContent, /녹음 중/);
    const notice = bodyWrites(h).at(-1);
    assert.match(notice, /녹음 중/);
    const bodies = bodyWrites(h).length;
    const audio = h.audio.length;
    retention = day(3);
    server.messages = server.messages.slice(1);
    await h.fire(2500);
    assert.equal(h.get("reply").textContent, "남을 답변", "the phone moves to the reply still kept");
    assert.equal(h.get("message-position").textContent, "1 / 1개 메시지");
    assert.deepEqual(bodyWrites(h).slice(bodies), [], "the capture notice is not replaced");
    assert.equal(h.audio.length, audio, "the microphone is left alone");
    assert.match(h.get("wake-status").textContent, /수동 녹음 중/);
  } finally {
    h.restore();
  }
});

test("replies cached from a legacy relay are cleared when the upgraded relay first reports a deletion", async () => {
  const server = { messages: [msg("legacy-1", "업그레이드 전 답변")] };
  const h = await boot({ storage: ready, fetch: relay(server) });
  try {
    assert.equal(h.get("reply").textContent, "업그레이드 전 답변");
    h.get("text").value = "업그레이드 후에도 남을 초안";
    h.get("text").oninput();
    await h.flush();
    const audio = h.audio.length;
    const writesBefore = h.storageWrites.length;
    // The owner deleted the conversation while the relay was being upgraded; the first revision is above zero.
    server.revision = 1;
    server.messages = [];
    await h.fire(2500);
    assert.match(h.get("reply").textContent, /대화 기록이 삭제/);
    assert.match(bodyWrites(h).at(-1), /대화 기록이 삭제/, "G2 no longer shows the legacy reply");
    assert.equal(h.get("message-position").textContent, "아직 받은 메시지가 없습니다.");
    assert.equal(h.get("text").value, "업그레이드 후에도 남을 초안");
    assert.equal(h.storageWrites.length, writesBefore);
    assert.equal(h.audio.length, audio);
  } finally {
    h.restore();
  }
});

test("a first revision of zero keeps replies cached from a legacy relay", async () => {
  const server = { messages: [msg("legacy-1", "업그레이드 전 답변")] };
  const h = await boot({ storage: ready, fetch: relay(server) });
  try {
    server.revision = 0;
    server.messages = [msg("legacy-1", "업그레이드 전 답변"), msg("new-1", "업그레이드 후 답변")];
    await h.fire(2500);
    assert.equal(h.get("message-position").textContent, "2 / 2개 메시지");
    assert.equal(h.get("reply").textContent, "업그레이드 후 답변");
    assert.doesNotMatch(h.get("status").textContent, /삭제/, "no deletion is claimed");
  } finally {
    h.restore();
  }
});

test("after a deletion, a response with a missing or invalid revision never brings old replies back", async () => {
  const server = { revision: 1, messages: [msg("old-1", "삭제 전 답변")] };
  const h = await boot({ storage: ready, fetch: relay(server) });
  try {
    server.revision = 2;
    server.messages = [];
    await h.fire(2500);
    assert.match(h.get("reply").textContent, /대화 기록이 삭제/);
    const bodies = bodyWrites(h).length;
    for (const revision of [undefined, "3", -1, 2.5, null]) {
      server.revision = revision;
      server.messages = [msg("old-1", "삭제 전 답변")];
      await h.fire(2500);
      assert.equal(h.get("message-position").textContent, "아직 받은 메시지가 없습니다.", `revision ${revision}`);
      assert.match(h.get("reply").textContent, /대화 기록이 삭제/);
      assert.match(h.get("status").textContent, /표시하지 않았습니다/, "the dropped response is reported");
    }
    assert.equal(bodyWrites(h).length, bodies, "nothing old is written to G2");
    server.revision = 2;
    server.messages = [msg("new-1", "삭제 후 새 답변")];
    await h.fire(2500);
    assert.equal(h.get("reply").textContent, "삭제 후 새 답변");
  } finally {
    h.restore();
  }
});

test("a submission in flight when the upgraded relay first reports a deletion claims no waiting state", async () => {
  for (const messages of [[msg("legacy-1", "업그레이드 전 답변")], []]) {
    let settle;
    const server = { messages, post: () => new Promise((resolve) => (settle = resolve)) };
    const h = await boot({ storage: ready, fetch: relay(server) });
    try {
      h.get("text").value = "업그레이드 중 질문";
      h.get("text").oninput();
      h.get("send").onclick();
      await h.flush();
      assert.equal(server.posts.length, 1);
      server.revision = 3;
      server.messages = [];
      await h.fire(2500);
      const bodies = bodyWrites(h).length;
      settle(Response.json({ status: "accepted" }));
      await h.flush();
      assert.match(h.get("status").textContent, /지워졌을 수 있습니다/);
      assert.equal(bodyWrites(h).length, bodies, "no waiting notice and no old reply reach G2");
      assert.doesNotMatch(h.get("reply").textContent, /업그레이드 전 답변/);
      await h.fire(2500);
      assert.equal(server.posts.length, 1, "nothing is resent");
    } finally {
      h.restore();
    }
  }
});

test("a relay that never reports a revision keeps the append-only behavior", async () => {
  const server = { messages: [msg("a", "첫 답변")], post: undefined };
  const h = await boot({ storage: ready, fetch: relay(server) });
  try {
    server.messages = [msg("b", "둘째 답변")];
    await h.fire(2500);
    assert.equal(h.get("message-position").textContent, "2 / 2개 메시지");
    assert.equal(h.get("reply").textContent, "둘째 답변");
    server.messages = [];
    await h.fire(2500);
    assert.equal(h.get("message-position").textContent, "2 / 2개 메시지", "an empty batch is not a deletion");
    h.get("text").value = "레거시 질문";
    h.get("text").oninput();
    h.get("send").onclick();
    await h.flush();
    assert.equal(server.posts.length, 1);
    assert.equal(h.get("text").value, "");
    server.messages = [msg("c", "셋째 답변")];
    await h.fire(2500);
    assert.equal(h.get("reply").textContent, "셋째 답변");
    assert.doesNotMatch(h.get("status").textContent, /삭제|표시하지 않았습니다/);
  } finally {
    h.restore();
  }
});
