import type { RecordValue, Store } from "./core";

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
  async list(owner: string, kind: string, deviceId?: string) {
    if (kind === "message")
      return (
        await this.db
          .prepare(
            "SELECT * FROM relay_records WHERE owner = ? AND kind = 'message' AND (json_extract(value, '$.deviceId') IS NULL OR json_extract(value, '$.deviceId') = ?) ORDER BY json_extract(value, '$.createdAt') DESC LIMIT 100",
          )
          .bind(owner, deviceId ?? "")
          .all<RecordValue>()
      ).results;
    if (kind === "utterance")
      return (
        await this.db
          .prepare(
            "SELECT * FROM relay_records INDEXED BY relay_pending_idx WHERE owner = ? AND kind = 'utterance' AND json_extract(value, '$.status') != 'replied' ORDER BY json_extract(value, '$.createdAt') ASC LIMIT 100",
          )
          .bind(owner)
          .all<RecordValue>()
      ).results;
    return (
      await this.db
        .prepare("SELECT * FROM relay_records WHERE owner = ? AND kind = ? LIMIT 1000")
        .bind(owner, kind)
        .all<RecordValue>()
    ).results;
  }
  deliveryCandidate(owner: string, deviceId: string, now: number) {
    return this.db
      .prepare(
        "SELECT * FROM relay_records INDEXED BY relay_pending_idx WHERE owner = ? AND kind = 'utterance' AND json_extract(value, '$.status') != 'replied' AND json_extract(value, '$.status') IN ('pending','failed') AND json_extract(value, '$.deviceId') = ? AND COALESCE(json_extract(value, '$.deliveryAttempts'),0) < 5 AND COALESCE(json_extract(value, '$.nextAttemptAt'),0) <= ? AND COALESCE(json_extract(value, '$.deliveryLeaseUntil'),0) <= ? ORDER BY json_extract(value, '$.createdAt') ASC, id ASC LIMIT 1",
      )
      .bind(owner, deviceId, now, now)
      .first<RecordValue>();
  }
  async pendingPage(owner: string, after?: { createdAt: string; id: string }) {
    const base =
      "SELECT * FROM relay_records INDEXED BY relay_pending_idx WHERE owner = ? AND kind = 'utterance' AND json_extract(value, '$.status') != 'replied'";
    if (after)
      return (
        await this.db
          .prepare(
            base +
              " AND (json_extract(value, '$.createdAt') > ? OR (json_extract(value, '$.createdAt') = ? AND id > ?)) ORDER BY json_extract(value, '$.createdAt') ASC, id ASC LIMIT 11",
          )
          .bind(owner, after.createdAt, after.createdAt, after.id)
          .all<RecordValue>()
      ).results;
    return (
      await this.db
        .prepare(base + " ORDER BY json_extract(value, '$.createdAt') ASC, id ASC LIMIT 11")
        .bind(owner)
        .all<RecordValue>()
    ).results;
  }
  async count(owner: string, kind: string) {
    const record =
      kind === "utterance"
        ? await this.db
            .prepare(
              "SELECT COUNT(*) AS count FROM relay_records INDEXED BY relay_pending_idx WHERE owner = ? AND kind = 'utterance' AND json_extract(value, '$.status') != 'replied'",
            )
            .bind(owner)
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
  consumePairing(id: string, now: number) {
    return this.db
      .prepare("DELETE FROM relay_records WHERE kind = 'pairing' AND id = ? AND expires_at > ? RETURNING *")
      .bind(id, now)
      .first<RecordValue>();
  }
  async revokeDevices(owner: string, deviceId?: string) {
    if (deviceId)
      await this.db
        .prepare("DELETE FROM relay_records WHERE owner = ? AND kind = 'device' AND json_extract(value, '$.id') = ?")
        .bind(owner, deviceId)
        .run();
    else await this.db.prepare("DELETE FROM relay_records WHERE owner = ? AND kind = 'device'").bind(owner).run();
  }
  findToken(id: string) {
    return this.db
      .prepare("SELECT * FROM relay_records WHERE kind = 'device' AND id = ?")
      .bind(id)
      .first<RecordValue>();
  }
}
