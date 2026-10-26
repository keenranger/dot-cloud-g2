import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { Relay, callbackUrl, hash, ownerIdentity, signedHeaders } from "../lib/relay/core.ts";

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
  async compareAndDelete(owner, kind, id, previous) {
    const key = this.key(owner, kind, id);
    if (this.rows.get(key)?.value !== previous) return false;
    this.rows.delete(key);
    return true;
  }
  async remove(owner, kind, id) {
    this.rows.delete(this.key(owner, kind, id));
  }
  async consumePairing(id, now) {
    const record = [...this.rows.values()].find((r) => r.kind === "pairing" && r.id === id && r.expires_at > now);
    if (!record) return null;
    this.rows.delete(this.key(record.owner, record.kind, id));
    return record;
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

test("pairing codes expire, are hashed and atomically single-use; tokens revoke", async () => {
  let now = 1000;
  const store = new MemoryStore();
  const relay = new Relay(store, undefined, () => now);
  const pairing = await relay.pairing("alice");
  assert.equal((await store.list("alice", "pairing"))[0].id, await hash(pairing.code));
  assert(!JSON.stringify([...store.rows.values()]).includes(pairing.code));
  const results = await Promise.allSettled([relay.pair(pairing.code), relay.pair(pairing.code)]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const paired = results.find((r) => r.status === "fulfilled").value;
  const authenticated = await relay.authenticate(paired.token);
  assert.equal(authenticated.owner, "alice");
  assert(!JSON.stringify([...store.rows.values()]).includes(paired.token));
  await relay.revoke("bob", paired.deviceId);
  assert.equal((await relay.authenticate(paired.token)).owner, "alice");
  await relay.revoke("alice", paired.deviceId);
  await assert.rejects(relay.authenticate(paired.token), /Invalid device token/);
  const expired = await relay.pairing("alice");
  now += 600001;
  await assert.rejects(relay.pair(expired.code), /invalid or expired/);
});

test("verified subscription signs Korean utterance and correlates isolated reply", async () => {
  const captured = [];
  const store = new MemoryStore();
  const relay = new Relay(store, async (destination, id, payload) => {
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
  const relay = new Relay(store, async (_destination, _id, payload) => {
    if (fail) throw new Error("network");
    return { status: 200, body: JSON.stringify({ challenge: payload.challenge }) };
  });
  const paired = await device(relay);
  assert.equal((await relay.submit(paired, { id: randomUUID(), text: "보관해 줘" })).status, "pending");
  await relay.subscribe("alice", params);
  fail = true;
  assert.equal((await relay.submit(paired, { id: randomUUID(), text: "전송 실패해도 남겨줘" })).status, "failed");
  assert.equal((await new Relay(store).pending("alice")).length, 2);
});

test("rejected challenge never persists subscription; callback allowlist is exact", async () => {
  const relay = new Relay(new MemoryStore(), async () => ({ status: 200, body: '{"challenge":"wrong"}' }));
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
  const relay = new Relay(new MemoryStore());
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
  const relay = new Relay(new MemoryStore(), undefined, () => now);
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
  const relay = new Relay(new MemoryStore());
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
  relay = new Relay(store, async (_destination, _id, payload) => {
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
  const relay = new Relay(store, async (_destination, _id, payload) => ({
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
  const relay = new Relay(store, async (destination, _id, payload) => {
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
  const relay = new Relay(store, transport, () => now);
  const paired = await device(relay);
  const id = randomUUID();
  await relay.submit(paired, { id, text: "연결되면 전송해줘" });
  assert.equal(JSON.parse((await store.get("alice", "utterance", id)).value).deliveryAttempts, undefined);
  await relay.subscribe("alice", params);
  for (let attempt = 1; attempt <= 5; attempt++) {
    const restarted = new Relay(store, transport, () => now);
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
  const relay = new Relay(store, transport);
  const paired = await device(relay);
  const id = randomUUID();
  await relay.submit(paired, { id, text: "한 번만 전송" });
  await relay.subscribe("alice", params);
  const poll = relay.messages(paired);
  await entered.promise;
  await Promise.all([new Relay(store, transport).messages(paired), relay.submit(paired, { id, text: "한 번만 전송" })]);
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
  const relay = new Relay(store, transport, () => now);
  const paired = await device(relay);
  const id = randomUUID();
  await relay.submit(paired, { id, text: "복구" });
  await relay.subscribe("alice", params);
  const first = relay.messages(paired);
  await entered.promise;
  now += 20001;
  await new Relay(store, transport, () => now).messages(paired);
  old.resolve();
  await first;
  const value = JSON.parse((await store.get("alice", "utterance", id)).value);
  assert.equal(value.status, "accepted");
  assert.equal(value.deliveryAttempts, 2);
  assert.equal(events, 2);
});

test("pending cursors traverse beyond old unanswered records with identical timestamps", async () => {
  const store = new MemoryStore();
  const relay = new Relay(store, undefined, () => 1000);
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
  const relay = new Relay(store, async (_destination, _id, payload) => ({
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
  const relay = new Relay(store, transport, () => now);
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
    const relay = new Relay(
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
  const relay = new Relay(new MemoryStore());
  for (const legacy of [false, true]) {
    const value = await relay.status("alice", legacy);
    assert.equal(value.sttConfigured, legacy);
    assert.equal(value.transcriptionMode, "phone_direct_soniox");
    assert.equal(value.phoneKeyConfigured, null);
    assert(!JSON.stringify(value).toLowerCase().includes("apikey"));
  }
});
