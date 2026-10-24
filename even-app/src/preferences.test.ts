import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PREFERENCES, PREFERENCES_STORAGE, PreferenceStore, parsePreferences } from "./preferences.ts";

test("defaults apply only when nothing was saved, and an untrustworthy value is unknown", () => {
  assert.deepEqual(parsePreferences(""), DEFAULT_PREFERENCES);
  assert.deepEqual(parsePreferences('{"wake":false,"autoSend":true}'), { wake: false, autoSend: true });
  for (const raw of ["{", "null", '{"wake":false}', '{"wake":"no","autoSend":true}'])
    assert.equal(parsePreferences(raw), undefined, raw);
});

test("writes are serialized and only the latest choice reports its result", async () => {
  const stored: string[] = [];
  const results = [false, true];
  const store = new PreferenceStore(() => ({
    getLocalStorage: async () => {
      throw new Error("unreadable");
    },
    setLocalStorage: async (key, value) => {
      assert.equal(key, PREFERENCES_STORAGE);
      stored.push(value);
      return results.shift()!;
    },
  }));
  assert.equal(await store.restore(), undefined, "a failed read is unknown, not the defaults");
  const first = store.save({ wake: false, autoSend: true });
  const second = store.save({ wake: true, autoSend: true });
  assert.equal(await first, undefined, "a superseded write does not report");
  assert.equal(await second, true);
  assert.deepEqual(
    stored.map((value) => JSON.parse(value)),
    [
      { wake: false, autoSend: true },
      { wake: true, autoSend: true },
    ],
  );
});
