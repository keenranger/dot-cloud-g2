import test from "node:test";
import assert from "node:assert/strict";
import { hash } from "../lib/relay/core.ts";
import { clearPairing, restorePairing, savePairing } from "../lib/pairing-session.ts";

class MemoryStorage {
  items = new Map();
  getItem(key) {
    return this.items.get(key) ?? null;
  }
  setItem(key, value) {
    this.items.set(key, String(value));
  }
  removeItem(key) {
    this.items.delete(key);
  }
}
const code = "a".repeat(64);
const expiresAt = new Date(600_000).toISOString();
const active = async (value = code, at = expiresAt) => ({ fingerprint: await hash(value), expiresAt: at });

test("a saved code survives a reload only while the server reports it as the owner's active code", async () => {
  const storage = new MemoryStorage();
  savePairing(storage, { code, expiresAt });
  assert.deepEqual(await restorePairing(storage, await active(), 1000), { code, expiresAt });
  // Restoring does not extend the stored expiry.
  assert.deepEqual(JSON.parse([...storage.items.values()][0]), { code, expiresAt });
});

test("a stored code is erased when expired, replaced, missing on the server or from another account", async (t) => {
  for (const [name, state, now] of [
    ["expired", await active(), 600_000],
    ["no active code (revoked, expired or another account without one)", null, 1000],
    ["replaced by a newer code or another account's code", await active("b".repeat(64)), 1000],
    ["different expiry", await active(code, new Date(700_000).toISOString()), 1000],
  ])
    await t.test(name, async () => {
      const storage = new MemoryStorage();
      savePairing(storage, { code, expiresAt });
      assert.equal(await restorePairing(storage, state, now), null);
      assert.equal(storage.items.size, 0);
    });
});

test("malformed entries, clearing and unavailable storage fail closed", async () => {
  const storage = new MemoryStorage();
  storage.setItem("even-hub-pairing", "{not json");
  assert.equal(await restorePairing(storage, await active(), 1000), null);
  assert.equal(storage.items.size, 0);
  storage.setItem("even-hub-pairing", JSON.stringify({ code: "XYZ", expiresAt }));
  assert.equal(await restorePairing(storage, await active("XYZ"), 1000), null);
  savePairing(storage, { code, expiresAt });
  clearPairing(storage);
  assert.equal(storage.items.size, 0);
  const throwing = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
    removeItem() {
      throw new Error("blocked");
    },
  };
  savePairing(throwing, { code, expiresAt });
  clearPairing(throwing);
  assert.equal(await restorePairing(throwing, await active(), 1000), null);
  assert.equal(await restorePairing(null, await active(), 1000), null);
});

test("a code saved while an older server check runs is not erased by that check", async () => {
  const storage = new MemoryStorage();
  savePairing(storage, { code, expiresAt });
  const newer = { code: "c".repeat(64), expiresAt };
  const getItem = storage.getItem.bind(storage);
  let reads = 0;
  storage.getItem = (k) => {
    const value = getItem(k);
    if (++reads === 1) savePairing(storage, newer);
    return value;
  };
  assert.equal(await restorePairing(storage, await active("d".repeat(64)), 1000), null);
  assert.deepEqual(JSON.parse(getItem("even-hub-pairing")), newer);
});
