import test from "node:test";
import assert from "node:assert/strict";
import { database } from "./helpers/d1.mjs";
import { D1Store } from "../lib/relay/store.ts";
import { Relay } from "../lib/relay/core.ts";

test("D1 migration and atomic pairing consumption, owner isolation and CAS", async () => {
  const db = database();
  try {
    const store = new D1Store(db);
    const relay = new Relay(store);
    const code = (await relay.pairing("alice")).code;
    const results = await Promise.allSettled([relay.pair(code), relay.pair(code)]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const paired = results.find((result) => result.status === "fulfilled").value;
    assert.equal((await relay.authenticate(paired.token)).owner, "alice");
    assert.equal((await store.list("bob", "device")).length, 0);
    const record = { owner: "alice", kind: "test", id: "1", value: '"initial"', expires_at: null };
    await store.insert(record);
    assert.equal(await store.compareAndSwap({ ...record, value: '"new"' }, '"initial"'), true);
    assert.equal(await store.compareAndSwap({ ...record, value: '"lost"' }, '"initial"'), false);
    assert.equal((await store.get("alice", "test", "1")).value, '"new"');
    assert.equal(await store.get("bob", "test", "1"), null);
    await relay.revoke("alice");
    await assert.rejects(relay.authenticate(paired.token), /Invalid device token/);
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
    const fresh = new Relay(new D1Store(db));
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
    const relay = new Relay(store, undefined, () => 25_000);
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
    const relay = new Relay(store, async (_destination, _id, payload) => ({
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
