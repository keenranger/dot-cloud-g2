import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { callbackUrl, hash, importPairingSecret, ownerIdentity, signedHeaders } from "../lib/relay/core.ts";
import { TestRelay } from "./helpers/relay.mjs";

class MemoryStore {
  rows = new Map();
  key(owner, kind, id) {
    return JSON.stringify([owner, kind, id]);
  }
  async get(owner, kind, id) {
    return this.rows.get(this.key(owner, kind, id)) ?? null;
  }
  async list(owner, kind) {
    return [...this.rows.values()].filter((r) => r.owner === owner && r.kind === kind);
  }
  async deliveryCandidate(owner, deviceId, now) {
    return (
      [...this.rows.values()]
        .filter((record) => {
          if (record.owner !== owner || record.kind !== "utterance") return false;
          const value = JSON.parse(record.value);
          return (
            value.deviceId === deviceId &&
            ["pending", "failed"].includes(value.status) &&
            (value.deliveryAttempts ?? 0) < 5 &&
            (value.nextAttemptAt ?? 0) <= now &&
            (value.deliveryLeaseUntil ?? 0) <= now
          );
        })
        .sort(
          (a, b) =>
            JSON.parse(a.value).createdAt.localeCompare(JSON.parse(b.value).createdAt) || a.id.localeCompare(b.id),
        )[0] ?? null
    );
  }
  async pendingPage(owner, after) {
    return [...this.rows.values()]
      .filter((record) => {
        if (record.owner !== owner || record.kind !== "utterance") return false;
        const value = JSON.parse(record.value);
        return (
          value.status !== "replied" &&
          (!after || value.createdAt > after.createdAt || (value.createdAt === after.createdAt && value.id > after.id))
        );
      })
      .sort(
        (a, b) =>
          JSON.parse(a.value).createdAt.localeCompare(JSON.parse(b.value).createdAt) || a.id.localeCompare(b.id),
      )
      .slice(0, 11);
  }
  async count(owner, kind) {
    return (await this.list(owner, kind)).filter(
      (r) => kind !== "utterance" || JSON.parse(r.value).status !== "replied",
    ).length;
  }
  async insert(record) {
    const key = this.key(record.owner, record.kind, record.id);
    if (this.rows.has(key)) return false;
    this.rows.set(key, structuredClone(record));
    return true;
  }
  async put(record) {
    this.rows.set(this.key(record.owner, record.kind, record.id), structuredClone(record));
  }
  async insertUnlessErased(record) {
    if (this.rows.has(this.key(record.owner, `erased-${record.kind}`, record.id))) return false;
    return this.insert(record);
  }
  async eraseConversations(owner, at) {
    const erased = { utterances: 0, messages: 0 };
    // Map iteration tolerates deleting the current entry; added tombstones are skipped by the kind check.
    for (const record of this.rows.values())
      if (record.owner === owner && (record.kind === "utterance" || record.kind === "message")) {
        await this.insert({
          owner,
          kind: `erased-${record.kind}`,
          id: record.id,
          value: JSON.stringify({ createdAt: at }),
          expires_at: null,
        });
        await this.remove(owner, record.kind, record.id);
        erased[`${record.kind}s`]++;
      }
    const epoch = await this.get(owner, "conversation-epoch", "g2");
    const revision = (epoch ? JSON.parse(epoch.value).revision : 0) + 1;
    await this.put({
      owner,
      kind: "conversation-epoch",
      id: "g2",
      value: JSON.stringify({ revision }),
      expires_at: null,
    });
    return { ...erased, revision };
  }
  async pollSnapshot(owner, deviceId, cutoff) {
    const epoch = await this.get(owner, "conversation-epoch", "g2");
    return {
      revision: epoch ? JSON.parse(epoch.value).revision : 0,
      messages: (await this.list(owner, "message")).filter((r) => JSON.parse(r.value).createdAt > cutoff),
    };
  }
  async sweepExpired(cutoff, limit, at) {
    const expired = [...this.rows.values()]
      .filter((r) => /^(erased-)?(utterance|message)$/.test(r.kind) && JSON.parse(r.value).createdAt <= cutoff)
      .slice(0, limit);
    for (const r of expired) {
      if (!r.kind.startsWith("erased-"))
        await this.insert({
          owner: r.owner,
          kind: `erased-${r.kind}`,
          id: r.id,
          value: JSON.stringify({ createdAt: at }),
          expires_at: null,
        });
      await this.remove(r.owner, r.kind, r.id);
    }
    return expired.length;
  }
  async compareAndSwap(record, previous) {
    const old = this.rows.get(this.key(record.owner, record.kind, record.id));
    if (old?.value !== previous) return false;
    this.rows.set(this.key(record.owner, record.kind, record.id), structuredClone(record));
    return true;
  }
  async writeReply(record, previous, message) {
    if (!(await this.compareAndSwap(record, previous))) return false;
    await this.insert(message);
    return true;
  }
  async writeAck(message, utteranceId, cutoff) {
    const utterance = await this.get(message.owner, "utterance", utteranceId);
    if (!utterance) return false;
    const value = JSON.parse(utterance.value);
    if (value.status === "replied" || value.createdAt <= cutoff) return false;
    return this.insert(message);
  }
  async compareAndDelete(owner, kind, id, previous) {
    const key = this.key(owner, kind, id);
    if (this.rows.get(key)?.value !== previous) return false;
    this.rows.delete(key);
    return true;
  }
  async remove(owner, kind, id) {
    this.rows.delete(this.key(owner, kind, id));
  }
  async replacePairing(record) {
    for (const r of await this.list(record.owner, "pairing")) await this.remove(r.owner, r.kind, r.id);
    await this.insert(record);
  }
  async withdrawPairing(owner) {
    for (const r of await this.list(owner, "pairing")) await this.remove(r.owner, r.kind, r.id);
  }
  async activePairing(owner, now) {
    return (await this.list(owner, "pairing")).find((r) => r.expires_at === null || r.expires_at > now) ?? null;
  }
  async findPairing(id, now) {
    return (
      [...this.rows.values()].find(
        (r) => r.kind === "pairing" && r.id === id && (r.expires_at === null || r.expires_at > now),
      ) ?? null
    );
  }
  async redeemPairing(id, device, now) {
    const pairing = await this.findPairing(id, now);
    if (!pairing) return null;
    await this.insert({ owner: pairing.owner, kind: "device", ...device, expires_at: null });
    return pairing.owner;
  }
  async rateLimit(owner, scope, id, now, limit, windowMs) {
    const record = await this.get(owner, `rate-${scope}`, id);
    if (record && record.expires_at > now && Number(record.value) >= limit) return false;
    await this.put({
      owner,
      kind: `rate-${scope}`,
      id,
      value: String(record && record.expires_at > now ? Number(record.value) + 1 : 1),
      expires_at: record && record.expires_at > now ? record.expires_at : now + windowMs,
    });
    return true;
  }
  async revokeDevices(owner, deviceId) {
    for (const record of await this.list(owner, "device"))
      if (!deviceId || JSON.parse(record.value).id === deviceId) await this.remove(owner, "device", record.id);
    if (!deviceId)
      for (const record of await this.list(owner, "pairing")) await this.remove(owner, "pairing", record.id);
  }
  async findToken(id) {
    return [...this.rows.values()].find((r) => r.kind === "device" && r.id === id) ?? null;
  }
}
const secret = `whsec_${Buffer.alloc(32, 7).toString("base64")}`;
const params = {
  name: "utterance.created",
  arguments: { session_id: "g2" },
  delivery: { mode: "webhook", url: "https://connectors.api.openai.com/webhooks/test", secret },
};
async function device(relay, owner = "alice") {
  return relay.authenticate((await relay.pair((await relay.pairing(owner)).code)).token);
}

test("owner authentication rejects missing identity and scopes to stable ID", () => {
  assert.throws(() => ownerIdentity(new Request("https://site.test")), /Sign in/);
  assert.equal(
    ownerIdentity(
      new Request("https://site.test", {
        headers: { "oai-authenticated-user-id": "alice", "oai-authenticated-user-email": "shared@example.com" },
      }),
    ),
    "alice",
  );
});

test("connection keys are hashed and sealed, never expire, stay reusable, and reveal only to their owner", async () => {
  let now = 1000;
  const store = new MemoryStore();
  const relay = new TestRelay(store, undefined, () => now);
  const pairing = await relay.pairing("alice");
  assert.deepEqual(pairing, { code: pairing.code, createdAt: new Date(1000).toISOString() });
  const [row] = await store.list("alice", "pairing");
  assert.equal(row.id, await hash(pairing.code));
  assert.equal(row.expires_at, null);
  assert.deepEqual(Object.keys(JSON.parse(row.value)).sort(), ["createdAt", "ct", "iv", "v"]);
  assert(!JSON.stringify([...store.rows.values()]).includes(pairing.code));
  // A used key stays valid: each redemption is a separate device with its own token.
  const results = await Promise.allSettled([relay.pair(pairing.code), relay.pair(pairing.code)]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 2);
  const [paired, again] = results.map((r) => r.value);
  assert.notEqual(paired.token, again.token);
  assert.notEqual(paired.deviceId, again.deviceId);
  assert.equal((await store.list("alice", "device")).length, 2);
  // Well past the former 10-minute window, and a year later, the same key still pairs and reveals.
  for (now of [1000 + 600_000, 1000 + 365 * 86_400_000]) {
    await relay.pair(pairing.code);
    assert.deepEqual(await relay.activePairing("alice"), {
      fingerprint: await hash(pairing.code),
      createdAt: pairing.createdAt,
      revealable: true,
      expiresAt: null,
    });
    assert.deepEqual(await relay.revealPairing("alice"), { code: pairing.code, fingerprint: await hash(pairing.code) });
  }
  assert.equal((await store.list("alice", "pairing"))[0].value, row.value);
  await assert.rejects(relay.revealPairing("bob"), (e) => e.status === 404);
  assert.equal(await relay.activePairing("bob"), null);
  const authenticated = await relay.authenticate(paired.token);
  assert.equal(authenticated.owner, "alice");
  assert(!JSON.stringify([...store.rows.values()]).includes(paired.token));
  await relay.revoke("bob", paired.deviceId);
  assert.equal((await relay.authenticate(paired.token)).owner, "alice");
  await relay.revoke("alice", paired.deviceId);
  await assert.rejects(relay.authenticate(paired.token), /Invalid device token/);
  assert.equal((await relay.authenticate(again.token)).owner, "alice");
  // Revoking one device keeps the key.
  assert.equal((await relay.revealPairing("alice")).code, pairing.code);
});

test("without a valid secret issuing and revealing fail closed and the stored key keeps pairing", async () => {
  const store = new MemoryStore();
  const relay = new TestRelay(store, undefined, () => 1000);
  const { code } = await relay.pairing("alice");
  const stored = structuredClone(await store.list("alice", "pairing"));
  for (const secret of [
    null,
    importPairingSecret(undefined),
    importPairingSecret(""),
    importPairingSecret("c2hvcnQ="),
    importPairingSecret(Buffer.alloc(31).toString("base64")),
    importPairingSecret(`${Buffer.alloc(32).toString("base64url")}`),
  ]) {
    const unconfigured = new TestRelay(store, undefined, () => 1000, secret);
    await assert.rejects(unconfigured.pairing("alice"), (e) => e.status === 503);
    await assert.rejects(unconfigured.revealPairing("alice"), (e) => e.status === 503);
    assert.deepEqual(await store.list("alice", "pairing"), stored);
    assert.equal((await unconfigured.activePairing("alice")).fingerprint, await hash(code));
    assert.equal((await unconfigured.authenticate((await unconfigured.pair(code)).token)).owner, "alice");
  }
  // A different secret cannot open the key; the failure is reported, the row is not repaired or removed.
  const other = new TestRelay(
    store,
    undefined,
    () => 1000,
    importPairingSecret(Buffer.alloc(32, 1).toString("base64")),
  );
  await assert.rejects(other.revealPairing("alice"), (e) => e.status === 409 && /cannot be recovered/.test(e.message));
  assert.deepEqual(await store.list("alice", "pairing"), stored);
  await other.pair(code);
  assert.equal((await relay.revealPairing("alice")).code, code);
});

test("a sealed key opens only for its own owner and row and detects tampering", async () => {
  const store = new MemoryStore();
  const relay = new TestRelay(store, undefined, () => 1000);
  const { code } = await relay.pairing("alice");
  const [row] = await store.list("alice", "pairing");
  const sealed = JSON.parse(row.value);
  // Alice's sealed value copied to Bob, or to another row ID of Alice's, fails the additional-data check.
  await store.insert({ ...row, owner: "bob" });
  await assert.rejects(relay.revealPairing("bob"), (e) => e.status === 409);
  const tampered = (value) => ({ ...row, value: JSON.stringify({ ...sealed, ...value }) });
  const flip = (b64) => {
    const bytes = Buffer.from(b64, "base64");
    bytes[0] ^= 1;
    return bytes.toString("base64");
  };
  for (const variant of [
    { ...row, id: "f".repeat(64) },
    tampered({ ct: flip(sealed.ct) }),
    tampered({ iv: flip(sealed.iv) }),
    tampered({ v: 2 }),
    { ...row, value: "not json" },
  ]) {
    await store.withdrawPairing("alice");
    await store.insert(variant);
    await assert.rejects(relay.revealPairing("alice"), (e) => e.status === 409);
    assert.equal((await relay.activePairing("alice")).fingerprint, variant.id);
  }
  // Each issue uses a fresh IV.
  await relay.pairing("alice");
  const next = JSON.parse((await store.list("alice", "pairing"))[0].value);
  assert.notEqual(next.iv, sealed.iv);
  assert.notEqual((await relay.revealPairing("alice")).code, code);
});

test("withdrawing or rotating stops the old key and keeps devices; earlier 10-minute codes are never promoted", async () => {
  let now = 1000;
  const store = new MemoryStore();
  const relay = new TestRelay(store, undefined, () => now);
  const first = await relay.pairing("alice");
  const kept = await relay.pair(first.code);
  assert.deepEqual(await relay.withdrawPairing("alice"), { withdrawn: true });
  await assert.rejects(relay.pair(first.code), /invalid or expired/);
  await assert.rejects(relay.revealPairing("alice"), (e) => e.status === 404);
  assert.equal(await relay.activePairing("alice"), null);
  assert.equal((await relay.authenticate(kept.token)).owner, "alice");
  // A code from the earlier implementation: hash only, fixed expiry, nothing to reveal.
  const legacy = "d".repeat(64);
  await store.insert({
    owner: "alice",
    kind: "pairing",
    id: await hash(legacy),
    value: "{}",
    expires_at: 1000 + 600_000,
  });
  assert.deepEqual(await relay.activePairing("alice"), {
    fingerprint: await hash(legacy),
    createdAt: null,
    revealable: false,
    expiresAt: new Date(1000 + 600_000).toISOString(),
  });
  await assert.rejects(relay.revealPairing("alice"), (e) => e.status === 409 && /earlier code/.test(e.message));
  await relay.pair(legacy);
  now = 1000 + 600_000;
  await assert.rejects(relay.pair(legacy), /invalid or expired/);
  assert.equal(await relay.activePairing("alice"), null);
  assert.equal((await store.list("alice", "pairing"))[0].expires_at, 1000 + 600_000);
  // One new key replaces it.
  const fresh = await relay.pairing("alice");
  assert.equal((await relay.revealPairing("alice")).code, fresh.code);
  assert.equal((await store.list("alice", "pairing")).length, 1);
});

test("connection key reveals are rate limited per owner", async () => {
  const relay = new TestRelay(new MemoryStore(), undefined, () => 1000);
  await relay.pairing("alice");
  await relay.pairing("bob");
  for (let n = 0; n < 30; n++) await relay.revealPairing("alice");
  await assert.rejects(relay.revealPairing("alice"), /Rate limit/);
  await relay.revealPairing("bob");
});

test("a new pairing code invalidates the owner's previous codes and keeps paired devices", async () => {
  let now = 1000;
  const store = new MemoryStore();
  const relay = new TestRelay(store, undefined, () => now);
  const first = await relay.pairing("alice");
  const bobs = await relay.pairing("bob");
  const paired = await relay.pair(first.code);
  now += 1000;
  const second = await relay.pairing("alice");
  await assert.rejects(relay.pair(first.code), /invalid or expired/);
  assert.equal((await store.list("alice", "pairing")).length, 1);
  assert.equal((await relay.authenticate(paired.token)).owner, "alice");
  assert.equal((await relay.authenticate((await relay.pair(second.code)).token)).owner, "alice");
  // Another owner's code is untouched by Alice's new code.
  assert.equal((await relay.authenticate((await relay.pair(bobs.code)).token)).owner, "bob");
  assert.equal((await relay.activePairing("bob")).fingerprint, await hash(bobs.code));
  assert.equal((await relay.activePairing("alice")).fingerprint, await hash(second.code));
  // Disconnecting every device also withdraws the connection key.
  await relay.revoke("alice");
  await assert.rejects(relay.pair(second.code), /invalid or expired/);
  assert.equal(await relay.activePairing("alice"), null);
  assert.equal((await relay.activePairing("bob")).fingerprint, await hash(bobs.code));
});

test("pairing redemptions are rate limited per owner", async () => {
  const relay = new TestRelay(new MemoryStore(), undefined, () => 1000);
  const { code } = await relay.pairing("alice");
  for (let n = 0; n < 10; n++) await relay.pair(code);
  await assert.rejects(relay.pair(code), /Rate limit/);
  await relay.pair((await relay.pairing("bob")).code);
});

test("verified subscription signs Korean utterance and correlates isolated reply", async () => {
  const captured = [];
  const store = new MemoryStore();
  const relay = new TestRelay(store, async (destination, id, payload) => {
    const body = JSON.stringify(payload);
    const headers = await signedHeaders(destination.secret, id, body, 123456);
    const expected = createHmac("sha256", Buffer.alloc(32, 7)).update(`${id}.123456.${body}`).digest("base64");
    assert.equal(headers["webhook-signature"], `v1,${expected}`);
    captured.push(payload);
    return { status: 200, body: JSON.stringify({ challenge: payload.challenge }) };
  });
  const alice = await device(relay);
  const secondAlice = await device(relay);
  const bob = await device(relay, "bob");
  await relay.subscribe("alice", params);
  const id = randomUUID();
  const utterance = await relay.submit(alice, { id, text: "오늘 일정 알려줘" });
  assert.equal(utterance.status, "accepted");
  assert.deepEqual(captured[1].data, { session_id: "g2", utterance_id: id, text: "오늘 일정 알려줘" });
  assert.equal((await relay.pending("bob")).length, 0);
  await assert.rejects(relay.reply("bob", { utterance_id: id, text: "답변" }), /Unknown utterance/);
  await relay.reply("alice", { utterance_id: id, text: "오후 세 시 회의가 있어요" });
  assert.equal((await relay.pending("alice")).length, 0);
  const messages = await relay.messages(alice);
  assert.equal(messages[0].utterance_id, id);
  assert.equal(messages[0].text, "오후 세 시 회의가 있어요");
  assert.deepEqual(await relay.messages(secondAlice), []);
  assert.deepEqual(await relay.messages(bob), []);
  await relay.reply("alice", { utterance_id: id, text: "오후 세 시 회의가 있어요" });
  assert.equal((await relay.messages(alice)).length, 1);
  await assert.rejects(relay.reply("alice", { utterance_id: id, text: "다른 답변" }), /different reply/);
  await relay.submit(alice, { id, text: "오늘 일정 알려줘" });
  assert.equal(captured.length, 2);
});

test("no subscription and webhook failures retain durable unanswered utterances", async () => {
  const store = new MemoryStore();
  let fail = false;
  const relay = new TestRelay(store, async (_destination, _id, payload) => {
    if (fail) throw new Error("network");
    return { status: 200, body: JSON.stringify({ challenge: payload.challenge }) };
  });
  const paired = await device(relay);
  assert.equal((await relay.submit(paired, { id: randomUUID(), text: "보관해 줘" })).status, "pending");
  await relay.subscribe("alice", params);
  fail = true;
  assert.equal((await relay.submit(paired, { id: randomUUID(), text: "전송 실패해도 남겨줘" })).status, "failed");
  assert.equal((await new TestRelay(store).pending("alice")).length, 2);
});

test("rejected challenge never persists subscription; callback allowlist is exact", async () => {
  const relay = new TestRelay(new MemoryStore(), async () => ({ status: 200, body: '{"challenge":"wrong"}' }));
  await assert.rejects(relay.subscribe("alice", params), /verification failed/);
  assert.equal((await relay.status("alice")).subscribed, false);
  for (const url of [
    "http://connectors.api.openai.com/x",
    "https://connectors.api.openai.com.evil.test/x",
    "https://127.0.0.1/x",
    "https://connectors.api.openai.com:444/x",
    "https://user@connectors.api.openai.com/x",
  ])
    assert.throws(() => callbackUrl(url), /not allowed/);
  await assert.rejects(signedHeaders("whsec_bm90LWxvbmc=", "id", "{}"), /Invalid signing secret/);
});

test("proactive messages are idempotent, owner isolated and do not overwrite replies", async () => {
  const relay = new TestRelay(new MemoryStore());
  const alice = await device(relay);
  const bob = await device(relay, "bob");
  const message_id = randomUUID();
  await relay.send("alice", { message_id, text: "잠시 쉬세요" });
  await relay.send("alice", { message_id, text: "잠시 쉬세요" });
  assert.equal((await relay.messages(alice)).length, 1);
  assert.deepEqual(await relay.messages(bob), []);
  await assert.rejects(relay.send("alice", { message_id, text: "다른 메시지" }), /already used/);
});

test("STT admission bounds each device and the owner's combined use", async () => {
  let now = 1000;
  const relay = new TestRelay(new MemoryStore(), undefined, () => now);
  const alice = await device(relay);
  const second = await device(relay);
  const third = await device(relay);
  for (let n = 0; n < 10; n++) await relay.transcriptionAdmission(alice);
  await assert.rejects(relay.transcriptionAdmission(alice), /Rate limit/);
  for (let n = 0; n < 10; n++) await relay.transcriptionAdmission(second);
  await assert.rejects(relay.transcriptionAdmission(third), /Rate limit/);
  now += 60001;
  await relay.transcriptionAdmission(alice);
});

test("utterance UUIDs are scoped to owner and reject conflicting same-owner device writes", async () => {
  const relay = new TestRelay(new MemoryStore());
  const alice = await device(relay);
  const aliceOther = await device(relay);
  const bob = await device(relay, "bob");
  const id = randomUUID();
  await relay.submit(alice, { id, text: "앨리스 요청" });
  await relay.submit(bob, { id, text: "밥 요청" });
  await assert.rejects(relay.submit(aliceOther, { id, text: "앨리스 요청" }), /already used/);
  await assert.rejects(relay.submit(alice, { id, text: "바뀐 요청" }), /already used/);
  await relay.reply("bob", { utterance_id: id, text: "밥에게만 답변" });
  assert.equal((await relay.pending("alice"))[0].text, "앨리스 요청");
  assert.deepEqual(await relay.messages(alice), []);
  assert.equal((await relay.messages(bob))[0].text, "밥에게만 답변");
});

test("webhook reply settled during submit is preserved", async () => {
  const store = new MemoryStore();
  let relay;
  relay = new TestRelay(store, async (_destination, _id, payload) => {
    if (payload.name === "utterance.created")
      await relay.reply("alice", { utterance_id: payload.data.utterance_id, text: "즉시 응답" });
    return { status: 200, body: JSON.stringify({ challenge: payload.challenge }) };
  });
  const paired = await device(relay);
  await relay.subscribe("alice", params);
  const result = await relay.submit(paired, { id: randomUUID(), text: "안녕" });
  assert.equal(result.status, "replied");
  assert.equal((await relay.pending("alice")).length, 0);
  assert.equal((await relay.messages(paired))[0].text, "즉시 응답");
});

test("CAS blocks a reply settled after submit's final read from being overwritten", async () => {
  class RacingStore extends MemoryStore {
    beforeAccepted;
    async compareAndSwap(record, previous) {
      if (record.kind === "utterance" && JSON.parse(record.value).status === "accepted" && this.beforeAccepted) {
        const action = this.beforeAccepted;
        this.beforeAccepted = undefined;
        await action();
      }
      return super.compareAndSwap(record, previous);
    }
  }
  const store = new RacingStore();
  const relay = new TestRelay(store, async (_destination, _id, payload) => ({
    status: 200,
    body: JSON.stringify({ challenge: payload.challenge }),
  }));
  const paired = await device(relay);
  await relay.subscribe("alice", params);
  const id = randomUUID();
  store.beforeAccepted = () => relay.reply("alice", { utterance_id: id, text: "경합 응답" });
  await relay.submit(paired, { id, text: "경합 요청" });
  assert.equal(JSON.parse((await store.get("alice", "utterance", id)).value).status, "replied");
  assert.equal((await relay.pending("alice")).length, 0);
  assert.equal((await relay.messages(paired))[0].text, "경합 응답");
});

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("verified callback replacement wins over a stale verification and rejects failed replacement", async () => {
  const store = new MemoryStore();
  const a = deferred();
  const entered = deferred();
  const relay = new TestRelay(store, async (destination, _id, payload) => {
    if (destination.url.endsWith("slow")) {
      entered.resolve();
      await a.promise;
    }
    if (destination.url.endsWith("bad")) return { status: 200, body: "{}" };
    return { status: 200, body: JSON.stringify({ challenge: payload.challenge }) };
  });
  await relay.subscribe("alice", params);
  const slow = relay.subscribe("alice", {
    ...params,
    delivery: { ...params.delivery, url: "https://connectors.api.openai.com/slow" },
  });
  await entered.promise;
  const fast = await relay.subscribe("alice", {
    ...params,
    delivery: { ...params.delivery, url: "https://connectors.api.openai.com/fast" },
  });
  a.resolve();
  await assert.rejects(slow, /changed during verification/);
  assert.equal(JSON.parse((await store.get("alice", "subscription", "g2")).value).id, fast.id);
  await assert.rejects(
    relay.subscribe("alice", {
      ...params,
      delivery: { ...params.delivery, url: "https://connectors.api.openai.com/bad" },
    }),
    /verification failed/,
  );
  assert.equal(JSON.parse((await store.get("alice", "subscription", "g2")).value).id, fast.id);
});

test("offline queued utterance drains on poll after subscribe with durable bounded retries", async () => {
  let now = 1000;
  const store = new MemoryStore();
  const events = [];
  const transport = async (_destination, id, payload) => {
    if (payload.type === "verification") return { status: 200, body: JSON.stringify({ challenge: payload.challenge }) };
    events.push(id);
    return { status: 503, body: "" };
  };
  const relay = new TestRelay(store, transport, () => now);
  const paired = await device(relay);
  const id = randomUUID();
  await relay.submit(paired, { id, text: "연결되면 전송해줘" });
  assert.equal(JSON.parse((await store.get("alice", "utterance", id)).value).deliveryAttempts, undefined);
  await relay.subscribe("alice", params);
  for (let attempt = 1; attempt <= 5; attempt++) {
    const restarted = new TestRelay(store, transport, () => now);
    await restarted.messages(paired);
    const record = JSON.parse((await store.get("alice", "utterance", id)).value);
    assert.equal(record.deliveryAttempts, attempt);
    await restarted.messages(paired);
    assert.equal(events.length, attempt);
    now = record.nextAttemptAt;
  }
  now += 600000;
  await relay.messages(paired);
  await relay.submit(paired, { id, text: "연결되면 전송해줘" });
  assert.equal(events.length, 5);
  assert(events.every((event) => event === `evt_${id}`));
  assert.equal((await relay.pending("alice")).length, 1);
});

test("concurrent polls and explicit resends acquire only one durable event lease", async () => {
  const store = new MemoryStore();
  const entered = deferred();
  const finish = deferred();
  let sends = 0;
  const transport = async (_destination, _id, payload) => {
    if (payload.type === "verification") return { status: 200, body: JSON.stringify({ challenge: payload.challenge }) };
    sends++;
    entered.resolve();
    await finish.promise;
    return { status: 200, body: "" };
  };
  const relay = new TestRelay(store, transport);
  const paired = await device(relay);
  const id = randomUUID();
  await relay.submit(paired, { id, text: "한 번만 전송" });
  await relay.subscribe("alice", params);
  const poll = relay.messages(paired);
  await entered.promise;
  await Promise.all([
    new TestRelay(store, transport).messages(paired),
    relay.submit(paired, { id, text: "한 번만 전송" }),
  ]);
  assert.equal(sends, 1);
  await relay.reply("alice", { utterance_id: id, text: "먼저 답장" });
  finish.resolve();
  await poll;
  assert.equal(JSON.parse((await store.get("alice", "utterance", id)).value).status, "replied");
  assert.equal((await relay.messages(paired))[0].text, "먼저 답장");
  assert.equal(sends, 1);
});

test("expired lease recovery cannot be overwritten by a late earlier callback", async () => {
  let now = 1000;
  const store = new MemoryStore();
  const entered = deferred();
  const old = deferred();
  let events = 0;
  const transport = async (_destination, _id, payload) => {
    if (payload.type === "verification") return { status: 200, body: JSON.stringify({ challenge: payload.challenge }) };
    events++;
    if (events === 1) {
      entered.resolve();
      await old.promise;
      return { status: 503, body: "" };
    }
    return { status: 200, body: "" };
  };
  const relay = new TestRelay(store, transport, () => now);
  const paired = await device(relay);
  const id = randomUUID();
  await relay.submit(paired, { id, text: "복구" });
  await relay.subscribe("alice", params);
  const first = relay.messages(paired);
  await entered.promise;
  now += 20001;
  await new TestRelay(store, transport, () => now).messages(paired);
  old.resolve();
  await first;
  const value = JSON.parse((await store.get("alice", "utterance", id)).value);
  assert.equal(value.status, "accepted");
  assert.equal(value.deliveryAttempts, 2);
  assert.equal(events, 2);
});

test("pending cursors traverse beyond old unanswered records with identical timestamps", async () => {
  const store = new MemoryStore();
  const relay = new TestRelay(store, undefined, () => 1000);
  const paired = await device(relay);
  for (let n = 0; n < 25; n++) await relay.submit(paired, { id: randomUUID(), text: `요청 ${n}` });
  const first = await relay.pendingPage("alice");
  const second = await relay.pendingPage("alice", first.next_cursor);
  const third = await relay.pendingPage("alice", second.next_cursor);
  assert.equal(first.utterances.length, 10);
  assert.equal(second.utterances.length, 10);
  assert.equal(third.utterances.length, 5);
  assert.equal(third.next_cursor, null);
  assert.equal(
    new Set([...first.utterances, ...second.utterances, ...third.utterances].map((item) => item.utterance_id)).size,
    25,
  );
  assert.deepEqual((await relay.pendingPage("bob", first.next_cursor)).utterances, []);
  await assert.rejects(relay.pendingPage("alice", "bad"), /Invalid pending cursor/);
});

test("unsubscribe cannot delete a verified replacement installed after its read", async () => {
  class RacingStore extends MemoryStore {
    beforeDelete;
    async compareAndDelete(owner, kind, id, previous) {
      if (this.beforeDelete) {
        const action = this.beforeDelete;
        this.beforeDelete = undefined;
        await action();
      }
      return super.compareAndDelete(owner, kind, id, previous);
    }
  }
  const store = new RacingStore();
  const relay = new TestRelay(store, async (_destination, _id, payload) => ({
    status: 200,
    body: JSON.stringify({ challenge: payload.challenge }),
  }));
  await relay.subscribe("alice", params);
  const replacement = {
    ...params,
    delivery: { ...params.delivery, url: "https://connectors.api.openai.com/replacement" },
  };
  store.beforeDelete = () => relay.subscribe("alice", replacement);
  const unsubscribe = {
    name: params.name,
    arguments: params.arguments,
    delivery: { mode: "webhook", url: params.delivery.url },
  };
  await relay.unsubscribe("alice", unsubscribe);
  assert.equal(JSON.parse((await store.get("alice", "subscription", "g2")).value).url, replacement.delivery.url);
  await relay.unsubscribe("alice", { ...unsubscribe, delivery: { mode: "webhook", url: replacement.delivery.url } });
  assert.equal(await store.get("alice", "subscription", "g2"), null);
});

test("status distinguishes never attempted, backoff, exhausted and unpaired-device delivery without text or URLs", async () => {
  let now = 1000;
  const store = new MemoryStore();
  const transport = async (_destination, _id, payload) => {
    if (payload.type === "verification") return { status: 200, body: JSON.stringify({ challenge: payload.challenge }) };
    return { status: 503, body: "private callback detail" };
  };
  const relay = new TestRelay(store, transport, () => now);
  const paired = await device(relay);
  const id = randomUUID();
  await relay.submit(paired, { id, text: "비밀 발화" });
  let delivery = (await relay.status("alice")).delivery;
  assert.equal(delivery.neverAttempted, 1);
  assert.equal(delivery.last, null);
  await relay.subscribe("alice", params);
  await relay.messages(paired);
  delivery = (await relay.status("alice")).delivery;
  assert.equal(delivery.backingOff, 1);
  assert.deepEqual(delivery.last, {
    category: "http_5xx",
    httpStatus: 503,
    attempt: 1,
    at: new Date(now).toISOString(),
  });
  for (let attempt = 2; attempt <= 5; attempt++) {
    now = JSON.parse((await store.get("alice", "utterance", id)).value).nextAttemptAt;
    await relay.messages(paired);
  }
  const status = await relay.status("alice");
  assert.equal(status.delivery.exhausted, 1);
  assert.equal(status.delivery.last.attempt, 5);
  const serialized = JSON.stringify(status);
  for (const leaked of ["비밀 발화", "private callback detail", "connectors.api.openai.com", secret, paired.id])
    assert(!serialized.includes(leaked));
  assert.equal((await relay.status("bob")).delivery.exhausted, 0);
  const other = await device(relay);
  await relay.submit(other, { id: randomUUID(), text: "다른 기기" });
  await relay.revoke("alice", other.id);
  assert.equal((await relay.status("alice")).delivery.awaitingUnpairedDevice, 1);
});

test("410 and 413 callback responses are not retried; thrown transport errors are categorized", async () => {
  for (const [response, category, httpStatus] of [
    [{ status: 410, body: "" }, "http_4xx", 410],
    [{ status: 413, body: "" }, "http_4xx", 413],
    [Object.assign(new Error("timed out"), { name: "TimeoutError" }), "timeout", null],
    [new TypeError("fetch failed"), "network", null],
  ]) {
    let now = 1000;
    let events = 0;
    const store = new MemoryStore();
    const relay = new TestRelay(
      store,
      async (_destination, _id, payload) => {
        if (payload.type === "verification")
          return { status: 200, body: JSON.stringify({ challenge: payload.challenge }) };
        events++;
        if (response instanceof Error) throw response;
        return response;
      },
      () => now,
    );
    const paired = await device(relay);
    await relay.subscribe("alice", params);
    await relay.submit(paired, { id: randomUUID(), text: "전송" });
    now += 600000;
    await relay.messages(paired);
    const delivery = (await relay.status("alice")).delivery;
    assert.equal(delivery.last.category, category);
    assert.equal(delivery.last.httpStatus, httpStatus);
    assert.equal(events, httpStatus ? 1 : 2);
    assert.equal(delivery[httpStatus ? "exhausted" : "backingOff"], 1);
  }
});

test("status reports phone-direct transcription without claiming phone key readiness", async () => {
  const relay = new TestRelay(new MemoryStore());
  for (const legacy of [false, true]) {
    const value = await relay.status("alice", legacy);
    assert.equal(value.sttConfigured, legacy);
    assert.equal(value.transcriptionMode, "phone_direct_soniox");
    assert.equal(value.phoneKeyConfigured, null);
    assert(!JSON.stringify(value).toLowerCase().includes("apikey"));
  }
});

test("an acknowledgement is shown until its final reply, which completes the utterance and supersedes it", async () => {
  let now = Date.parse("2026-10-26T00:00:00.000Z");
  const relay = new TestRelay(new MemoryStore(), undefined, () => now);
  const alice = await device(relay);
  const id = randomUUID();
  await relay.submit(alice, { id, text: "내일 날씨 찾아줘" });
  now += 1000;
  assert.deepEqual(await relay.acknowledge("alice", { utterance_id: id, text: "내일 서울 날씨를 찾아볼게요." }), {
    utterance_id: id,
    message_id: `ack_${id}`,
    stage: "ack",
    stored_for_g2: true,
    physical_display_confirmed: false,
  });
  // The acknowledgement leaves the utterance pending for its final answer.
  assert.equal((await relay.pending("alice")).length, 1);
  assert.equal((await relay.status("alice")).pendingCount, 1);
  let messages = await relay.messages(alice);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].message_id, `ack_${id}`);
  assert.equal(messages[0].utterance_id, id);
  assert.equal(messages[0].stage, "ack");
  assert.equal(messages[0].seq, 1);
  now += 1000;
  const final = await relay.reply("alice", { utterance_id: id, text: "내일 서울은 맑고 18도예요." });
  assert.equal(final.message_id, `reply_${id}`);
  assert.equal(final.stage, "final");
  assert.equal((await relay.pending("alice")).length, 0);
  // Both rows are stored, but a poll that sees the final never carries the acknowledgement again.
  messages = await relay.messages(alice);
  assert.deepEqual(
    messages.map((m) => [m.message_id, m.stage, m.seq]),
    [[`reply_${id}`, "final", 2]],
  );
});

test("acknowledgements are idempotent, reject conflicts, and are never stored or shown after the final", async () => {
  const relay = new TestRelay(new MemoryStore());
  const alice = await device(relay);
  const id = randomUUID();
  await relay.submit(alice, { id, text: "회의록 요약해줘" });
  await relay.acknowledge("alice", { utterance_id: id, text: "회의록을 읽고 요약할게요." });
  const retried = await relay.acknowledge("alice", { utterance_id: id, text: "회의록을 읽고 요약할게요." });
  assert.equal(retried.stored_for_g2, true);
  await assert.rejects(
    relay.acknowledge("alice", { utterance_id: id, text: "다른 짧은 응답" }),
    (e) => e.status === 409 && /different acknowledgement/.test(e.message),
  );
  await assert.rejects(relay.acknowledge("alice", { utterance_id: id, text: "x".repeat(501) }), /too_big/);
  assert.equal((await relay.messages(alice)).length, 1);
  await relay.reply("alice", { utterance_id: id, text: "요약입니다." });
  // The same acknowledgement retried late reports its earlier storage without showing again.
  assert.equal(
    (await relay.acknowledge("alice", { utterance_id: id, text: "회의록을 읽고 요약할게요." })).stored_for_g2,
    true,
  );
  assert.deepEqual(
    (await relay.messages(alice)).map((m) => m.stage),
    ["final"],
  );

  // A first acknowledgement after the final is reported as superseded and stores nothing.
  const late = randomUUID();
  await relay.submit(alice, { id: late, text: "짧은 질문" });
  await relay.reply("alice", { utterance_id: late, text: "바로 답변" });
  assert.deepEqual(await relay.acknowledge("alice", { utterance_id: late, text: "찾아볼게요." }), {
    utterance_id: late,
    message_id: `ack_${late}`,
    stage: "ack",
    stored_for_g2: false,
    superseded_by_final: true,
    physical_display_confirmed: false,
  });
  assert.equal(
    (await relay.messages(alice)).some((m) => m.message_id === `ack_${late}`),
    false,
  );
});

test("acknowledgements stay owner and device scoped and are refused once deleted or expired", async () => {
  let now = Date.parse("2026-10-26T00:00:00.000Z");
  const store = new MemoryStore();
  const relay = new TestRelay(store, undefined, () => now);
  const alice = await device(relay);
  const otherAlice = await device(relay);
  const bob = await device(relay, "bob");
  const id = randomUUID();
  await relay.submit(alice, { id, text: "개인 질문" });
  await assert.rejects(relay.acknowledge("bob", { utterance_id: id, text: "침입" }), (e) => e.status === 404);
  await relay.acknowledge("alice", { utterance_id: id, text: "확인해 볼게요." });
  assert.equal((await relay.messages(alice)).length, 1);
  assert.deepEqual(await relay.messages(otherAlice), []);
  assert.deepEqual(await relay.messages(bob), []);

  await relay.deleteConversations("alice");
  await assert.rejects(
    relay.acknowledge("alice", { utterance_id: id, text: "확인해 볼게요." }),
    (e) => e.status === 404,
  );
  assert.deepEqual(await relay.messages(alice), []);

  const old = randomUUID();
  await relay.submit(alice, { id: old, text: "오래된 질문" });
  now += 30 * 86_400_000;
  await assert.rejects(relay.acknowledge("alice", { utterance_id: old, text: "늦은 응답" }), (e) => e.status === 404);
  assert.equal(await store.get("alice", "message", `ack_${old}`), null);
});

test("an acknowledgement racing its final reply never lands after it", async () => {
  const store = new MemoryStore();
  const relay = new TestRelay(store);
  const alice = await device(relay);
  const id = randomUUID();
  await relay.submit(alice, { id, text: "경쟁" });
  // The final commits between the acknowledgement's read and its conditional write.
  const writeAck = store.writeAck.bind(store);
  store.writeAck = async (...args) => {
    await relay.reply("alice", { utterance_id: id, text: "최종" });
    return writeAck(...args);
  };
  const result = await relay.acknowledge("alice", { utterance_id: id, text: "찾아볼게요." });
  assert.equal(result.stored_for_g2, false);
  assert.equal(result.superseded_by_final, true);
  assert.equal(await store.get("alice", "message", `ack_${id}`), null);
  assert.deepEqual(
    (await relay.messages(alice)).map((m) => m.text),
    ["최종"],
  );
});

test("a poll returns stored replies without waiting for a blocked event retry, which still runs durably", async () => {
  const store = new MemoryStore();
  const entered = deferred();
  const release = deferred();
  let sends = 0;
  let blocked = false;
  const transport = async (_destination, _id, payload) => {
    if (payload.type === "verification") return { status: 200, body: JSON.stringify({ challenge: payload.challenge }) };
    sends++;
    if (!blocked) return { status: 503, body: "" };
    entered.resolve();
    await release.promise;
    return { status: 200, body: "" };
  };
  let now = 1000;
  const relay = new TestRelay(store, transport, () => now);
  const alice = await device(relay);
  const answered = randomUUID();
  await relay.submit(alice, { id: answered, text: "이미 답한 질문" });
  await relay.reply("alice", { utterance_id: answered, text: "저장된 답변" });
  await relay.subscribe("alice", params);
  const queued = randomUUID();
  // The first attempt fails during submission, leaving a durable retry for a later poll.
  assert.equal((await relay.submit(alice, { id: queued, text: "콜백 대기 질문" })).status, "failed");
  now = JSON.parse((await store.get("alice", "utterance", queued)).value).nextAttemptAt;
  blocked = true;
  const background = [];
  const result = await relay.poll(alice, (task) => background.push(task));
  // The stored reply came back while the retried callback is still blocked.
  assert.deepEqual(
    result.messages.map((m) => m.text),
    ["저장된 답변"],
  );
  assert.equal(background.length, 1);
  await entered.promise;
  assert.equal(sends, 2);
  const leased = JSON.parse((await store.get("alice", "utterance", queued)).value);
  assert.equal(leased.deliveryAttempts, 2);
  assert(leased.deliveryLeaseUntil > now);
  // A second poll meanwhile neither waits nor starts another attempt under the live lease.
  assert.equal((await relay.poll(alice, (task) => background.push(task))).messages.length, 1);
  release.resolve();
  await Promise.all(background);
  assert.equal(sends, 2);
  assert.equal(JSON.parse((await store.get("alice", "utterance", queued)).value).status, "accepted");
});

test("a failing event retry never fails the read of stored replies", async () => {
  const store = new MemoryStore();
  const relay = new TestRelay(store);
  const alice = await device(relay);
  const id = randomUUID();
  await relay.submit(alice, { id, text: "질문" });
  await relay.reply("alice", { utterance_id: id, text: "답변" });
  store.deliveryCandidate = async () => {
    throw new Error("D1 unavailable");
  };
  const warn = console.warn;
  const warnings = [];
  console.warn = (message) => warnings.push(message);
  try {
    assert.deepEqual(
      (await relay.messages(alice)).map((m) => m.text),
      ["답변"],
    );
  } finally {
    console.warn = warn;
  }
  assert.deepEqual(warnings, ["event_retry_failed"]);
});
