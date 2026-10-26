import test from "node:test";
import assert from "node:assert/strict";
import { hash } from "../lib/relay/core.ts";
import { checkPairing, clearPairing, restorePairing, savePairing } from "../lib/pairing-session.ts";

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

// Controlled GET /api/pairing responses, resolved in the order a test chooses.
// checkPairing compares against the real clock, so these codes expire well after the test.
const live = new Date(Date.now() + 600_000).toISOString();
function deferred() {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
}

test("a late create from the previous account is not shown after the new account's check cleared the code", async () => {
  const storage = new MemoryStorage();
  const latest = { current: 0 };
  latest.current++; // Account A starts a create; its POST is held.
  // Account B signs in and refreshes this tab; B has no active code.
  const refreshVersion = ++latest.current;
  assert.equal(await checkPairing(storage, latest, async () => null, refreshVersion), null);
  // A's response arrives late. The dashboard saves it and checks it against the owner signed in now (B).
  const created = { code, expiresAt: live };
  savePairing(storage, created);
  assert.equal(await checkPairing(storage, latest, async () => null), null);
  assert.equal(storage.items.size, 0);
});

test("a refresh during a create cannot hide the created code with a server state read before the write", async () => {
  const storage = new MemoryStorage();
  const latest = { current: 0 };
  const old = { code: "e".repeat(64), expiresAt: live };
  savePairing(storage, old);
  latest.current++; // Same owner starts a create.
  const refreshVersion = ++latest.current;
  const beforeWrite = deferred();
  const refreshCheck = checkPairing(storage, latest, () => beforeWrite.promise, refreshVersion);
  // The create response arrives and its own check starts after the refresh's check.
  const created = { code, expiresAt: live };
  savePairing(storage, created);
  const createCheck = checkPairing(storage, latest, () => active(code, live));
  beforeWrite.resolve(await active(old.code, live));
  assert.equal(await refreshCheck, undefined);
  assert.deepEqual(await createCheck, created);
  assert.deepEqual(JSON.parse(storage.getItem("even-hub-pairing")), created);
});

test("a check started after a create's own check decides, and an older check cannot erase a newer code", async () => {
  const storage = new MemoryStorage();
  const latest = { current: 0 };
  const created = { code, expiresAt: live };
  savePairing(storage, created);
  const createGet = deferred();
  const createCheck = checkPairing(storage, latest, () => createGet.promise);
  // The account changes and a refresh starts after the create's check: its result is the one that counts.
  const refreshCheck = checkPairing(storage, latest, async () => null);
  assert.equal(await refreshCheck, null);
  createGet.resolve(await active(code, live));
  assert.equal(await createCheck, undefined);
  assert.equal(storage.items.size, 0);
  // A failed GET from a check that started before a newer create does not erase the newer create's code.
  const staleVersion = ++latest.current;
  latest.current++; // A newer create starts and saves its code.
  savePairing(storage, created);
  assert.equal(
    await checkPairing(storage, latest, async () => Promise.reject(new Error("401")), staleVersion),
    undefined,
  );
  assert.deepEqual(JSON.parse(storage.getItem("even-hub-pairing")), created);
});
