// Retention and owner deletion run against the real D1 migrations; time is injected, never read from the clock.
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { database } from "./helpers/d1.mjs";
import { D1Store } from "../lib/relay/store.ts";
import { Relay } from "../lib/relay/core.ts";

const DAY = 86_400_000;
const T0 = Date.parse("2026-11-01T00:00:00.000Z");

function harness() {
  const db = database();
  const store = new D1Store(db);
  const clock = { now: T0 };
  const sent = [];
  let onTransport = async () => {};
  const transport = async (_destination, id, payload) => {
    sent.push({ id, payload });
    await onTransport(payload);
    return { status: 202, body: "" };
  };
  const relay = new Relay(store, transport, () => clock.now);
  const raw = (owner, kind) =>
    db.sqlite.prepare("SELECT * FROM relay_records WHERE owner = ? AND kind = ?").all(owner, kind);
  return {
    db,
    store,
    relay,
    clock,
    sent,
    raw,
    setTransportHook(hook) {
      onTransport = hook;
    },
    async device(owner) {
      const { code } = await relay.pairing(owner);
      const paired = await relay.pair(code);
      return { ...(await relay.authenticate(paired.token)), token: paired.token };
    },
    async subscribe(owner) {
      await store.insert({
        owner,
        kind: "subscription",
        id: "g2",
        value: JSON.stringify({
          id: "sub_test",
          url: "https://connectors.api.openai.com/test",
          secret: "whsec_dGVzdHRlc3R0ZXN0dGVzdHRlc3R0ZXN0",
          expiresAt: T0 + 365 * DAY,
        }),
        expires_at: T0 + 365 * DAY,
      });
    },
  };
}
const uuid = () => randomUUID();
const status410 = (error) => error?.status === 410;

test("R1 read fence: conversation is visible until age 30d and hidden at exactly 30d before any physical purge", async () => {
  const h = harness();
  try {
    const device = await h.device("alice");
    const utteranceId = uuid();
    await h.relay.submit(device, { id: utteranceId, text: "질문" });
    await h.relay.send("alice", { message_id: uuid(), text: "알림" });
    h.clock.now = T0 + 30 * DAY - 1;
    assert.equal((await h.relay.poll(device)).messages.length, 1);
    assert.equal((await h.relay.pendingPage("alice")).utterances.length, 1);
    assert.equal((await h.relay.status("alice")).pendingCount, 1);
    h.clock.now = T0 + 30 * DAY;
    assert.equal(h.raw("alice", "utterance").length, 1, "fence must not depend on physical deletion");
    assert.deepEqual((await h.relay.poll(device)).messages, []);
    assert.deepEqual((await h.relay.pendingPage("alice")).utterances, []);
    assert.equal((await h.relay.status("alice")).pendingCount, 0);
    await assert.rejects(h.relay.reply("alice", { utterance_id: utteranceId, text: "늦은 답" }), /Unknown utterance/);
    assert.equal(h.raw("alice", "message").filter((r) => r.id === `reply_${utteranceId}`).length, 0);
  } finally {
    h.db.sqlite.close();
  }
});

test("R2 expired pending utterance is never delivered by drain/poll", async () => {
  const h = harness();
  try {
    const device = await h.device("alice");
    await h.relay.submit(device, { id: uuid(), text: "구독 전 질문" }); // no subscription: no attempt consumed
    await h.subscribe("alice");
    h.clock.now = T0 + 30 * DAY;
    await h.relay.poll(device);
    assert.equal(h.sent.length, 0);
  } finally {
    h.db.sqlite.close();
  }
});

test("R3 legacy rows (expires_at NULL, minimal JSON) and revoked-device rows are fenced and swept", async () => {
  const h = harness();
  try {
    const device = await h.device("alice");
    const insert = h.db.sqlite.prepare(
      "INSERT INTO relay_records (owner,kind,id,value,expires_at) VALUES (?,?,?,?,NULL)",
    );
    insert.run(
      "alice",
      "message",
      "legacy",
      JSON.stringify({ text: "옛 답", createdAt: new Date(T0 - 31 * DAY).toISOString() }),
    );
    await h.relay.submit(device, { id: uuid(), text: "폐기될 기기의 질문" });
    await h.relay.revoke("alice", device.id);
    h.clock.now = T0 + 29 * DAY;
    await h.relay.send("bob", { message_id: uuid(), text: "bob 최근" });
    h.clock.now = T0 + 30 * DAY;
    const result = await h.relay.sweepExpired();
    assert.equal(result.more, false);
    assert.equal(h.raw("alice", "message").length, 0);
    assert.equal(h.raw("alice", "utterance").length, 0, "revoked device's rows are swept");
    assert.equal(h.raw("bob", "message").length, 1, "rows younger than 30 days survive");
  } finally {
    h.db.sqlite.close();
  }
});

test("R4 one sweep call removes up to 20,000 rows in at most 40 batched statements, stops early, and reports counts only", async () => {
  const h = harness();
  try {
    const insert = h.db.sqlite.prepare(
      "INSERT INTO relay_records (owner,kind,id,value,expires_at) VALUES (?,?,?,?,NULL)",
    );
    const expired = (count, offset = 0) => {
      const old = new Date(T0 - 40 * DAY).toISOString();
      h.db.sqlite.exec("BEGIN");
      for (let n = offset; n < offset + count; n++)
        insert.run(`owner${n % 7}`, "message", `m${n}`, JSON.stringify({ text: "비밀", createdAt: old }));
      h.db.sqlite.exec("COMMIT");
    };
    const remaining = () =>
      h.db.sqlite.prepare("SELECT COUNT(*) AS n FROM relay_records WHERE kind = 'message'").get().n;
    // Count D1 statements issued by one call (each round is a fence + delete batch); the budget is per invocation.
    let statements = 0;
    const batch = h.db.batch.bind(h.db);
    h.db.batch = async (list) => {
      statements += list.length;
      return batch(list);
    };
    expired(25_000);
    statements = 0;
    const full = await h.relay.sweepExpired();
    assert.deepEqual(Object.keys(full).sort(), ["cutoff", "deleted", "more", "retentionDays"]);
    assert.equal(full.deleted, 20_000);
    assert.equal(full.more, true);
    assert.equal(statements, 40);
    assert.equal(remaining(), 5_000);
    assert(!JSON.stringify(full).includes("비밀") && !JSON.stringify(full).includes("owner"));
    statements = 0;
    const rest = await h.relay.sweepExpired();
    assert.deepEqual([rest.deleted, rest.more, statements], [5_000, false, 12]);
    statements = 0;
    const empty = await h.relay.sweepExpired();
    assert.deepEqual([empty.deleted, empty.more, statements], [0, false, 2]);
    expired(1_500, 30_000);
    statements = 0;
    const partial = await h.relay.sweepExpired();
    assert.deepEqual([partial.deleted, partial.more, statements], [1_500, false, 4]);
    assert.equal(remaining(), 0);
  } finally {
    h.db.sqlite.close();
  }
});

test("R5 retention and deletion preserve device, subscription, pairing and rate rows", async () => {
  const h = harness();
  try {
    const device = await h.device("alice");
    await h.subscribe("alice");
    await h.relay.pairing("alice");
    await h.relay.submit(device, { id: uuid(), text: "질문" });
    await h.relay.deleteConversations("alice");
    h.clock.now = T0 + 31 * DAY;
    await h.relay.sweepExpired();
    assert.equal((await h.relay.authenticate(device.token)).owner, "alice");
    assert.equal(h.raw("alice", "device").length, 1);
    assert.equal(h.raw("alice", "subscription").length, 1);
    assert.equal(h.raw("alice", "pairing").length, 1);
  } finally {
    h.db.sqlite.close();
  }
});

test("R6 migration provides a usable retention index", async () => {
  const h = harness();
  try {
    const names = h.db.sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
      .all()
      .map((r) => r.name);
    assert(names.includes("relay_retention_idx"));
  } finally {
    h.db.sqlite.close();
  }
});

test("D1 immediate deletion erases every device's conversation, cancels delivery, bumps revision", async () => {
  const h = harness();
  try {
    const one = await h.device("alice");
    const two = await h.device("alice");
    assert.equal((await h.relay.poll(one)).conversation_revision, 0);
    await h.relay.submit(one, { id: uuid(), text: "구독 전" });
    await h.relay.send("alice", { message_id: uuid(), text: "알림" });
    await h.relay.revoke("alice", two.id);
    const result = await h.relay.deleteConversations("alice");
    assert.equal(result.deleted, true);
    assert.equal(result.conversation_revision, 1);
    await h.subscribe("alice");
    const polled = await h.relay.poll(one);
    assert.deepEqual(polled.messages, []);
    assert.equal(polled.conversation_revision, 1);
    assert.equal(h.sent.length, 0, "erased utterance must not be delivered after subscribe");
    const status = await h.relay.status("alice");
    assert.equal(status.pendingCount, 0);
    assert.equal(status.delivery.last, null);
    assert.equal((await h.relay.deleteConversations("alice")).conversation_revision, 2);
  } finally {
    h.db.sqlite.close();
  }
});

test("D2/D3 late same-ID retries return 410 and store nothing; new IDs after delete are new conversation", async () => {
  const h = harness();
  try {
    const device = await h.device("alice");
    const utteranceId = uuid();
    const messageId = uuid();
    await h.relay.submit(device, { id: utteranceId, text: "질문" });
    await h.relay.send("alice", { message_id: messageId, text: "알림" });
    await h.relay.deleteConversations("alice");
    await h.subscribe("alice");
    await assert.rejects(h.relay.submit(device, { id: utteranceId, text: "질문" }), status410);
    await assert.rejects(h.relay.send("alice", { message_id: messageId, text: "알림" }), status410);
    assert.equal(h.raw("alice", "utterance").length, 0);
    assert.equal(h.raw("alice", "message").length, 0);
    assert.equal(h.sent.length, 0);
    const fresh = await h.relay.submit(device, { id: uuid(), text: "삭제 뒤 새 질문" });
    assert.equal(fresh.status, "accepted");
  } finally {
    h.db.sqlite.close();
  }
});

test("D4 deletion during an in-flight webhook is not undone by the settle CAS and is not retried", async () => {
  const h = harness();
  try {
    const device = await h.device("alice");
    await h.subscribe("alice");
    h.setTransportHook(async () => {
      h.setTransportHook(async () => {});
      await h.relay.deleteConversations("alice");
    });
    await h.relay.submit(device, { id: uuid(), text: "질문" });
    assert.equal(h.raw("alice", "utterance").length, 0);
    h.clock.now += 120_000;
    await h.relay.poll(device);
    assert.equal(h.sent.length, 1);
  } finally {
    h.db.sqlite.close();
  }
});

test("D5 deletion between reply read and reply write leaves no utterance and no reply message", async () => {
  const h = harness();
  try {
    const device = await h.device("alice");
    const utteranceId = uuid();
    await h.relay.submit(device, { id: utteranceId, text: "질문" });
    const writeReply = h.store.writeReply.bind(h.store);
    h.store.writeReply = async (...args) => {
      await h.relay.deleteConversations("alice");
      return writeReply(...args);
    };
    await assert.rejects(h.relay.reply("alice", { utterance_id: utteranceId, text: "답" }));
    assert.equal(h.raw("alice", "utterance").length, 0);
    assert.equal(h.raw("alice", "message").length, 0);
  } finally {
    h.db.sqlite.close();
  }
});

test("D6 tombstones hold no conversation content and expire 30 days after deletion", async () => {
  const h = harness();
  try {
    const device = await h.device("alice");
    await h.relay.submit(device, { id: uuid(), text: "비밀 질문" });
    await h.relay.deleteConversations("alice");
    const tombstones = h.db.sqlite
      .prepare("SELECT * FROM relay_records WHERE owner = 'alice' AND kind LIKE 'erased-%'")
      .all();
    assert.equal(tombstones.length, 1);
    for (const row of tombstones) assert.deepEqual(Object.keys(JSON.parse(row.value)), ["createdAt"]);
    assert(!JSON.stringify(tombstones).includes("비밀"));
    h.clock.now = T0 + 30 * DAY;
    await h.relay.sweepExpired();
    assert.equal(h.db.sqlite.prepare("SELECT COUNT(*) AS n FROM relay_records WHERE kind LIKE 'erased-%'").get().n, 0);
  } finally {
    h.db.sqlite.close();
  }
});

test("D7 deletion is owner scoped", async () => {
  const h = harness();
  try {
    const alice = await h.device("alice");
    const bob = await h.device("bob");
    const sharedId = uuid();
    await h.relay.submit(alice, { id: sharedId, text: "alice" });
    await h.relay.submit(bob, { id: sharedId, text: "bob" });
    await h.relay.deleteConversations("bob");
    assert.equal(h.raw("alice", "utterance").length, 1);
    assert.equal((await h.relay.poll(alice)).conversation_revision, 0);
    await assert.rejects(h.relay.submit(bob, { id: sharedId, text: "bob" }), status410);
    await h.relay.submit(alice, { id: sharedId, text: "alice" }); // alice's idempotent retry still works
  } finally {
    h.db.sqlite.close();
  }
});

test("R7 sweep boundary matches the fence: exactly 30 days old is removed, 1 ms younger is kept", async () => {
  const h = harness();
  try {
    await h.relay.send("alice", { message_id: uuid(), text: "경계 직전" });
    h.clock.now = T0 + 1;
    await h.relay.send("alice", { message_id: uuid(), text: "경계 직후" });
    h.clock.now = T0 + 30 * DAY;
    assert.equal((await h.relay.sweepExpired()).deleted, 1);
    assert.deepEqual(
      h.raw("alice", "message").map((r) => JSON.parse(r.value).text),
      ["경계 직후"],
    );
  } finally {
    h.db.sqlite.close();
  }
});

test("R8 an expired but unswept ID is refused on retry, never revived or delivered", async () => {
  const h = harness();
  try {
    const device = await h.device("alice");
    const utteranceId = uuid();
    const messageId = uuid();
    await h.relay.submit(device, { id: utteranceId, text: "질문" });
    await h.relay.send("alice", { message_id: messageId, text: "알림" });
    await h.subscribe("alice");
    h.clock.now = T0 + 30 * DAY;
    // Bypass the submit fallback sweep to exercise the fence on a row that is still physically present.
    h.store.sweepExpired = async () => 0;
    await assert.rejects(h.relay.submit(device, { id: utteranceId, text: "질문" }), /Utterance expired/);
    await assert.rejects(h.relay.send("alice", { message_id: messageId, text: "알림" }), /Message expired/);
    assert.equal(h.sent.length, 0);
    assert.equal(h.raw("alice", "utterance").length, 1);
  } finally {
    h.db.sqlite.close();
  }
});

test("R9 submit runs one bounded fallback sweep even without the schedule", async () => {
  const h = harness();
  try {
    const insert = h.db.sqlite.prepare(
      "INSERT INTO relay_records (owner,kind,id,value,expires_at) VALUES (?,?,?,?,NULL)",
    );
    const old = new Date(T0 - 40 * DAY).toISOString();
    for (let n = 0; n < 80; n++) insert.run("idle", "message", `m${n}`, JSON.stringify({ text: "x", createdAt: old }));
    const device = await h.device("alice");
    await h.relay.submit(device, { id: uuid(), text: "질문" });
    assert.equal(h.raw("idle", "message").length, 30);
  } finally {
    h.db.sqlite.close();
  }
});

test("R10 retention tool is rate limited per caller", async () => {
  const h = harness();
  try {
    for (let n = 0; n < 6; n++) await h.relay.enforceRetention("operator");
    await assert.rejects(h.relay.enforceRetention("operator"), /Rate limit/);
    await h.relay.enforceRetention("someone-else");
  } finally {
    h.db.sqlite.close();
  }
});

test("R11 poll reports the exact retention cutoff it was fenced with", async () => {
  const h = harness();
  try {
    const device = await h.device("alice");
    await h.relay.send("alice", { message_id: uuid(), text: "알림" });
    h.clock.now = T0 + 30 * DAY - 1;
    const before = await h.relay.poll(device);
    assert.equal(before.retention_cutoff, new Date(T0 - 1).toISOString());
    assert(before.messages.every((m) => m.createdAt > before.retention_cutoff));
    assert.equal(before.messages.length, 1);
    h.clock.now = T0 + 30 * DAY;
    const at = await h.relay.poll(device);
    assert.equal(at.retention_cutoff, new Date(T0).toISOString());
    assert.equal(at.messages.length, 0, "createdAt equal to the cutoff is expired");
  } finally {
    h.db.sqlite.close();
  }
});

test("R12 physical sweep leaves a text-free fence: same-ID retries after fallback, manual or scheduled sweep stay 410", async () => {
  for (const sweep of ["fallback", "manual", "scheduled"]) {
    const h = harness();
    try {
      const device = await h.device("alice");
      const bob = await h.device("bob");
      const utteranceId = uuid();
      const messageId = uuid();
      await h.relay.submit(device, { id: utteranceId, text: "비밀 질문" });
      await h.relay.send("alice", { message_id: messageId, text: "비밀 알림" });
      await h.relay.submit(bob, { id: utteranceId, text: "bob 질문" });
      await h.subscribe("alice");
      h.clock.now = T0 + 30 * DAY;
      if (sweep === "manual") await h.relay.enforceRetention("operator");
      if (sweep === "scheduled") await h.relay.sweepExpired();
      // The fallback variant relies on the bounded sweep inside this very submit, just before its insert.
      await assert.rejects(h.relay.submit(device, { id: utteranceId, text: "비밀 질문" }), status410, sweep);
      await assert.rejects(h.relay.send("alice", { message_id: messageId, text: "비밀 알림" }), status410, sweep);
      assert.equal(h.raw("alice", "utterance").length, 0, sweep);
      assert.equal(h.raw("alice", "message").length, 0, sweep);
      assert.equal(h.sent.length, 0, sweep);
      assert.deepEqual((await h.relay.poll(device)).messages, [], sweep);
      const fences = h.db.sqlite
        .prepare("SELECT * FROM relay_records WHERE owner = 'alice' AND kind LIKE 'erased-%'")
        .all();
      assert.equal(fences.length, 2, sweep);
      for (const row of fences)
        assert.deepEqual(JSON.parse(row.value), { createdAt: new Date(T0 + 30 * DAY).toISOString() });
      assert(!JSON.stringify(fences).includes("비밀"), sweep);
      // Owner isolation: bob's row with the same ID expires on its own row, not through alice's fence.
      assert.equal(h.raw("bob", "erased-utterance").length, 1, sweep);
      // The fence is metadata with the same 30-day window: kept one tick before, swept at 30 days after the purge.
      h.clock.now = T0 + 60 * DAY - 1;
      await h.relay.sweepExpired();
      assert.equal(h.raw("alice", "erased-utterance").length, 1, sweep);
      await assert.rejects(h.relay.submit(device, { id: utteranceId, text: "비밀 질문" }), status410, sweep);
      h.clock.now = T0 + 60 * DAY;
      await h.relay.sweepExpired();
      assert.equal(h.raw("alice", "erased-utterance").length, 0, sweep);
      assert.equal(h.raw("alice", "erased-message").length, 0, sweep);
    } finally {
      h.db.sqlite.close();
    }
  }
});

test("R13 a delivery that crosses the 30-day boundary during its awaited admission never sends expired text", async () => {
  for (const step of ["subscription", "admission", "claim"]) {
    const h = harness();
    try {
      const device = await h.device("alice");
      await h.relay.submit(device, { id: uuid(), text: "경계 질문" }); // no subscription yet: no attempt consumed
      await h.subscribe("alice");
      h.clock.now = T0 + 30 * DAY - 1;
      const cross = () => {
        h.clock.now = T0 + 30 * DAY;
      };
      if (step === "subscription") {
        const get = h.store.get.bind(h.store);
        h.store.get = async (...args) => {
          const result = await get(...args);
          if (args[1] === "subscription") cross();
          return result;
        };
      }
      if (step === "admission") {
        const rateLimit = h.store.rateLimit.bind(h.store);
        h.store.rateLimit = async (...args) => {
          const result = await rateLimit(...args);
          if (args[1] === "event-delivery") cross();
          return result;
        };
      }
      if (step === "claim") {
        const compareAndSwap = h.store.compareAndSwap.bind(h.store);
        h.store.compareAndSwap = async (...args) => {
          const result = await compareAndSwap(...args);
          cross();
          return result;
        };
      }
      await h.relay.poll(device);
      assert.equal(h.sent.length, 0, step);
    } finally {
      h.db.sqlite.close();
    }
  }
});

test("R14 fallback sweep failure does not block a fresh submit, and expired retries stay refused", async () => {
  for (const failure of ["missing-index", "injected"]) {
    const h = harness();
    const warn = console.warn;
    const warnings = [];
    console.warn = (...args) => warnings.push(args);
    try {
      const device = await h.device("alice");
      const expiredId = uuid();
      await h.relay.submit(device, { id: expiredId, text: "만료 질문" });
      await h.subscribe("alice");
      if (failure === "missing-index") h.db.sqlite.exec("DROP INDEX relay_retention_idx");
      else
        h.store.sweepExpired = async () => {
          throw new Error("D1_ERROR: 만료 질문 secret detail");
        };
      h.clock.now = T0 + 30 * DAY;
      const fresh = await h.relay.submit(device, { id: uuid(), text: "새 질문" });
      assert.equal(fresh.status, "accepted", failure);
      assert.equal(h.sent.length, 1, failure);
      await assert.rejects(h.relay.submit(device, { id: expiredId, text: "만료 질문" }), status410, failure);
      assert.equal(h.sent.length, 1, failure);
      assert(warnings.length >= 1, failure);
      assert.deepEqual(
        new Set(warnings.map((w) => JSON.stringify(w))),
        new Set(['["retention_fallback_sweep_failed"]']),
      );
      // The manual tool is not best-effort: an operator sees the failure.
      await assert.rejects(h.relay.sweepExpired(), failure);
    } finally {
      console.warn = warn;
      h.db.sqlite.close();
    }
  }
});

test("R15 an insert failure on submit is still an error", async () => {
  const h = harness();
  try {
    const device = await h.device("alice");
    h.store.insertUnlessErased = async () => {
      throw new Error("insert failed");
    };
    await assert.rejects(h.relay.submit(device, { id: uuid(), text: "질문" }), /insert failed/);
  } finally {
    h.db.sqlite.close();
  }
});

test("R16 erase and sweep batches do not rely on RETURNING rows inside batch()", async () => {
  const h = harness();
  try {
    const batched = [];
    const batch = h.db.batch.bind(h.db);
    h.db.batch = async (statements) => {
      batched.push(...statements.map((s) => s.sql));
      return batch(statements);
    };
    const prepare = h.db.prepare.bind(h.db);
    h.db.prepare = (sql) => {
      const statement = prepare(sql);
      return {
        bind(...args) {
          return { ...statement.bind(...args), sql };
        },
      };
    };
    const device = await h.device("alice");
    await h.relay.submit(device, { id: uuid(), text: "질문" });
    assert.equal((await h.relay.deleteConversations("alice")).conversation_revision, 1);
    assert.equal((await h.relay.deleteConversations("alice")).conversation_revision, 2);
    h.clock.now = T0 + 30 * DAY;
    await h.relay.sweepExpired();
    assert(batched.length > 0);
    assert(batched.every((sql) => !/\breturning\b/i.test(sql)));
  } finally {
    h.db.sqlite.close();
  }
});

test("R17 both sweep statements select one deterministic set straight from the retention index", async () => {
  const h = harness();
  try {
    const swept = [];
    const prepare = h.db.prepare.bind(h.db);
    h.db.prepare = (sql) => {
      if (sql.includes("relay_retention_idx")) swept.push(sql);
      return prepare(sql);
    };
    await h.store.sweepExpired(new Date(T0).toISOString(), 10, new Date(T0 + 30 * DAY).toISOString());
    assert.equal(swept.length, 2);
    for (const sql of swept) {
      assert.match(sql, /ORDER BY json_extract\(value, '\$\.createdAt'\), rowid LIMIT \?/);
      const plan = h.db.sqlite
        .prepare(`EXPLAIN QUERY PLAN ${sql}`)
        .all(...(sql.startsWith("INSERT") ? ["{}", "x", 1] : ["x", 1]))
        .map((r) => r.detail)
        .join("\n");
      assert.match(plan, /relay_retention_idx/);
      assert.doesNotMatch(plan, /TEMP B-TREE/, "the order comes from the index, not a sort");
    }
  } finally {
    h.db.sqlite.close();
  }
});
