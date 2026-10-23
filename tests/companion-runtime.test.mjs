import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "../even-app/node_modules/typescript/lib/typescript.js";

// Execute the real companion entry point, replacing only the DOM/host/HTTP boundaries.
// No provider, account, device, or network credentials are used.
test("same-message display recovery, locked-phone polling, unload and confirmed host exit", async () => {
  const saved = new Map();
  const names = ["document", "window", "fetch", "setTimeout", "clearTimeout", "__runtimeBridge"];
  for (const name of names) saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  const elements = new Map();
  const listeners = new Map();
  const timers = new Map();
  let timerId = 0;
  let polls = 0;
  let onHostEvent;
  let failBody = true;
  let failHeader = true;
  const writes = [];
  const shutdown = [];
  const get = (id) => {
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
  const listen = (name, callback) => listeners.set(name, callback);
  const host = {
    _ready: true,
    async createStartUpPageContainer() {
      return 0;
    },
    onEvenHubEvent(callback) {
      onHostEvent = callback;
    },
    async getLocalStorage(key) {
      return key === "dot-cloud-device-v1"
        ? JSON.stringify({ origin: "https://fixture.example", token: "synthetic-device-token" })
        : "";
    },
    async textContainerUpgrade(update) {
      writes.push(update);
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
    async shutDownPageContainer(mode) {
      shutdown.push(mode);
      return true;
    },
  };
  globalThis.document = { hidden: false, getElementById: get, addEventListener: listen };
  globalThis.window = { addEventListener: listen };
  globalThis.__runtimeBridge = host;
  globalThis.fetch = async () => {
    polls++;
    return new Response(
      JSON.stringify({
        messages: [{ message_id: "fixture-reply", text: "안경 답변 확인", createdAt: "2026-10-23T00:00:00Z" }],
      }),
      { status: 200 },
    );
  };
  globalThis.setTimeout = (callback, ms) => {
    const id = ++timerId;
    timers.set(id, { callback, ms });
    return id;
  };
  globalThis.clearTimeout = (id) => timers.delete(id);
  const flush = async () => {
    for (let i = 0; i < 50; i++) await Promise.resolve();
  };
  const nextPoll = async () => {
    const entry = [...timers].find(([, timer]) => timer.ms === 2500);
    assert.ok(entry, "poll remains scheduled");
    timers.delete(entry[0]);
    entry[1].callback();
    await flush();
  };
  try {
    let source = readFileSync(new URL("../even-app/src/main.ts", import.meta.url), "utf8");
    source = source.replace(
      /import \{[\s\S]*?\} from "@evenrealities\/even_hub_sdk";/,
      `const AudioInputSource = {Phone: 1}; const OsEventTypeList = {DOUBLE_CLICK_EVENT:3,SYSTEM_EXIT_EVENT:7,ABNORMAL_EXIT_EVENT:6};
       const CreateStartUpPageContainer = class {constructor(p){Object.assign(this,p)}};
       const TextContainerProperty = CreateStartUpPageContainer; const TextContainerUpgrade = CreateStartUpPageContainer;
       const waitForEvenAppBridge = async () => globalThis.__runtimeBridge;`,
    );
    source = source.replace('import "./style.css";', "");
    source = source.replace(
      /from "(\.\/[^"]+)"/g,
      (_, path) => `from "${new URL("../even-app/src/" + path.slice(2), import.meta.url).href}"`,
    );
    const emitted = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    await import("data:text/javascript;base64," + Buffer.from(emitted).toString("base64"));
    await flush();
    assert.equal(get("reply").textContent, "안경 답변 확인");
    assert.match(get("display").textContent, /실패/);
    const firstBodies = writes.filter((w) => w.containerID === 1).length;
    await nextPoll();
    assert.equal(
      writes.filter((w) => w.containerID === 1).length,
      firstBodies + 1,
      "unchanged server reply retries its failed body",
    );
    assert.match(get("display").textContent, /확인했습니다/);
    const acknowledgedBodies = writes.filter((w) => w.containerID === 1).length;
    await nextPoll();
    assert.equal(
      writes.filter((w) => w.containerID === 1).length,
      acknowledgedBodies,
      "acknowledged reply keeps native scroll",
    );
    document.hidden = true;
    listeners.get("visibilitychange")();
    const beforeLockPoll = polls;
    await nextPoll();
    assert.equal(polls, beforeLockPoll + 1, "phone lock does not pause a ready glasses session");
    onHostEvent({ textEvent: { eventType: 3 } });
    await flush();
    assert.deepEqual(shutdown, [1], "root double tap uses system confirmation");
    await nextPoll(); // A cancelled confirmation has not ended the session.
    listeners.get("pagehide")();
    assert.equal(
      [...timers.values()].some((t) => t.ms === 2500),
      false,
      "unload stops polling",
    );
    listeners.get("pageshow")();
    await flush();
    onHostEvent({ sysEvent: { eventType: 7 } });
    await flush();
    assert.equal(
      [...timers.values()].some((t) => t.ms === 2500),
      false,
      "confirmed host exit stops polling",
    );
    const afterExit = polls;
    listeners.get("pageshow")();
    await flush();
    assert.equal(polls, afterExit, "a terminated session cannot resume");
  } finally {
    for (const name of names) {
      const d = saved.get(name);
      if (d) Object.defineProperty(globalThis, name, d);
      else delete globalThis[name];
    }
  }
});
