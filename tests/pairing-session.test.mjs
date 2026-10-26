import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hash } from "../lib/relay/core.ts";
import {
  checkPairing,
  confirmCreated,
  fence,
  fingerprint,
  forgetLegacyPairing,
  revealPairing,
} from "../lib/pairing-session.ts";

const code = "a".repeat(64);
const other = "b".repeat(64);
const active = async (value = code) => ({
  fingerprint: await hash(value),
  createdAt: "2026-10-26T00:00:00.000Z",
  revealable: true,
  expiresAt: null,
});
const reveal = async (value = code) => ({ code: value, fingerprint: await hash(value) });
function deferred() {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
}

test("the browser fingerprint matches the server's key hash", async () => {
  assert.equal(await fingerprint(code), await hash(code));
});

test("only the earlier dashboard's tab cache entry is removed, and unavailable storage is tolerated", () => {
  const removed = [];
  forgetLegacyPairing({ removeItem: (key) => removed.push(key) });
  assert.deepEqual(removed, ["even-hub-pairing"]);
  forgetLegacyPairing({
    removeItem() {
      throw new Error("blocked");
    },
  });
  forgetLegacyPairing(null);
});

test("the dashboard writes no key to browser storage and puts none in a URL", () => {
  const source = readFileSync(new URL("../app/components/dashboard.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /(sessionStorage|localStorage)\.setItem|setItem\(/);
  assert.doesNotMatch(source, /indexedDB|document\.cookie|history\.(push|replace)State/);
  assert.match(source, /fetch\("\/api\/pairing\/reveal", \{ method: "POST", cache: "no-store" \}\)/);
});

test("a failed state check reports the key as unavailable, never as absent", async () => {
  const latest = { current: 0 };
  assert.equal(await checkPairing(latest, async () => Promise.reject(new Error("401"))), "unavailable");
  assert.equal(await checkPairing(latest, async () => null), null);
  assert.deepEqual(await checkPairing(latest, () => active()), await active());
});

test("a created key is confirmed only by the owner signed in now, and its plaintext is not returned", async () => {
  const latest = { current: 0 };
  assert.deepEqual(await confirmCreated(latest, { code }, () => active()), { active: await active(), confirmed: true });
  // The account changed while the POST was in flight: the signed-in owner has another key or none.
  for (const state of [await active(other), null, "unavailable"]) {
    const result = await confirmCreated(latest, { code }, async () =>
      state === "unavailable" ? Promise.reject(new Error("401")) : state,
    );
    assert.equal(result.confirmed, false);
    assert(!JSON.stringify(result).includes(code));
  }
});

test("a late create from the previous account cannot overwrite a newer refresh", async () => {
  const latest = { current: 0 };
  latest.current++; // Account A starts a create; its POST is held.
  const createGet = deferred();
  const createCheck = confirmCreated(latest, { code }, () => createGet.promise);
  // Account B signs in and refreshes; the refresh's check starts after the create's check.
  assert.equal(await checkPairing(latest, async () => null), null);
  createGet.resolve(await active(code));
  assert.equal(await createCheck, undefined);
  // An older check that fails after a newer operation started cannot mark the newer state unavailable.
  const stale = ++latest.current;
  latest.current++;
  assert.equal(await checkPairing(latest, async () => Promise.reject(new Error("401")), stale), undefined);
});

test("a reveal is shown only for the key the page names, and any newer operation discards it", async () => {
  const latest = { current: 3 };
  assert.deepEqual(await revealPairing(fence(latest), await active(), () => reveal()), await reveal());
  assert.equal(latest.current, 3, "a reveal does not fence other operations");
  // The key was rotated elsewhere or the account changed: the server returns a key the page does not describe.
  assert.equal(await revealPairing(fence(latest), await active(), () => reveal(other)), null);
  // A response whose fingerprint does not hash from its code is not shown.
  assert.equal(
    await revealPairing(fence(latest), await active(), async () => ({ code: other, fingerprint: await hash(code) })),
    null,
  );
  for (const shown of [null, "unavailable"])
    assert.equal(await revealPairing(fence(latest), shown, () => reveal()), null);
  // Rotate, withdraw, revoke-all, refresh or a session failure starts while the reveal is in flight.
  const held = deferred();
  const pending = revealPairing(fence(latest), await active(), () => held.promise);
  latest.current++;
  held.resolve(await reveal());
  assert.equal(await pending, undefined);
});

test("hiding the page discards a reveal in flight without fencing the page's metadata checks", async () => {
  const latest = { current: 0 };
  const reveals = { current: 0 };
  const held = deferred();
  const pending = revealPairing(fence(latest, reveals), await active(), () => held.promise);
  const check = checkPairing(latest, () => active());
  reveals.current++; // pagehide or visibility hidden
  held.resolve(await reveal());
  assert.equal(await pending, undefined);
  assert.deepEqual(await check, await active(), "a server check that started earlier still settles");
});

test("a reveal that fails after a newer operation started reports nothing", async () => {
  // An old reveal's 401 or 503 arrives after a rotate, withdraw or refresh: it must not hide or explain the newer key.
  for (const failure of ["401", "503"]) {
    const latest = { current: 0 };
    const held = deferred();
    const pending = revealPairing(fence(latest), await active(), () =>
      held.promise.then(() => Promise.reject(new Error(failure))),
    );
    latest.current++;
    held.resolve();
    assert.equal(await pending, undefined);
  }
});

test("reveal failures propagate so the dashboard can explain them and hide the key", async () => {
  const latest = { current: 0 };
  await assert.rejects(
    revealPairing(fence(latest), await active(), async () => Promise.reject(new Error("503"))),
    /503/,
  );
});
