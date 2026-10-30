import test from "node:test";
import assert from "node:assert/strict";
import { database } from "./helpers/d1.mjs";
import { D1Store } from "../lib/relay/store.ts";
import { hash } from "../lib/relay/core.ts";
import { TestRelay } from "./helpers/relay.mjs";

test("D1 migration, permanent reusable connection key, owner isolation and CAS", async () => {
  const db = database();
  try {
    let now = 1000;
    const store = new D1Store(db);
    const relay = new TestRelay(store, undefined, () => now);
    const code = (await relay.pairing("alice")).code;
    const results = await Promise.allSettled([relay.pair(code), relay.pair(code)]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 2);
    const paired = results[0].value;
    assert.equal((await relay.authenticate(paired.token)).owner, "alice");
    assert.equal((await relay.authenticate(results[1].value.token)).owner, "alice");
    assert.equal((await store.list("alice", "device")).length, 2);
    assert.equal((await store.list("bob", "device")).length, 0);
    assert.equal((await store.list("alice", "pairing"))[0].expires_at, null);
    // No expiry: the same key pairs and reveals after the former 10-minute window and much later.
    for (now of [601_000, 601_000 + 400 * 86_400_000]) {
      assert.equal((await relay.authenticate((await relay.pair(code)).token)).owner, "alice");
      assert.equal((await relay.revealPairing("alice")).code, code);
      assert.equal((await relay.activePairing("alice")).revealable, true);
    }
    await assert.rejects(relay.revealPairing("bob"), (e) => e.status === 404);
    assert.equal(await relay.activePairing("bob"), null);
    const record = { owner: "alice", kind: "test", id: "1", value: '"initial"', expires_at: null };
    await store.insert(record);
    assert.equal(await store.compareAndSwap({ ...record, value: '"new"' }, '"initial"'), true);
    assert.equal(await store.compareAndSwap({ ...record, value: '"lost"' }, '"initial"'), false);
    assert.equal((await store.get("alice", "test", "1")).value, '"new"');
    assert.equal(await store.get("bob", "test", "1"), null);
    await relay.revoke("alice");
    await assert.rejects(relay.authenticate(paired.token), /Invalid device token/);
    await assert.rejects(relay.pair(code), /invalid or expired/);
  } finally {
    db.sqlite.close();
  }
});

test("D1 new pairing code replaces the owner's codes atomically and a stale redemption creates no device", async () => {
  const db = database();
  try {
    const store = new D1Store(db);
    const relay = new TestRelay(store, undefined, () => 1000);
    const bobs = await relay.pairing("bob");
    const first = await relay.pairing("alice");
    const kept = await relay.pair(first.code);
    const issued = await Promise.all([relay.pairing("alice"), relay.pairing("alice")]);
    // Concurrent issues serialize: exactly one code survives and it is the one reported as active.
    assert.equal((await store.list("alice", "pairing")).length, 1);
    const winners = [];
    for (const p of issued)
      winners.push(
        await relay.pair(p.code).then(
          () => p,
          () => null,
        ),
      );
    assert.equal(winners.filter(Boolean).length, 1);
    assert.equal((await relay.activePairing("alice")).fingerprint, await hash(winners.find(Boolean).code));
    await assert.rejects(relay.pair(first.code), /invalid or expired/);
    assert.equal((await relay.authenticate(kept.token)).owner, "alice");
    assert.equal((await relay.authenticate((await relay.pair(bobs.code)).token)).owner, "bob");
    // A code replaced between lookup and insert must not mint a device.
    const stale = await relay.pairing("alice");
    const racing = new TestRelay(
      Object.assign(Object.create(store), {
        async findPairing(id, now) {
          const found = await store.findPairing(id, now);
          await relay.pairing("alice");
          return found;
        },
      }),
      undefined,
      () => 1000,
    );
    const before = (await store.list("alice", "device")).length;
    await assert.rejects(racing.pair(stale.code), /invalid or expired/);
    assert.equal((await store.list("alice", "device")).length, before);
    await relay.revoke("alice");
    assert.equal((await store.list("alice", "pairing")).length, 0);
    assert.equal((await store.list("bob", "pairing")).length, 1);
  } finally {
    db.sqlite.close();
  }
});

test("D1 withdraw keeps devices, earlier codes keep their expiry, and a reveal racing a rotation stays consistent", async () => {
  const db = database();
  try {
    let now = 1000;
    const store = new D1Store(db);
    const relay = new TestRelay(store, undefined, () => now);
    const first = await relay.pairing("alice");
    const bobs = await relay.pairing("bob");
    const kept = await relay.pair(first.code);
    await relay.withdrawPairing("alice");
    await assert.rejects(relay.pair(first.code), /invalid or expired/);
    assert.equal(await relay.activePairing("alice"), null);
    assert.equal((await relay.authenticate(kept.token)).owner, "alice");
    assert.equal((await relay.revealPairing("bob")).code, bobs.code);
    // A row written by the earlier implementation still redeems only until its original expiry.
    const legacy = "d".repeat(64);
    db.sqlite
      .prepare("INSERT INTO relay_records (owner,kind,id,value,expires_at) VALUES ('alice','pairing',?,'{}',?)")
      .run(await hash(legacy), 1000 + 600_000);
    assert.equal((await relay.activePairing("alice")).revealable, false);
    await assert.rejects(relay.revealPairing("alice"), (e) => e.status === 409);
    await relay.pair(legacy);
    now = 1000 + 600_000;
    await assert.rejects(relay.pair(legacy), /invalid or expired/);
    assert.equal(await relay.activePairing("alice"), null);
    // Missing configuration never removes the key in place.
    const second = await relay.pairing("alice");
    const unconfigured = new TestRelay(store, undefined, () => now, null);
    await assert.rejects(unconfigured.pairing("alice"), (e) => e.status === 503);
    assert.equal((await relay.revealPairing("alice")).code, second.code);
    // A rotation between the reveal's read and its reply: the reply names the key it read, which no longer pairs.
    const racing = new TestRelay(
      Object.assign(Object.create(store), {
        async activePairing(owner, at) {
          const found = await store.activePairing(owner, at);
          await relay.pairing("alice");
          return found;
        },
      }),
      undefined,
      () => now,
    );
    const revealed = await racing.revealPairing("alice");
    assert.equal(revealed.fingerprint, await hash(revealed.code));
    assert.equal(revealed.code, second.code);
    assert.notEqual((await relay.activePairing("alice")).fingerprint, revealed.fingerprint);
    await assert.rejects(relay.pair(revealed.code), /invalid or expired/);
  } finally {
    db.sqlite.close();
  }
});

test("D1 admission is bounded and renews after expiry", async () => {
  const db = database();
  try {
    const store = new D1Store(db);
    assert.equal(await store.rateLimit("alice", "stt", "device", 1000, 2, 60_000), true);
    assert.equal(await store.rateLimit("alice", "stt", "device", 1001, 2, 60_000), true);
    assert.equal(await store.rateLimit("alice", "stt", "device", 1002, 2, 60_000), false);
    assert.equal(await store.rateLimit("bob", "stt", "device", 1002, 2, 60_000), true);
    assert.equal(await store.rateLimit("alice", "stt", "device", 61000, 2, 60_000), true);
  } finally {
    db.sqlite.close();
  }
});

test("D1 message reads are bounded, device scoped, indexed and retain pending across instances", async () => {
  const db = database();
  try {
    const store = new D1Store(db);
    for (let n = 0; n < 120; n++)
      await store.insert({
        owner: "alice",
        kind: "message",
        id: `m${n}`,
        value: JSON.stringify({
          message_id: `m${n}`,
          text: String(n),
          deviceId: n % 2 ? "one" : "two",
          createdAt: new Date(n * 1000).toISOString(),
        }),
        expires_at: null,
      });
    const messages = await store.list("alice", "message", "one");
    assert.equal(messages.length, 60);
    assert(messages.every((record) => JSON.parse(record.value).deviceId === "one"));
    for (let n = 0; n < 120; n++)
      await store.insert({
        owner: "alice",
        kind: "message",
        id: `p${n}`,
        value: JSON.stringify({
          message_id: `p${n}`,
          text: String(n),
          createdAt: new Date((n + 1000) * 1000).toISOString(),
        }),
        expires_at: null,
      });
    assert.equal((await store.list("alice", "message", "one")).length, 100);
    await store.insert({
      owner: "alice",
      kind: "utterance",
      id: "pending",
      value: JSON.stringify({
        id: "pending",
        text: "남아 있어요",
        status: "pending",
        createdAt: new Date().toISOString(),
      }),
      expires_at: null,
    });
    await store.insert({
      owner: "alice",
      kind: "utterance",
      id: "done",
      value: JSON.stringify({ id: "done", text: "끝", status: "replied", createdAt: new Date().toISOString() }),
      expires_at: null,
    });
    const fresh = new TestRelay(new D1Store(db));
    assert.equal((await fresh.pending("alice")).length, 1);
    assert.equal((await fresh.status("alice")).pendingCount, 1);
    const plans = db.sqlite
      .prepare(
        "EXPLAIN QUERY PLAN SELECT * FROM relay_records INDEXED BY relay_pending_idx WHERE owner = ? AND kind = 'utterance' AND json_extract(value, '$.status') != 'replied' ORDER BY json_extract(value, '$.createdAt') ASC LIMIT 100",
      )
      .all("alice");
    assert(plans.some((plan) => plan.detail.includes("relay_pending_idx")));
  } finally {
    db.sqlite.close();
  }
});

test("D1 reply batch is atomic and a lost CAS cannot create a conflicting device message", async () => {
  const db = database();
  try {
    const store = new D1Store(db);
    const pending = {
      owner: "alice",
      kind: "utterance",
      id: "one",
      value: JSON.stringify({ status: "pending", createdAt: "2026-01-01" }),
      expires_at: null,
    };
    const answered = {
      ...pending,
      value: JSON.stringify({ status: "replied", reply: "좋아요", createdAt: "2026-01-01" }),
    };
    const message = {
      owner: "alice",
      kind: "message",
      id: "reply_one",
      value: JSON.stringify({ text: "좋아요", createdAt: "2026-01-01" }),
      expires_at: null,
    };
    await store.insert(pending);
    await assert.rejects(
      store.writeReply(answered, pending.value, { ...message, value: "invalid JSON" }),
      /malformed JSON/,
    );
    assert.equal((await store.get("alice", "utterance", "one")).value, pending.value);
    assert.equal(await store.get("alice", "message", "reply_one"), null);
    assert.equal(await store.writeReply(answered, pending.value, message), true);
    const conflicting = {
      ...answered,
      value: JSON.stringify({ status: "replied", reply: "다른 답", createdAt: "2026-01-01" }),
    };
    assert.equal(
      await store.writeReply(conflicting, pending.value, {
        ...message,
        id: "conflict",
        value: JSON.stringify({ text: "다른 답", createdAt: "2026-01-01" }),
      }),
      false,
    );
    assert.equal(await store.get("alice", "message", "conflict"), null);
    assert.equal((await store.get("alice", "message", "reply_one")).value, message.value);
  } finally {
    db.sqlite.close();
  }
});

test("D1 retry candidate skips exhausted/backoff/in-flight items and pagination crosses old backlog", async () => {
  const db = database();
  try {
    const store = new D1Store(db);
    const ids = [];
    for (let n = 0; n < 25; n++) {
      const id = `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
      ids.push(id);
      const value = {
        id,
        text: `요청 ${n}`,
        deviceId: "device-one",
        createdAt: new Date(n * 1000).toISOString(),
        status: "failed",
        deliveryAttempts: 5,
      };
      if (n === 19) {
        value.deliveryAttempts = 1;
        value.nextAttemptAt = Number.MAX_SAFE_INTEGER;
      }
      if (n === 20) {
        value.deliveryAttempts = 0;
        value.nextAttemptAt = 2000;
      }
      if (n === 21) {
        value.deliveryAttempts = 1;
        value.deliveryLeaseUntil = 2000;
      }
      if (n === 22) {
        value.deliveryAttempts = 2;
        value.deviceId = "other-device";
      }
      if (n === 23) value.deliveryAttempts = 2;
      await store.insert({ owner: "alice", kind: "utterance", id, value: JSON.stringify(value), expires_at: null });
    }
    assert.equal((await store.deliveryCandidate("alice", "device-one", 1000)).id, ids[23]);
    assert.equal(await store.deliveryCandidate("bob", "device-one", 1000), null);
    assert.equal((await store.deliveryCandidate("alice", "device-one", 2000)).id, ids[20]);
    // These rows are dated from the epoch; read them with a clock inside the retention window.
    const relay = new TestRelay(store, undefined, () => 25_000);
    const one = await relay.pendingPage("alice");
    const two = await relay.pendingPage("alice", one.next_cursor);
    const three = await relay.pendingPage("alice", two.next_cursor);
    assert.equal(one.utterances.length, 10);
    assert.equal(two.utterances.length, 10);
    assert.equal(three.utterances.length, 5);
    assert.equal(three.next_cursor, null);
    assert.equal(
      new Set([...one.utterances, ...two.utterances, ...three.utterances].map((item) => item.utterance_id)).size,
      25,
    );
  } finally {
    db.sqlite.close();
  }
});

test("D1 unsubscribe compare-and-delete preserves a concurrently verified replacement", async () => {
  const db = database();
  try {
    class RacingStore extends D1Store {
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
    const store = new RacingStore(db);
    const relay = new TestRelay(store, async (_destination, _id, payload) => ({
      status: 200,
      body: JSON.stringify({ challenge: payload.challenge }),
    }));
    const input = {
      name: "utterance.created",
      arguments: { session_id: "g2" },
      delivery: {
        mode: "webhook",
        url: "https://connectors.api.openai.com/old",
        secret: `whsec_${Buffer.alloc(32, 7).toString("base64")}`,
      },
    };
    await relay.subscribe("alice", input);
    const replacement = { ...input, delivery: { ...input.delivery, url: "https://connectors.api.openai.com/new" } };
    store.beforeDelete = () => relay.subscribe("alice", replacement);
    await relay.unsubscribe("alice", {
      name: input.name,
      arguments: input.arguments,
      delivery: { mode: "webhook", url: input.delivery.url },
    });
    const current = await store.get("alice", "subscription", "g2");
    assert.equal(JSON.parse(current.value).url, replacement.delivery.url);
    assert.equal(await store.compareAndDelete("bob", "subscription", "g2", current.value), false);
    await relay.unsubscribe("alice", {
      name: input.name,
      arguments: input.arguments,
      delivery: { mode: "webhook", url: replacement.delivery.url },
    });
    assert.equal(await store.get("alice", "subscription", "g2"), null);
  } finally {
    db.sqlite.close();
  }
});

test("D1 acknowledgement insert requires the owner's live, unanswered utterance", async () => {
  const db = database();
  try {
    const store = new D1Store(db);
    const utterance = (id, status, createdAt = "2026-10-26T00:00:00.000Z") => ({
      owner: "alice",
      kind: "utterance",
      id,
      value: JSON.stringify({ id, status, createdAt }),
      expires_at: null,
    });
    const ack = (id, owner = "alice") => ({
      owner,
      kind: "message",
      id: `ack_${id}`,
      value: JSON.stringify({ message_id: `ack_${id}`, utterance_id: id, stage: "ack", seq: 1, text: "볼게요" }),
      expires_at: null,
    });
    const cutoff = "2026-09-26T00:00:00.000Z";
    await store.insert(utterance("pending", "pending"));
    await store.insert(utterance("accepted", "accepted"));
    await store.insert(utterance("replied", "replied"));
    await store.insert(utterance("expired", "pending", "2026-09-01T00:00:00.000Z"));
    assert.equal(await store.writeAck(ack("pending"), "pending", cutoff), true);
    assert.equal(await store.writeAck(ack("pending"), "pending", cutoff), false);
    assert.equal(await store.writeAck(ack("accepted"), "accepted", cutoff), true);
    assert.equal(await store.writeAck(ack("replied"), "replied", cutoff), false);
    assert.equal(await store.writeAck(ack("expired"), "expired", cutoff), false);
    assert.equal(await store.writeAck(ack("missing"), "missing", cutoff), false);
    // Another owner's acknowledgement cannot attach to this owner's utterance.
    assert.equal(await store.writeAck(ack("accepted", "bob"), "accepted", cutoff), false);
    assert.deepEqual(
      db.sqlite
        .prepare("SELECT owner, id FROM relay_records WHERE kind = 'message' ORDER BY id")
        .all()
        .map((row) => [row.owner, row.id]),
      [
        ["alice", "ack_accepted"],
        ["alice", "ack_pending"],
      ],
    );
  } finally {
    db.sqlite.close();
  }
});

test("D1 polls keep an acknowledgement beside its final in stage order until deletion or expiry takes each", async () => {
  const db = database();
  try {
    let now = Date.parse("2026-10-26T00:00:00.000Z");
    const relay = new TestRelay(new D1Store(db), undefined, () => now);
    const pair = async (owner) => relay.authenticate((await relay.pair((await relay.pairing(owner)).code)).token);
    const alice = await pair("alice");
    const bob = await pair("bob");
    const id = crypto.randomUUID();
    await relay.submit(alice, { id, text: "자료 찾아줘" });
    // Both stages share one timestamp, so only the sequence number orders them.
    await relay.acknowledge("alice", { utterance_id: id, text: "자료를 찾아볼게요." });
    await relay.reply("alice", { utterance_id: id, text: "찾은 자료입니다." });
    const read = async (device) =>
      (await relay.poll(device)).messages.map((m) => [m.message_id, m.stage, m.seq, m.text]);
    const both = [
      [`ack_${id}`, "ack", 1, "자료를 찾아볼게요."],
      [`reply_${id}`, "final", 2, "찾은 자료입니다."],
    ];
    assert.deepEqual(await read(alice), both);
    assert.deepEqual(await read(alice), both, "a repeated poll carries the same two entries");
    assert.deepEqual(await read(bob), []);
    // The acknowledgement is older than its final, so retention takes it first.
    const later = crypto.randomUUID();
    now += 1000;
    await relay.submit(alice, { id: later, text: "또 찾아줘" });
    await relay.acknowledge("alice", { utterance_id: later, text: "다시 볼게요." });
    now += 1000;
    await relay.reply("alice", { utterance_id: later, text: "다시 찾았어요." });
    now = Date.parse("2026-10-26T00:00:01.000Z") + 30 * 86_400_000;
    assert.deepEqual(
      (await relay.poll(alice)).messages.map((m) => m.message_id),
      [`reply_${later}`],
    );
    now -= 1000;
    const erased = await relay.deleteConversations("alice");
    assert.equal(erased.messages, 4);
    assert.deepEqual(await read(alice), [], "an owner deletion takes both stages");
  } finally {
    db.sqlite.close();
  }
});
