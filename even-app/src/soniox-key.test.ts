import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SONIOX_KEY_STORAGE, SonioxKey, type KeyStorage } from "./soniox-key.ts";

const KEY = "snx_sentinel_key_0123456789";
const OTHER = "snx_replacement_key_9876543210";

function storage(initial = "") {
  const values = new Map<string, string>([[SONIOX_KEY_STORAGE, initial]]);
  const writes: string[] = [];
  let failing = false;
  const store: KeyStorage = {
    getLocalStorage: async (key) => values.get(key) ?? "",
    setLocalStorage: async (key, value) => {
      if (failing) return false;
      writes.push(value);
      values.set(key, value);
      return true;
    },
  };
  return {
    store,
    writes,
    stored: () => values.get(SONIOX_KEY_STORAGE),
    fail: (value: boolean) => (failing = value),
  };
}

test("keys stay in memory by default and the stored copy is overwritten with nothing", async () => {
  const s = storage(KEY);
  const keys = new SonioxKey(() => s.store);
  assert.equal(await keys.apply(`  ${OTHER}\n`, false), "memory");
  assert.equal(keys.value, OTHER);
  assert.equal(keys.remembered, false);
  assert.equal(s.stored(), "");
  assert.ok(!s.writes.includes(OTHER));
});

test("remembering is an explicit opt-in through SDK storage and can be turned off", async () => {
  const s = storage();
  const keys = new SonioxKey(() => s.store);
  assert.equal(await keys.apply(KEY, true), "remembered");
  assert.equal(s.stored(), KEY);
  assert.equal(await keys.remember(false), "memory");
  assert.equal(s.stored(), "");
  assert.equal(keys.value, KEY, "turning off remembering keeps the in-memory key");
  assert.equal(await keys.remember(true), "remembered");
  assert.equal(s.stored(), KEY);
});

test("replace and clear remove the persisted key and bump the revision", async () => {
  const s = storage();
  let changes = 0;
  const keys = new SonioxKey(
    () => s.store,
    () => changes++,
  );
  await keys.apply(KEY, true);
  const revision = keys.revision;
  await keys.apply(OTHER, false);
  assert.ok(keys.revision > revision);
  assert.equal(s.stored(), "");
  await keys.apply(KEY, true);
  assert.equal(await keys.clear(), true);
  assert.equal(keys.value, undefined);
  assert.equal(keys.remembered, false);
  assert.equal(s.stored(), "");
  assert.equal(changes, 4);
});

test("a failed storage write is reported as unconfirmed, never as removed or remembered", async () => {
  const s = storage(KEY);
  const keys = new SonioxKey(() => s.store);
  await keys.restore();
  s.fail(true);
  assert.equal(await keys.clear(), false);
  assert.equal(keys.remembered, false);
  assert.equal(await keys.apply(OTHER, true), "unconfirmed");
  assert.equal(keys.value, OTHER);
  assert.equal(keys.remembered, false);
});

test("a failed clear stays unconfirmed until a retry actually removes the stored key", async () => {
  const s = storage(KEY);
  const keys = new SonioxKey(() => s.store);
  await keys.restore();
  s.fail(true);
  assert.equal(await keys.clear(), false);
  assert.equal(keys.value, undefined);
  assert.equal(keys.unconfirmed, true, "the stored copy may still exist, so clearing must stay available");
  assert.equal(s.stored(), KEY);
  s.fail(false);
  assert.equal(await keys.clear(), true);
  assert.equal(keys.unconfirmed, false);
  assert.equal(s.stored(), "");
});

test("a write that settles after a newer key change never publishes stale state", async () => {
  const values: string[] = [];
  let release: () => void = () => {};
  let first = true;
  const store: KeyStorage = {
    getLocalStorage: async () => "",
    setLocalStorage: (_, value) => {
      values.push(value);
      if (!first) return Promise.resolve(true);
      first = false;
      return new Promise<boolean>((resolve) => (release = () => resolve(true)));
    },
  };
  const keys = new SonioxKey(() => store);
  const remembering = keys.apply(KEY, true);
  await new Promise((resolve) => setImmediate(resolve));
  const clearing = keys.clear();
  release();
  await remembering;
  assert.equal(keys.remembered, false, "the superseded remember write must not mark the cleared key remembered");
  assert.equal(await clearing, true);
  assert.deepEqual(values, [KEY, ""]);
  assert.equal(keys.remembered, false);
});

test("restores a remembered key, but never over a key the user applied meanwhile", async () => {
  const s = storage(KEY);
  const restored = new SonioxKey(() => s.store);
  assert.equal(await restored.restore(), true);
  assert.equal(restored.value, KEY);
  assert.equal(restored.remembered, true);

  const racing = new SonioxKey(() => s.store);
  const loading = racing.restore();
  const applying = racing.apply(OTHER, false);
  assert.equal(await loading, false);
  assert.equal(await applying, "memory");
  assert.equal(racing.value, OTHER);
  assert.equal(s.stored(), "");
});

test("malformed input or stored values are rejected without echoing the key", async () => {
  const s = storage(`${KEY} with spaces`);
  const keys = new SonioxKey(() => s.store);
  assert.equal(await keys.restore(), false);
  assert.equal(s.stored(), "");
  for (const bad of ["", "short", `${KEY},x`, `${KEY} ${KEY}`]) {
    const error = await keys.apply(bad, true).catch((e: unknown) => e);
    assert.ok(error instanceof Error);
    assert.ok(!error.message.includes(KEY));
  }
  assert.equal(keys.value, undefined);
});

test("a malformed stored value whose removal fails stays unconfirmed so it can still be cleared", async () => {
  const s = storage(`${KEY} with spaces`);
  s.fail(true);
  const keys = new SonioxKey(() => s.store);
  assert.equal(await keys.restore(), false);
  assert.equal(keys.value, undefined);
  assert.equal(keys.unconfirmed, true);
  s.fail(false);
  assert.equal(await keys.clear(), true);
  assert.equal(keys.unconfirmed, false);
  assert.equal(s.stored(), "");
});

test("production sources never fall back to browser storage or log", () => {
  for (const file of ["soniox-key.ts", "soniox-transcriber.ts", "main.ts"]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.ok(!/localStorage|sessionStorage|indexedDB/i.test(source.replace(/[gs]etLocalStorage/g, "")), file);
    assert.ok(!/console\./.test(source), file);
  }
});
