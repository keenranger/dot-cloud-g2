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

const LIVE = "실시간 인식 (미확정)";
const FINISHING = "전사 마무리 중 · 미확정 · 아직 전송 전";
const partial = (socket, ...tokens) =>
  socket.reply({ tokens: tokens.map(([text, is_final = false]) => ({ text, is_final })) });
const bodies = (h) => h.writes.filter((w) => w.containerID === 1).map((w) => w.content);
/** Records every text the phone display status (a polite live region) is set to. */
function announcements(h) {
  const display = h.get("display");
  const said = [];
  let text = display.textContent;
  Object.defineProperty(display, "textContent", {
    get: () => text,
    set: (value) => {
      text = value;
      said.push(value);
    },
  });
  return said;
}

test("manual hold shows Soniox running text on G2 as unconfirmed, paced by acknowledgements, and submits only the final", async () => {
  const held = [];
  let hold = false;
  const h = await boot({
    storage: ready,
    write: (update) => (hold && update.containerID === 1 ? new Promise((resolve) => held.push(resolve)) : true),
  });
  try {
    await h.event(EVENT.LONG_PRESS, "textEvent");
    await h.frame();
    const socket = h.sockets.at(-1);
    assert.equal(
      bodies(h).at(-1),
      "녹음 중 · 손을 떼면 전사 후 전송합니다.",
      "the instruction shows until speech is heard",
    );
    const said = announcements(h);
    partial(socket, ["내일"]);
    await h.flush();
    assert.equal(bodies(h).at(-1), `${LIVE}\n내일`);
    assert.equal(h.get("partial").textContent, "실시간 인식 (미확정): 내일", "the phone keeps its own running text");
    // A slow G2 acknowledgement: partials arriving meanwhile are coalesced into one write of the newest text.
    hold = true;
    partial(socket, ["내일 ", true], ["일정", false]);
    await h.flush();
    const inFlight = bodies(h).length;
    for (const text of ["일정 알", "일정 알려", "일정 알려줘"]) {
      partial(socket, [text]);
      await h.flush();
    }
    assert.equal(bodies(h).length, inFlight, "nothing more is written while one update is unacknowledged");
    hold = false;
    held.shift()(true);
    await h.flush();
    assert.equal(bodies(h).length, inFlight + 1, "one write follows the acknowledgement");
    assert.equal(bodies(h).at(-1), `${LIVE}\n내일 일정 알려줘`, "and it carries the newest running text");
    assert.deepEqual(said, ["G2에 실시간 인식(미확정) 표시 중"], "the live region is not re-announced per partial");
    assert.equal(h.posts.length, 0, "running text is never submitted");
    // Release keeps what was heard under a finishing label until Soniox finishes.
    await h.event(EVENT.RELEASE, "textEvent");
    assert.equal(bodies(h).at(-1), `${FINISHING}\n내일 일정 알려줘`);
    partial(socket, ["일정 알려줘요"]);
    await h.flush();
    assert.equal(bodies(h).at(-1), `${FINISHING}\n내일 일정 알려줘요`);
    socket.reply({ tokens: [{ text: "일정 알려줘요", is_final: true }], finished: true });
    await h.flush();
    assert.equal(h.posts.length, 1, "exactly one submission");
    assert.equal(JSON.parse(h.posts[0].body).text, "내일 일정 알려줘요", "only the final transcript is sent");
    assert.match(bodies(h).at(-1), /^서버에 저장됨/, "the submission notice replaces the running text");
    assert.equal(h.get("partial").hidden, true);
  } finally {
    h.restore();
  }
});

test("a reply arriving during Hey dots speech waits behind the running text and is shown once the capture is submitted", async () => {
  const messages = [];
  const h = await boot({ storage: ready, messages });
  try {
    await h.frame();
    const detector = h.detectors.at(-1);
    detector.event({ type: "wake" });
    await h.flush();
    assert.equal(bodies(h).at(-1), "Hey dots 감지됨 · 질문을 말하세요.");
    detector.event({ type: "audio", pcm: new Uint8Array(640) });
    await h.flush();
    const socket = h.sockets.at(-1);
    partial(socket, ["오늘 날씨"]);
    await h.flush();
    assert.equal(bodies(h).at(-1), `${LIVE}\n오늘 날씨`);
    messages.push({ message_id: "earlier", text: "이전 질문의 답변", createdAt: "2026-10-24T00:00:00Z" });
    await h.fire(2500);
    assert.equal(h.get("reply").textContent, "이전 질문의 답변", "the phone shows the reply at once");
    assert.match(h.get("status").textContent, /전송 후 표시/);
    assert.equal(bodies(h).at(-1), `${LIVE}\n오늘 날씨`, "the reply does not take the G2 body from the speaker");
    partial(socket, ["오늘 날씨 어때"]);
    await h.flush();
    assert.equal(bodies(h).at(-1), `${LIVE}\n오늘 날씨 어때`, "running text keeps updating");
    detector.event({ type: "clip", wav: new Uint8Array(684), seconds: 1 });
    await h.flush();
    assert.equal(bodies(h).at(-1), `${FINISHING}\n오늘 날씨 어때`);
    socket.reply({ tokens: [{ text: "오늘 날씨 어때", is_final: true }], finished: true });
    await h.flush();
    assert.equal(h.posts.length, 1);
    assert.equal(JSON.parse(h.posts[0].body).text, "오늘 날씨 어때");
    assert.equal(bodies(h).at(-1), "이전 질문의 답변", "the waiting reply is shown after submission");
    assert.match(h.get("status").textContent, /최신 답변/);
  } finally {
    h.restore();
  }
});

test("moving to a message ends the G2 running text, and finishing does not bring it back", async () => {
  const h = await boot({
    storage: ready,
    messages: [
      { message_id: "a", text: "첫 답변", createdAt: "2026-10-24T00:00:00Z" },
      { message_id: "b", text: "둘째 답변", createdAt: "2026-10-24T00:00:01Z" },
    ],
  });
  try {
    await h.event(EVENT.LONG_PRESS, "textEvent");
    await h.frame();
    const socket = h.sockets.at(-1);
    partial(socket, ["질문"]);
    await h.flush();
    assert.equal(bodies(h).at(-1), `${LIVE}\n질문`);
    h.get("prev-message").onclick();
    await h.flush();
    assert.equal(bodies(h).at(-1), "첫 답변");
    const after = bodies(h).length;
    partial(socket, ["질문 하나"]);
    await h.flush();
    assert.equal(bodies(h).length, after, "running text no longer writes over the chosen message");
    await h.event(EVENT.RELEASE, "textEvent");
    partial(socket, ["질문 하나요"]);
    await h.flush();
    assert.equal(bodies(h).at(-1), "음성 전사 마무리 중 · 아직 전송 전", "the finishing notice stays plain");
    assert.ok(
      bodies(h)
        .slice(after)
        .every((body) => !body.includes("미확정")),
    );
    socket.reply({ tokens: [{ text: "질문 하나요", is_final: true }], finished: true });
    await h.flush();
    assert.equal(h.posts.length, 1);
  } finally {
    h.restore();
  }
});

test("late running text after a pause, a new cue, Hey dots off or a host exit never reaches G2", async () => {
  const late = (handler, text) => handler({ data: JSON.stringify({ tokens: [{ text, is_final: false }] }) });
  const paused = await boot({ storage: ready });
  try {
    await paused.event(EVENT.LONG_PRESS, "textEvent");
    await paused.frame();
    const socket = paused.sockets.at(-1);
    const handler = socket.onmessage;
    partial(socket, ["멈추기 전"]);
    await paused.flush();
    await paused.event(EVENT.LEAVE);
    const after = bodies(paused).length;
    late(handler, "멈춘 뒤");
    await paused.flush();
    await paused.event(EVENT.ENTER);
    assert.ok(
      bodies(paused)
        .slice(after)
        .every((body) => !body.includes("미확정")),
      "no unconfirmed text after cancel",
    );
    assert.match(bodies(paused).at(-1), /음성 입력을 멈췄습니다/, "resume says the capture stopped");
    assert.equal(paused.posts.length, 0);
  } finally {
    paused.restore();
  }
  const recue = await boot({ storage: ready });
  try {
    await recue.frame();
    const detector = recue.detectors.at(-1);
    detector.event({ type: "wake" });
    await recue.flush();
    detector.event({ type: "audio", pcm: new Uint8Array(640) });
    await recue.flush();
    const first = recue.sockets.at(-1);
    const handler = first.onmessage;
    partial(first, ["첫 신호"]);
    await recue.flush();
    detector.event({ type: "wake" });
    await recue.flush();
    assert.equal(bodies(recue).at(-1), "Hey dots 감지됨 · 질문을 말하세요.", "a new cue starts from its instruction");
    late(handler, "첫 신호 늦게");
    await recue.flush();
    assert.equal(bodies(recue).at(-1), "Hey dots 감지됨 · 질문을 말하세요.", "the withdrawn session cannot write");
  } finally {
    recue.restore();
  }
  const off = await boot({ storage: ready });
  try {
    await off.frame();
    const detector = off.detectors.at(-1);
    detector.event({ type: "wake" });
    await off.flush();
    detector.event({ type: "audio", pcm: new Uint8Array(640) });
    await off.flush();
    const socket = off.sockets.at(-1);
    const handler = socket.onmessage;
    partial(socket, ["취소될 말"]);
    await off.flush();
    assert.equal(bodies(off).at(-1), `${LIVE}\n취소될 말`);
    off.get("wake-enabled").checked = false;
    off.get("wake-enabled").onchange();
    await off.flush();
    assert.equal(socket.closed, true);
    assert.equal(
      bodies(off).at(-1),
      "Hey dots 감지됨 · 질문을 말하세요.",
      "a cancelled capture drops its unconfirmed text",
    );
    late(handler, "취소된 뒤");
    await off.flush();
    assert.equal(bodies(off).at(-1), "Hey dots 감지됨 · 질문을 말하세요.");
    assert.equal(off.posts.length, 0);
  } finally {
    off.restore();
  }
  const exited = await boot({ storage: ready });
  try {
    await exited.event(EVENT.LONG_PRESS, "textEvent");
    await exited.frame();
    const handler = exited.sockets.at(-1).onmessage;
    await exited.event(EVENT.SYSTEM_EXIT);
    const writes = exited.writes.length;
    late(handler, "종료 뒤");
    await exited.flush();
    assert.equal(exited.writes.length, writes, "nothing is written after a host exit");
  } finally {
    exited.restore();
  }
});

test("long Korean running text is shown whole up to the update limit, then keeps its newest part", async () => {
  const h = await boot({ storage: ready });
  try {
    await h.event(EVENT.LONG_PRESS, "textEvent");
    await h.frame();
    const socket = h.sockets.at(-1);
    const whole = "가나다라 ".repeat(395);
    partial(socket, [whole]);
    await h.flush();
    assert.equal(bodies(h).at(-1), `${LIVE}\n${whole.trim()}`, "1,974 units stay whole: no pagination");
    const over = "앞".repeat(1500) + "😀".repeat(600) + "끝";
    partial(socket, [over]);
    await h.flush();
    const body = bodies(h).at(-1);
    assert.ok(body.length <= 2000, "within the SDK's 2,000-unit update limit");
    assert.ok(body.startsWith(`${LIVE}\n…`));
    assert.ok(body.endsWith("😀끝"));
    assert.equal(body.isWellFormed(), true);
    const update = h.writes.findLast((w) => w.containerID === 1);
    assert.equal(update.contentLength, update.content.length);
  } finally {
    h.restore();
  }
});
