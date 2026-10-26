import type { RecordValue, Store } from "./core";

// Must match relay_retention_idx's WHERE clause exactly so the sweep can use the partial index.
const retained = "kind IN ('utterance','message','erased-utterance','erased-message')";

export class D1Store implements Store {
  private db: D1Database;
  constructor(db: D1Database) {
    this.db = db;
  }
  get(owner: string, kind: string, id: string) {
    return this.db
      .prepare("SELECT * FROM relay_records WHERE owner = ? AND kind = ? AND id = ?")
      .bind(owner, kind, id)
      .first<RecordValue>();
  }
  // Conversation reads take a retention cutoff: rows created at or before it are never returned.
  private messages(owner: string, deviceId: string | undefined, cutoff: string) {
    return this.db
      .prepare(
        "SELECT * FROM relay_records WHERE owner = ? AND kind = 'message' AND (json_extract(value, '$.deviceId') IS NULL OR json_extract(value, '$.deviceId') = ?) AND json_extract(value, '$.createdAt') > ? ORDER BY json_extract(value, '$.createdAt') DESC LIMIT 100",
      )
      .bind(owner, deviceId ?? "", cutoff);
  }
  async list(owner: string, kind: string, deviceId?: string, cutoff = "") {
    if (kind === "message") return (await this.messages(owner, deviceId, cutoff).all<RecordValue>()).results;
    if (kind === "utterance")
      return (
        await this.db
          .prepare(
            "SELECT * FROM relay_records INDEXED BY relay_pending_idx WHERE owner = ? AND kind = 'utterance' AND json_extract(value, '$.status') != 'replied' AND json_extract(value, '$.createdAt') > ? ORDER BY json_extract(value, '$.createdAt') ASC LIMIT 100",
          )
          .bind(owner, cutoff)
          .all<RecordValue>()
      ).results;
    return (
      await this.db
        .prepare("SELECT * FROM relay_records WHERE owner = ? AND kind = ? LIMIT 1000")
        .bind(owner, kind)
        .all<RecordValue>()
    ).results;
  }
  deliveryCandidate(owner: string, deviceId: string, now: number, cutoff = "") {
    return this.db
      .prepare(
        "SELECT * FROM relay_records INDEXED BY relay_pending_idx WHERE owner = ? AND kind = 'utterance' AND json_extract(value, '$.status') != 'replied' AND json_extract(value, '$.status') IN ('pending','failed') AND json_extract(value, '$.deviceId') = ? AND COALESCE(json_extract(value, '$.deliveryAttempts'),0) < 5 AND COALESCE(json_extract(value, '$.nextAttemptAt'),0) <= ? AND COALESCE(json_extract(value, '$.deliveryLeaseUntil'),0) <= ? AND json_extract(value, '$.createdAt') > ? ORDER BY json_extract(value, '$.createdAt') ASC, id ASC LIMIT 1",
      )
      .bind(owner, deviceId, now, now, cutoff)
      .first<RecordValue>();
  }
  async pendingPage(owner: string, after?: { createdAt: string; id: string }, cutoff = "") {
    const base =
      "SELECT * FROM relay_records INDEXED BY relay_pending_idx WHERE owner = ? AND kind = 'utterance' AND json_extract(value, '$.status') != 'replied' AND json_extract(value, '$.createdAt') > ?";
    if (after)
      return (
        await this.db
          .prepare(
            base +
              " AND (json_extract(value, '$.createdAt') > ? OR (json_extract(value, '$.createdAt') = ? AND id > ?)) ORDER BY json_extract(value, '$.createdAt') ASC, id ASC LIMIT 11",
          )
          .bind(owner, cutoff, after.createdAt, after.createdAt, after.id)
          .all<RecordValue>()
      ).results;
    return (
      await this.db
        .prepare(base + " ORDER BY json_extract(value, '$.createdAt') ASC, id ASC LIMIT 11")
        .bind(owner, cutoff)
        .all<RecordValue>()
    ).results;
  }
  async count(owner: string, kind: string, cutoff = "") {
    const record =
      kind === "utterance"
        ? await this.db
            .prepare(
              "SELECT COUNT(*) AS count FROM relay_records INDEXED BY relay_pending_idx WHERE owner = ? AND kind = 'utterance' AND json_extract(value, '$.status') != 'replied' AND json_extract(value, '$.createdAt') > ?",
            )
            .bind(owner, cutoff)
            .first<{ count: number }>()
        : await this.db
            .prepare("SELECT COUNT(*) AS count FROM relay_records WHERE owner = ? AND kind = ?")
            .bind(owner, kind)
            .first<{ count: number }>();
    return record?.count ?? 0;
  }
  async insert(r: RecordValue) {
    return (
      (
        await this.db
          .prepare("INSERT OR IGNORE INTO relay_records (owner,kind,id,value,expires_at) VALUES (?,?,?,?,?)")
          .bind(r.owner, r.kind, r.id, r.value, r.expires_at)
          .run()
      ).meta.changes === 1
    );
  }
  // An ID erased by its owner stays erased: a late retry cannot store it again while the tombstone lives.
  async insertUnlessErased(r: RecordValue) {
    return (
      (
        await this.db
          .prepare(
            "INSERT OR IGNORE INTO relay_records (owner,kind,id,value,expires_at) SELECT ?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM relay_records WHERE owner = ? AND kind = 'erased-' || ? AND id = ?)",
          )
          .bind(r.owner, r.kind, r.id, r.value, r.expires_at, r.owner, r.kind, r.id)
          .run()
      ).meta.changes === 1
    );
  }
  async put(r: RecordValue) {
    await this.db
      .prepare(
        "INSERT INTO relay_records (owner,kind,id,value,expires_at) VALUES (?,?,?,?,?) ON CONFLICT (owner,kind,id) DO UPDATE SET value=excluded.value, expires_at=excluded.expires_at",
      )
      .bind(r.owner, r.kind, r.id, r.value, r.expires_at)
      .run();
  }
  async compareAndSwap(r: RecordValue, previous: string) {
    return (
      (
        await this.db
          .prepare(
            "UPDATE relay_records SET value = ?, expires_at = ? WHERE owner = ? AND kind = ? AND id = ? AND value = ?",
          )
          .bind(r.value, r.expires_at, r.owner, r.kind, r.id, previous)
          .run()
      ).meta.changes === 1
    );
  }
  async writeReply(r: RecordValue, previous: string, message: RecordValue) {
    // D1 batch is transactional: the state transition and visible device message commit together.
    const results = await this.db.batch([
      this.db
        .prepare("UPDATE relay_records SET value = ? WHERE owner = ? AND kind = 'utterance' AND id = ? AND value = ?")
        .bind(r.value, r.owner, r.id, previous),
      this.db
        .prepare(
          "INSERT OR IGNORE INTO relay_records (owner,kind,id,value,expires_at) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM relay_records WHERE owner = ? AND kind = 'utterance' AND id = ? AND value = ?)",
        )
        .bind(message.owner, message.kind, message.id, message.value, message.expires_at, r.owner, r.id, r.value),
    ]);
    return results[0].meta.changes === 1;
  }
  async compareAndDelete(owner: string, kind: string, id: string, previous: string) {
    return (
      (
        await this.db
          .prepare("DELETE FROM relay_records WHERE owner = ? AND kind = ? AND id = ? AND value = ?")
          .bind(owner, kind, id, previous)
          .run()
      ).meta.changes === 1
    );
  }
  async remove(owner: string, kind: string, id: string) {
    await this.db
      .prepare("DELETE FROM relay_records WHERE owner = ? AND kind = ? AND id = ?")
      .bind(owner, kind, id)
      .run();
  }
  async rateLimit(owner: string, scope: string, id: string, now: number, limit: number, windowMs: number) {
    // A single conditional upsert makes admission atomic across Worker isolates.
    const record = await this.db
      .prepare(
        "INSERT INTO relay_records (owner,kind,id,value,expires_at) VALUES (?,?,?,'1',?) ON CONFLICT (owner,kind,id) DO UPDATE SET value=CASE WHEN expires_at<=? THEN '1' ELSE CAST(CAST(value AS INTEGER)+1 AS TEXT) END, expires_at=CASE WHEN expires_at<=? THEN ? ELSE expires_at END WHERE expires_at<=? OR CAST(value AS INTEGER)<? RETURNING id",
      )
      .bind(owner, `rate-${scope}`, id, now + windowMs, now, now, now + windowMs, now, limit)
      .first();
    return !!record;
  }
  async replacePairing(r: RecordValue) {
    // D1 batch is transactional: concurrent issues serialize, leaving exactly one code per owner.
    await this.db.batch([
      this.db.prepare("DELETE FROM relay_records WHERE owner = ? AND kind = 'pairing'").bind(r.owner),
      this.db
        .prepare("INSERT INTO relay_records (owner,kind,id,value,expires_at) VALUES (?,?,?,?,?)")
        .bind(r.owner, r.kind, r.id, r.value, r.expires_at),
    ]);
  }
  activePairing(owner: string, now: number) {
    return this.db
      .prepare("SELECT * FROM relay_records WHERE owner = ? AND kind = 'pairing' AND expires_at > ? LIMIT 1")
      .bind(owner, now)
      .first<RecordValue>();
  }
  findPairing(id: string, now: number) {
    return this.db
      .prepare("SELECT * FROM relay_records WHERE kind = 'pairing' AND id = ? AND expires_at > ?")
      .bind(id, now)
      .first<RecordValue>();
  }
  async redeemPairing(id: string, device: { id: string; value: string }, now: number) {
    // One statement: the device row exists only if the code was still valid when it was written.
    const record = await this.db
      .prepare(
        "INSERT OR IGNORE INTO relay_records (owner,kind,id,value,expires_at) SELECT owner,'device',?,?,NULL FROM relay_records WHERE kind = 'pairing' AND id = ? AND expires_at > ? LIMIT 1 RETURNING owner",
      )
      .bind(device.id, device.value, id, now)
      .first<{ owner: string }>();
    return record?.owner ?? null;
  }
  async revokeDevices(owner: string, deviceId?: string) {
    if (deviceId)
      await this.db
        .prepare("DELETE FROM relay_records WHERE owner = ? AND kind = 'device' AND json_extract(value, '$.id') = ?")
        .bind(owner, deviceId)
        .run();
    // Disconnecting every device also withdraws the reusable code, in the same transaction.
    else
      await this.db.batch([
        this.db.prepare("DELETE FROM relay_records WHERE owner = ? AND kind = 'device'").bind(owner),
        this.db.prepare("DELETE FROM relay_records WHERE owner = ? AND kind = 'pairing'").bind(owner),
      ]);
  }
  async eraseConversations(owner: string, at: string) {
    // One transaction: text-free tombstones, deletion, and the revision companions use to drop cached history.
    const results = await this.db.batch([
      this.db
        .prepare(
          "INSERT OR IGNORE INTO relay_records (owner,kind,id,value,expires_at) SELECT owner, 'erased-' || kind, id, ?, NULL FROM relay_records WHERE owner = ? AND kind IN ('utterance','message')",
        )
        .bind(JSON.stringify({ createdAt: at }), owner),
      this.db.prepare("DELETE FROM relay_records WHERE owner = ? AND kind = 'utterance'").bind(owner),
      this.db.prepare("DELETE FROM relay_records WHERE owner = ? AND kind = 'message'").bind(owner),
      this.db
        .prepare(
          "INSERT INTO relay_records (owner,kind,id,value,expires_at) VALUES (?,'conversation-epoch','g2','{\"revision\":1}',NULL) ON CONFLICT (owner,kind,id) DO UPDATE SET value = json_set(value, '$.revision', json_extract(value, '$.revision') + 1)",
        )
        .bind(owner),
      // A SELECT in the same transaction reads the new revision; batch() documents SELECT rows, not RETURNING rows.
      this.db
        .prepare(
          "SELECT json_extract(value, '$.revision') AS revision FROM relay_records WHERE owner = ? AND kind = 'conversation-epoch' AND id = 'g2'",
        )
        .bind(owner),
    ]);
    return {
      utterances: results[1].meta.changes,
      messages: results[2].meta.changes,
      revision: (results[4].results as { revision: number }[])[0].revision,
    };
  }
  async pollSnapshot(owner: string, deviceId: string, cutoff: string) {
    // Batched reads share one snapshot, so a revision never pairs with messages from before a deletion it reports.
    const [epoch, messages] = await this.db.batch([
      this.db
        .prepare(
          "SELECT json_extract(value, '$.revision') AS revision FROM relay_records WHERE owner = ? AND kind = 'conversation-epoch' AND id = 'g2'",
        )
        .bind(owner),
      this.messages(owner, deviceId, cutoff),
    ]);
    return {
      revision: (epoch.results as { revision: number }[])[0]?.revision ?? 0,
      messages: messages.results as RecordValue[],
    };
  }
  async sweepExpired(cutoff: string, limit: number, at: string) {
    // D1 does not guarantee DELETE ... LIMIT, so the bound is a rowid subquery over the retention index. Its total
    // order picks the same rows for both statements; new fences are dated `at` (after the cutoff) and stay outside it.
    const expired = `SELECT rowid FROM relay_records INDEXED BY relay_retention_idx WHERE ${retained} AND json_extract(value, '$.createdAt') <= ? ORDER BY json_extract(value, '$.createdAt'), rowid LIMIT ?`;
    // One transaction: each purged conversation ID keeps a text-free fence for another 30 days, so a same-ID retry
    // cannot be stored again as new. Fences are themselves swept at the end of that window without a new fence.
    const results = await this.db.batch([
      this.db
        .prepare(
          `INSERT OR IGNORE INTO relay_records (owner,kind,id,value,expires_at) SELECT owner, 'erased-' || kind, id, ?, NULL FROM relay_records WHERE rowid IN (${expired}) AND kind IN ('utterance','message')`,
        )
        .bind(JSON.stringify({ createdAt: at }), cutoff, limit),
      this.db.prepare(`DELETE FROM relay_records WHERE rowid IN (${expired})`).bind(cutoff, limit),
    ]);
    return results[1].meta.changes;
  }
  findToken(id: string) {
    return this.db
      .prepare("SELECT * FROM relay_records WHERE kind = 'device' AND id = ?")
      .bind(id)
      .first<RecordValue>();
  }
}
