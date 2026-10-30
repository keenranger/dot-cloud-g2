import { z } from "zod";

export class RelayError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
// ChatGPT MCP Events reports failed callback verification as CallbackEndpointError with a categorized reason.
export class CallbackEndpointError extends RelayError {
  readonly reason: "challenge_failed" | "timeout" | "connection_refused" | "http_4xx" | "http_5xx";
  constructor(reason: CallbackEndpointError["reason"]) {
    super(400, "Callback verification failed");
    this.reason = reason;
  }
}
export type RecordValue = { owner: string; kind: string; id: string; value: string; expires_at: number | null };
export interface Store {
  get(owner: string, kind: string, id: string): Promise<RecordValue | null>;
  list(owner: string, kind: string, deviceId?: string, cutoff?: string): Promise<RecordValue[]>;
  count(owner: string, kind: string, cutoff?: string): Promise<number>;
  deliveryCandidate(owner: string, deviceId: string, now: number, cutoff?: string): Promise<RecordValue | null>;
  pendingPage(owner: string, after?: { createdAt: string; id: string }, cutoff?: string): Promise<RecordValue[]>;
  insert(record: RecordValue): Promise<boolean>;
  insertUnlessErased(record: RecordValue): Promise<boolean>;
  eraseConversations(owner: string, at: string): Promise<{ utterances: number; messages: number; revision: number }>;
  pollSnapshot(owner: string, deviceId: string, cutoff: string): Promise<{ revision: number; messages: RecordValue[] }>;
  sweepExpired(cutoff: string, limit: number, at: string): Promise<number>;
  put(record: RecordValue): Promise<void>;
  compareAndSwap(record: RecordValue, previous: string): Promise<boolean>;
  writeReply(record: RecordValue, previous: string, message: RecordValue): Promise<boolean>;
  writeAck(message: RecordValue, utteranceId: string, cutoff: string): Promise<boolean>;
  remove(owner: string, kind: string, id: string): Promise<void>;
  compareAndDelete(owner: string, kind: string, id: string, previous: string): Promise<boolean>;
  replacePairing(record: RecordValue): Promise<void>;
  withdrawPairing(owner: string): Promise<void>;
  activePairing(owner: string, now: number): Promise<RecordValue | null>;
  findPairing(hash: string, now: number): Promise<RecordValue | null>;
  redeemPairing(hash: string, device: { id: string; value: string }, now: number): Promise<string | null>;
  findToken(hash: string): Promise<RecordValue | null>;
  revokeDevices(owner: string, deviceId?: string): Promise<void>;
  rateLimit(owner: string, scope: string, id: string, now: number, limit: number, windowMs: number): Promise<boolean>;
}
export type Destination = { id: string; url: string; secret: string; expiresAt: number };
export type Transport = (
  destination: Destination,
  id: string,
  payload: unknown,
) => Promise<{ status: number; body: string }>;
export type Device = { owner: string; id: string };
// Sanitized delivery outcome: no URL, secret, response body, or utterance text is retained.
type DeliveryOutcome = {
  category: "accepted" | "http_4xx" | "http_5xx" | "http_other" | "timeout" | "network" | "invalid_response";
  httpStatus: number | null;
  attempt: number;
  at: string;
};
// MCP Events: do not retry deliveries that return 410 or 413.
const noRetry = Number.MAX_SAFE_INTEGER;
// Conversation records are unavailable once 30 days old, measured from their server-assigned UTC createdAt.
const RETENTION_MS = 30 * 86_400_000;
// One sweep call deletes at most SWEEP_ROUNDS * SWEEP_BATCH (20,000) expired rows. Each round is a two-statement batch
// (fence insert, delete); with the rate-limit upsert that is at most 41 D1 statements, inside D1's
// 50-queries-per-invocation Free limit. It stops at the first short round.
const SWEEP_ROUNDS = 20;
const SWEEP_BATCH = 1000;
type Utterance = {
  id: string;
  text: string;
  deviceId: string;
  createdAt: string;
  status: "pending" | "accepted" | "failed" | "replied";
  reply?: string;
  deliveryAttempts?: number;
  nextAttemptAt?: number;
  deliveryLeaseUntil?: number;
  deliveryLeaseId?: string;
  lastDelivery?: DeliveryOutcome;
};
// A reply has two stages per utterance, each with a fixed message ID and sequence number: an optional acknowledgement
// the model wrote before working, then the final answer that completes the utterance. Messages without a stage are
// final answers or proactive messages.
type ReplyStage = "ack" | "final";
const stageSeq: Record<ReplyStage, number> = { ack: 1, final: 2 };
const stageMessageId = (stage: ReplyStage, utteranceId: string) =>
  `${stage === "ack" ? "ack" : "reply"}_${utteranceId}`;
const text = z.string().trim().min(1).max(8000);
export const utteranceInput = z.object({ id: z.string().uuid(), text: text.max(4000) }).strict();
const sessionArgs = z.object({ session_id: z.literal("g2") }).strict();
// MCP 2026-07-28 requests carry protocol version and client capabilities in params._meta.
const requestMeta = z.record(z.string(), z.unknown()).optional();
const delivery = z
  .object({ mode: z.literal("webhook"), url: z.string().max(2048), secret: z.string().max(100) })
  .strict();
export const subscribeInput = z
  .object({
    _meta: requestMeta,
    name: z.literal("utterance.created"),
    arguments: sessionArgs,
    delivery,
    cursor: z.null().optional(),
    // TTL is a suggestion; the grant is clamped rather than rejected.
    ttlMs: z.number().int().nonnegative().nullable().optional(),
  })
  .strict();
export async function hash(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export function randomSecret() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
}
// The owner's connection key is stored recoverably: AES-256-GCM under a Sites runtime secret, with a fresh IV per issue
// and the owner and lookup hash bound as additional data, so a sealed key moved to another owner or row fails to open.
// Redemption never needs this secret; it looks the key up by its SHA-256 hash.
export type SealedPairingKey = { v: 1; iv: string; ct: string; createdAt: string };

const imported = new Map<string, Promise<CryptoKey | null>>();

function bytes(value: string) {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}
function base64(value: Uint8Array) {
  return btoa(String.fromCharCode(...value));
}
// Standard base64 of exactly 32 random bytes. Anything else leaves issuing and revealing disabled.
export function importPairingSecret(raw: string | undefined): Promise<CryptoKey | null> {
  if (!raw) return Promise.resolve(null);
  let key = imported.get(raw);
  if (!key) {
    key = (async () => {
      try {
        if (!/^[A-Za-z0-9+/]{43}=$/.test(raw)) return null;
        const material = bytes(raw);
        if (material.length !== 32) return null;
        return await crypto.subtle.importKey("raw", material, "AES-GCM", false, ["encrypt", "decrypt"]);
      } catch {
        return null;
      }
    })();
    imported.set(raw, key);
  }
  return key;
}
function additionalData(owner: string, id: string) {
  return new TextEncoder().encode(`lens-pairing-key:v1\n${owner}\n${id}`);
}
export async function sealPairingKey(key: CryptoKey, owner: string, id: string, code: string, createdAt: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: additionalData(owner, id) },
      key,
      new TextEncoder().encode(code),
    ),
  );
  return { v: 1, iv: base64(iv), ct: base64(ct), createdAt } satisfies SealedPairingKey;
}
// Returns null for anything that does not open under this secret, owner and row.
export async function openPairingKey(key: CryptoKey, owner: string, id: string, sealed: unknown) {
  if (!sealed || typeof sealed !== "object") return null;
  const { v, iv, ct } = sealed as Partial<SealedPairingKey>;
  if (v !== 1 || typeof iv !== "string" || typeof ct !== "string") return null;
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes(iv), additionalData: additionalData(owner, id) },
      key,
      bytes(ct),
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}
export function ownerIdentity(request: Request): string {
  const owner = request.headers.get("oai-authenticated-user-id");
  if (!owner || owner.length > 256) throw new RelayError(401, "Sign in with ChatGPT is required");
  return owner;
}
export function callbackUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new RelayError(400, "Invalid callback URL");
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "connectors.api.openai.com" ||
    url.username ||
    url.password ||
    url.hash ||
    (url.port && url.port !== "443")
  )
    throw new RelayError(400, "Callback destination is not allowed");
  return url;
}
function secretBytes(value: string) {
  if (!/^whsec_[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new RelayError(400, "Invalid signing secret");
  let binary: string;
  try {
    binary = atob(value.slice(6));
  } catch {
    throw new RelayError(400, "Invalid signing secret");
  }
  if (binary.length < 24 || binary.length > 64 || btoa(binary) !== value.slice(6))
    throw new RelayError(400, "Invalid signing secret");
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
export async function signedHeaders(
  secret: string,
  id: string,
  body: string,
  timestamp = Math.floor(Date.now() / 1000),
) {
  const key = await crypto.subtle.importKey("raw", secretBytes(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${body}`)),
  );
  return {
    "Content-Type": "application/json",
    "webhook-id": id,
    "webhook-timestamp": String(timestamp),
    "webhook-signature": `v1,${btoa(String.fromCharCode(...signature))}`,
  };
}
export const webhookTransport: Transport = async (destination, id, payload) => {
  const url = callbackUrl(destination.url);
  const body = JSON.stringify(payload);
  const response = await fetch(url, {
    method: "POST",
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
    headers: { ...(await signedHeaders(destination.secret, id, body)), "X-MCP-Subscription-Id": destination.id },
    body,
  });
  if (!response.body) return { status: response.status, body: "" };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 16_384) throw new RelayError(502, "Callback response too large");
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return { status: response.status, body: new TextDecoder().decode(bytes) };
};
export class Relay {
  private store: Store;
  private transport: Transport;
  private now: () => number;
  private pairingSecret: CryptoKey | null | Promise<CryptoKey | null>;
  constructor(
    store: Store,
    transport: Transport = webhookTransport,
    now: () => number = Date.now,
    pairingSecret: CryptoKey | null | Promise<CryptoKey | null> = null,
  ) {
    this.store = store;
    this.transport = transport;
    this.now = now;
    this.pairingSecret = pairingSecret;
  }
  private record(
    owner: string,
    kind: string,
    id: string,
    value: unknown,
    expires_at: number | null = null,
  ): RecordValue {
    return { owner, kind, id, value: JSON.stringify(value), expires_at };
  }
  // Without the secret nothing is issued or revealed, and the stored key is left untouched.
  private async sealingKey() {
    const key = await this.pairingSecret;
    if (!key) throw new RelayError(503, "Connection key encryption is not configured");
    return key;
  }
  // One connection key per owner, with no expiry: issuing replaces the earlier key, which stops working at once.
  // The row keeps the key's hash for redemption and the key itself sealed for the owner to reveal again.
  async pairing(owner: string) {
    const key = await this.sealingKey();
    await this.limit(owner, "pairing", "owner", 10);
    const code = randomSecret();
    const id = await hash(code);
    const createdAt = new Date(this.now()).toISOString();
    const sealed = await sealPairingKey(key, owner, id, code, createdAt);
    await this.store.replacePairing(this.record(owner, "pairing", id, sealed));
    return { code, createdAt };
  }
  // Metadata only: the hash lets the owner's browser confirm a key it was just given. Codes issued before connection
  // keys were sealed keep their fixed expiry and can never be revealed.
  async activePairing(owner: string) {
    const record = await this.store.activePairing(owner, this.now());
    if (!record) return null;
    if (record.expires_at !== null)
      return {
        fingerprint: record.id,
        createdAt: null,
        revealable: false,
        expiresAt: new Date(record.expires_at).toISOString(),
      };
    let createdAt: unknown = null;
    try {
      createdAt = (JSON.parse(record.value) as { createdAt?: unknown }).createdAt;
    } catch {
      // An unreadable row still names the key by hash; revealing it reports it as unrecoverable.
    }
    return {
      fingerprint: record.id,
      createdAt: typeof createdAt === "string" ? createdAt : null,
      revealable: true,
      expiresAt: null,
    };
  }
  // A failure to open is reported, never repaired: the stored key keeps working for redemption.
  async revealPairing(owner: string) {
    const key = await this.sealingKey();
    await this.limit(owner, "pairing-reveal", "owner", 30);
    const record = await this.store.activePairing(owner, this.now());
    if (!record) throw new RelayError(404, "No connection key");
    if (record.expires_at !== null) throw new RelayError(409, "This earlier code cannot be shown again");
    let sealed: unknown = null;
    try {
      sealed = JSON.parse(record.value);
    } catch {
      sealed = null;
    }
    const code = await openPairingKey(key, owner, record.id, sealed);
    if (!code || !/^[a-f0-9]{64}$/.test(code) || (await hash(code)) !== record.id)
      throw new RelayError(409, "Connection key cannot be recovered");
    return { code, fingerprint: record.id };
  }
  // Paired devices keep their own credentials; only new pairing stops.
  async withdrawPairing(owner: string) {
    await this.store.withdrawPairing(owner);
    return { withdrawn: true };
  }
  async pair(code: string) {
    const token = randomSecret();
    const deviceId = crypto.randomUUID();
    const id = await hash(code);
    const pairing = await this.store.findPairing(id, this.now());
    if (!pairing) throw new RelayError(400, "Pairing code is invalid or expired");
    await this.limit(pairing.owner, "pair", "owner", 10);
    // The device insert rechecks the code, so one replaced, withdrawn or expired since the lookup mints nothing.
    const owner = await this.store.redeemPairing(
      id,
      { id: await hash(token), value: JSON.stringify({ id: deviceId, createdAt: new Date(this.now()).toISOString() }) },
      this.now(),
    );
    if (!owner) throw new RelayError(400, "Pairing code is invalid or expired");
    return { token, deviceId };
  }
  async authenticate(token: string): Promise<Device> {
    if (!/^[a-f0-9]{64}$/.test(token)) throw new RelayError(401, "Invalid device token");
    const record = await this.store.findToken(await hash(token));
    if (!record) throw new RelayError(401, "Invalid device token");
    return { owner: record.owner, id: JSON.parse(record.value).id };
  }
  async revoke(owner: string, deviceId?: string) {
    await this.store.revokeDevices(owner, deviceId);
    return { revoked: true };
  }
  private cutoff() {
    return new Date(this.now() - RETENTION_MS).toISOString();
  }
  private live(record: RecordValue | null) {
    return !!record && (JSON.parse(record.value) as { createdAt: string }).createdAt > this.cutoff();
  }
  private async limit(owner: string, scope: string, id: string, maximum: number) {
    if (!(await this.store.rateLimit(owner, scope, id, this.now(), maximum, 60_000)))
      throw new RelayError(429, "Rate limit reached; try again later");
  }
  async transcriptionAdmission(device: Device) {
    await this.limit(device.owner, "stt-device", device.id, 10);
    await this.limit(device.owner, "stt-owner", "owner", 20);
  }
  private async subscription(owner: string): Promise<Destination | null> {
    const record = await this.store.get(owner, "subscription", "g2");
    return record && record.expires_at! > this.now() ? JSON.parse(record.value) : null;
  }
  async status(owner: string, sttConfigured = false) {
    const cutoff = this.cutoff();
    const [deviceCount, pendingCount, subscription, utterances, devices] = await Promise.all([
      this.store.count(owner, "device"),
      this.store.count(owner, "utterance", cutoff),
      this.subscription(owner),
      this.store.list(owner, "utterance", undefined, cutoff),
      this.store.list(owner, "device"),
    ]);
    return {
      deviceCount,
      subscribed: !!subscription,
      pendingCount,
      // Legacy field: reports server-side transcription only, which is intentionally disabled.
      sttConfigured,
      // The companion transcribes on the phone directly with Soniox; the relay never sees that key.
      transcriptionMode: "phone_direct_soniox" as const,
      phoneKeyConfigured: null,
      eventTransport: "unverified" as const,
      sessionId: "g2",
      delivery: this.deliverySummary(
        utterances.map((r) => JSON.parse(r.value) as Utterance).filter((u) => u.status !== "replied"),
        new Set(devices.map((r) => JSON.parse(r.value).id as string)),
      ),
    };
  }
  private deliverySummary(utterances: Utterance[], deviceIds: Set<string>) {
    const now = this.now();
    const summary = {
      neverAttempted: 0,
      inFlight: 0,
      backingOff: 0,
      retryReady: 0,
      exhausted: 0,
      acceptedAwaitingReply: 0,
      // Retries are driven only by the originating device's requests.
      awaitingUnpairedDevice: 0,
      last: null as DeliveryOutcome | null,
    };
    for (const u of utterances) {
      const attempts = u.deliveryAttempts ?? 0;
      if (u.status === "accepted") summary.acceptedAwaitingReply++;
      else if ((u.deliveryLeaseUntil ?? 0) > now) summary.inFlight++;
      else if (attempts >= 5 || u.nextAttemptAt === noRetry) summary.exhausted++;
      else if (attempts === 0) summary.neverAttempted++;
      else if ((u.nextAttemptAt ?? 0) > now) summary.backingOff++;
      else summary.retryReady++;
      if (u.status !== "accepted" && attempts < 5 && u.nextAttemptAt !== noRetry && !deviceIds.has(u.deviceId))
        summary.awaitingUnpairedDevice++;
      if (u.lastDelivery && (!summary.last || u.lastDelivery.at > summary.last.at)) summary.last = u.lastDelivery;
    }
    return summary;
  }
  async subscribe(owner: string, input: unknown) {
    const params = subscribeInput.parse(input);
    callbackUrl(params.delivery.url);
    secretBytes(params.delivery.secret);
    const id = `sub_${(await hash(`${owner}\n${params.delivery.url}`)).slice(0, 32)}`;
    const previous = await this.store.get(owner, "subscription", "g2");
    const destination = {
      id,
      url: params.delivery.url,
      secret: params.delivery.secret,
      expiresAt: this.now() + Math.min(86_400_000, Math.max(60_000, params.ttlMs ?? 3_600_000)),
    };
    const challenge = crypto.randomUUID();
    let response: { status: number; body: string };
    try {
      response = await this.transport(destination, `verify_${crypto.randomUUID()}`, {
        type: "verification",
        challenge,
      });
    } catch (error) {
      throw new CallbackEndpointError(
        error instanceof Error && error.name === "TimeoutError" ? "timeout" : "connection_refused",
      );
    }
    if (response.status >= 500) throw new CallbackEndpointError("http_5xx");
    if (response.status < 200 || response.status >= 300) throw new CallbackEndpointError("http_4xx");
    let echoed: unknown;
    try {
      echoed = JSON.parse(response.body).challenge;
    } catch {
      /* A non-JSON body cannot echo the challenge. */
    }
    if (echoed !== challenge) throw new CallbackEndpointError("challenge_failed");
    const record = this.record(owner, "subscription", "g2", destination, destination.expiresAt);
    const installed = previous
      ? await this.store.compareAndSwap(record, previous.value)
      : await this.store.insert(record);
    if (!installed) throw new RelayError(409, "Subscription changed during verification; retry");
    return { id, refreshBefore: new Date(destination.expiresAt).toISOString(), cursor: null, truncated: false };
  }
  async unsubscribe(owner: string, input: unknown) {
    const params = z
      .object({
        _meta: requestMeta,
        name: z.literal("utterance.created"),
        arguments: sessionArgs,
        delivery: delivery.omit({ secret: true }),
      })
      .strict()
      .parse(input);
    const record = await this.store.get(owner, "subscription", "g2");
    if (record && (JSON.parse(record.value) as Destination).url === params.delivery.url)
      await this.store.compareAndDelete(owner, "subscription", "g2", record.value);
    return {};
  }
  async submit(device: Device, input: unknown) {
    const parsed = utteranceInput.parse(input);
    const value: Utterance = {
      ...parsed,
      deviceId: device.id,
      createdAt: new Date(this.now()).toISOString(),
      status: "pending",
    };
    await this.limit(device.owner, "utterance-device", device.id, 30);
    await this.limit(device.owner, "utterance-owner", "owner", 60);
    // Request-driven fallback for the scheduled retention sweep: one bounded round per submission. It is best-effort
    // housekeeping; the read fences below stay closed without it, so its failure never blocks a fresh submission.
    try {
      await this.store.sweepExpired(this.cutoff(), 50, new Date(this.now()).toISOString());
    } catch {
      console.warn("retention_fallback_sweep_failed");
    }
    const inserted = await this.store.insertUnlessErased(this.record(device.owner, "utterance", value.id, value));
    const record = await this.store.get(device.owner, "utterance", value.id);
    // Absent only when the owner deleted this ID or a sweep purged it; while its row or fence exists, an expired retry
    // is never revived or delivered.
    if (!record) throw new RelayError(410, "Utterance was deleted");
    if (!this.live(record)) throw new RelayError(410, "Utterance expired");
    const existing: Utterance = JSON.parse(record.value);
    if (!inserted && (existing.text !== value.text || existing.deviceId !== device.id))
      throw new RelayError(409, "Utterance ID already used");
    return this.deliver(device.owner, record);
  }
  private async deliver(owner: string, record: RecordValue): Promise<Utterance> {
    const value: Utterance = JSON.parse(record.value);
    const now = this.now();
    if (
      value.status === "replied" ||
      value.status === "accepted" ||
      (value.deliveryAttempts ?? 0) >= 5 ||
      (value.nextAttemptAt ?? 0) > now ||
      (value.deliveryLeaseUntil ?? 0) > now
    )
      return value;
    const sub = await this.subscription(owner);
    if (!sub) return value; // No callback means no attempt is consumed.
    if (!(await this.store.rateLimit(owner, "event-delivery", "owner", now, 60, 60_000))) return value;
    const claimed: Utterance = {
      ...value,
      deliveryAttempts: (value.deliveryAttempts ?? 0) + 1,
      deliveryLeaseId: crypto.randomUUID(),
      deliveryLeaseUntil: now + 20_000,
    };
    const claim = this.record(owner, "utterance", value.id, claimed);
    if (!(await this.store.compareAndSwap(claim, record.value))) {
      const current = await this.store.get(owner, "utterance", value.id);
      return current ? (JSON.parse(current.value) as Utterance) : value;
    }
    // The awaits above can cross the retention boundary; the claim still holds this exact record, so recheck the clock.
    if (value.createdAt <= this.cutoff()) return claimed;
    let accepted = false;
    let category: DeliveryOutcome["category"];
    let httpStatus: number | null = null;
    try {
      const response = await this.transport(sub, `evt_${value.id}`, {
        eventId: `evt_${value.id}`,
        name: "utterance.created",
        timestamp: value.createdAt,
        data: { session_id: "g2", utterance_id: value.id, text: value.text },
        cursor: null,
      });
      accepted = response.status >= 200 && response.status < 300;
      httpStatus = response.status;
      category = accepted
        ? "accepted"
        : response.status >= 500
          ? "http_5xx"
          : response.status >= 400
            ? "http_4xx"
            : "http_other";
    } catch (error) {
      /* Failure is durable and eligible for a bounded request-driven retry. */
      category =
        error instanceof RelayError
          ? "invalid_response"
          : error instanceof Error && error.name === "TimeoutError"
            ? "timeout"
            : "network";
    }
    const settledAt = this.now();
    const settled: Utterance = {
      ...claimed,
      status: accepted ? "accepted" : "failed",
      deliveryLeaseUntil: 0,
      nextAttemptAt:
        httpStatus === 410 || httpStatus === 413
          ? noRetry
          : settledAt + Math.min(60_000, 2_000 * 2 ** (claimed.deliveryAttempts! - 1)),
      lastDelivery: {
        category,
        httpStatus,
        attempt: claimed.deliveryAttempts!,
        at: new Date(settledAt).toISOString(),
      },
    };
    // A reply or a newer lease acquired after process interruption wins over this settlement.
    await this.store.compareAndSwap(this.record(owner, "utterance", value.id, settled), claim.value);
    const current = await this.store.get(owner, "utterance", value.id);
    return current ? (JSON.parse(current.value) as Utterance) : settled;
  }
  async drain(device: Device) {
    const candidate = await this.store.deliveryCandidate(device.owner, device.id, this.now(), this.cutoff());
    if (candidate) await this.deliver(device.owner, candidate);
  }
  async pendingPage(owner: string, cursor?: string) {
    let after: { createdAt: string; id: string } | undefined;
    if (cursor) {
      try {
        const decoded = JSON.parse(atob(cursor.replace(/-/g, "+").replace(/_/g, "/")));
        after = z.object({ createdAt: z.string().datetime(), id: z.string().uuid() }).strict().parse(decoded);
      } catch {
        throw new RelayError(400, "Invalid pending cursor");
      }
    }
    const records = await this.store.pendingPage(owner, after, this.cutoff());
    const page = records.slice(0, 10).map((record) => JSON.parse(record.value) as Utterance);
    const last = page.at(-1);
    return {
      session_id: "g2",
      utterances: page.map((item) => ({
        utterance_id: item.id,
        text: item.text,
        created_at: item.createdAt,
        status: item.status,
      })),
      next_cursor:
        records.length > 10 && last
          ? btoa(JSON.stringify({ createdAt: last.createdAt, id: last.id }))
              .replace(/\+/g, "-")
              .replace(/\//g, "_")
              .replace(/=+$/, "")
          : null,
    };
  }
  async pending(owner: string) {
    return (await this.store.list(owner, "utterance", undefined, this.cutoff()))
      .map((r) => JSON.parse(r.value) as Utterance)
      .filter((r) => r.status !== "replied")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  async reply(owner: string, input: unknown) {
    const params = z.object({ utterance_id: z.string().uuid(), text }).strict().parse(input);
    const record = await this.store.get(owner, "utterance", params.utterance_id);
    if (!record || !this.live(record)) throw new RelayError(404, "Unknown utterance");
    const value: Utterance = JSON.parse(record.value);
    if (value.reply && value.reply !== params.text)
      throw new RelayError(409, "Utterance already has a different reply");
    value.reply = params.text;
    value.status = "replied";
    const messageId = stageMessageId("final", value.id);
    const message = this.record(owner, "message", messageId, {
      message_id: messageId,
      utterance_id: value.id,
      text: params.text,
      deviceId: value.deviceId,
      stage: "final",
      seq: stageSeq.final,
      createdAt: new Date(this.now()).toISOString(),
    });
    if (!(await this.store.writeReply(this.record(owner, "utterance", value.id, value), record.value, message))) {
      // Deleted while this reply was in flight: report it as gone so the caller stops retrying.
      if (!(await this.store.get(owner, "utterance", value.id))) throw new RelayError(404, "Unknown utterance");
      throw new RelayError(409, "Utterance changed; retry with the same reply");
    }
    return {
      utterance_id: value.id,
      message_id: messageId,
      stage: "final",
      stored_for_g2: true,
      physical_display_confirmed: false,
    };
  }
  // The first stage: shown on G2 while the model works, it leaves the utterance pending for the final answer. It is
  // stored only while the utterance is live and unanswered, so a late or retried acknowledgement never follows a final.
  async acknowledge(owner: string, input: unknown) {
    const params = z
      .object({ utterance_id: z.string().uuid(), text: text.max(500) })
      .strict()
      .parse(input);
    const messageId = stageMessageId("ack", params.utterance_id);
    const stored = { utterance_id: params.utterance_id, message_id: messageId, stage: "ack" as const };
    const settled = async () => {
      const record = await this.store.get(owner, "utterance", params.utterance_id);
      if (!record || !this.live(record)) throw new RelayError(404, "Unknown utterance");
      const existing = await this.store.get(owner, "message", messageId);
      if (existing) {
        if (JSON.parse(existing.value).text !== params.text)
          throw new RelayError(409, "Utterance already has a different acknowledgement");
        return { done: { ...stored, stored_for_g2: true, physical_display_confirmed: false } };
      }
      const value: Utterance = JSON.parse(record.value);
      // Not an error, so the caller does not retry: the final answer is already stored and shown instead.
      if (value.status === "replied")
        return {
          done: { ...stored, stored_for_g2: false, superseded_by_final: true, physical_display_confirmed: false },
        };
      return { pending: value };
    };
    const first = await settled();
    if (first.done) return first.done;
    const message = this.record(owner, "message", messageId, {
      message_id: messageId,
      utterance_id: params.utterance_id,
      text: params.text,
      deviceId: first.pending.deviceId,
      stage: "ack",
      seq: stageSeq.ack,
      createdAt: new Date(this.now()).toISOString(),
    });
    if (await this.store.writeAck(message, params.utterance_id, this.cutoff()))
      return { ...stored, stored_for_g2: true, physical_display_confirmed: false };
    // A concurrent identical retry, a final answer, a deletion or expiry won the race; report what holds now.
    const second = await settled();
    if (second.done) return second.done;
    throw new RelayError(409, "Utterance changed; retry with the same acknowledgement");
  }
  async send(owner: string, input: unknown) {
    const params = z.object({ message_id: z.string().uuid(), text }).strict().parse(input);
    const value = { ...params, createdAt: new Date(this.now()).toISOString() };
    if (!(await this.store.insertUnlessErased(this.record(owner, "message", params.message_id, value)))) {
      const record = await this.store.get(owner, "message", params.message_id);
      if (!record) throw new RelayError(410, "Message was deleted");
      if (!this.live(record)) throw new RelayError(410, "Message expired");
      if (JSON.parse(record.value).text !== params.text) throw new RelayError(409, "Message ID already used");
    }
    return { message_id: params.message_id, stored_for_g2: true, physical_display_confirmed: false };
  }
  // `background` keeps a task running after the response (the Workers request context's waitUntil); without it the
  // task finishes before poll returns.
  async poll(device: Device, background?: (task: Promise<unknown>) => void) {
    const cutoff = this.cutoff();
    // Stored replies are read before the event retry, so a slow callback never delays them.
    const snapshot = await this.store.pollSnapshot(device.owner, device.id, cutoff);
    // One leased event attempt per active device poll; no background execution is promised beyond this request. A
    // failed attempt stays durable for the next poll or resubmission and never fails the read.
    const retry = this.drain(device).catch(() => console.warn("event_retry_failed"));
    if (background) background(retry);
    else await retry;
    return {
      // An acknowledgement stays beside its final answer, so the device can read both; seq orders them on a tie.
      messages: snapshot.messages
        .map((r) => JSON.parse(r.value))
        .filter((r) => !r.deviceId || r.deviceId === device.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || (a.seq ?? 0) - (b.seq ?? 0))
        .slice(-100),
      // Increases once per owner deletion; companions drop cached history when it rises.
      conversation_revision: snapshot.revision,
      // The fence this response was read with: a message whose createdAt is at or before it has expired.
      retention_cutoff: cutoff,
    };
  }
  async messages(device: Device) {
    return (await this.poll(device)).messages;
  }
  async deleteConversations(owner: string) {
    const erased = await this.store.eraseConversations(owner, new Date(this.now()).toISOString());
    return {
      deleted: true,
      utterances: erased.utterances,
      messages: erased.messages,
      conversation_revision: erased.revision,
    };
  }
  // Fixed policy, global and bounded: removes only rows already past retention and reports counts, never rows.
  async sweepExpired() {
    const cutoff = this.cutoff();
    let deleted = 0;
    for (let round = 0; round < SWEEP_ROUNDS; round++) {
      const removed = await this.store.sweepExpired(cutoff, SWEEP_BATCH, new Date(this.now()).toISOString());
      deleted += removed;
      if (removed < SWEEP_BATCH) return { deleted, more: false, cutoff, retentionDays: RETENTION_MS / 86_400_000 };
    }
    return { deleted, more: true, cutoff, retentionDays: RETENTION_MS / 86_400_000 };
  }
  async enforceRetention(caller: string) {
    await this.limit(caller, "retention", "caller", 6);
    return this.sweepExpired();
  }
}
