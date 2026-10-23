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
  list(owner: string, kind: string, deviceId?: string): Promise<RecordValue[]>;
  count(owner: string, kind: string): Promise<number>;
  deliveryCandidate(owner: string, deviceId: string, now: number): Promise<RecordValue | null>;
  pendingPage(owner: string, after?: { createdAt: string; id: string }): Promise<RecordValue[]>;
  insert(record: RecordValue): Promise<boolean>;
  put(record: RecordValue): Promise<void>;
  compareAndSwap(record: RecordValue, previous: string): Promise<boolean>;
  writeReply(record: RecordValue, previous: string, message: RecordValue): Promise<boolean>;
  remove(owner: string, kind: string, id: string): Promise<void>;
  compareAndDelete(owner: string, kind: string, id: string, previous: string): Promise<boolean>;
  consumePairing(hash: string, now: number): Promise<RecordValue | null>;
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
  constructor(store: Store, transport: Transport = webhookTransport, now: () => number = Date.now) {
    this.store = store;
    this.transport = transport;
    this.now = now;
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
  async pairing(owner: string) {
    await this.limit(owner, "pairing", "owner", 10);
    const code = randomSecret();
    const expiresAt = this.now() + 600_000;
    await this.store.insert(this.record(owner, "pairing", await hash(code), {}, expiresAt));
    return { code, expiresAt: new Date(expiresAt).toISOString() };
  }
  async pair(code: string) {
    const token = randomSecret();
    const deviceId = crypto.randomUUID();
    const pairing = await this.store.consumePairing(await hash(code), this.now());
    if (!pairing) throw new RelayError(400, "Pairing code is invalid or expired");
    // Consumption is atomic: a failed device insert burns the code safely.
    await this.store.insert(
      this.record(pairing.owner, "device", await hash(token), {
        id: deviceId,
        createdAt: new Date(this.now()).toISOString(),
      }),
    );
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
    const [deviceCount, pendingCount, subscription, utterances, devices] = await Promise.all([
      this.store.count(owner, "device"),
      this.store.count(owner, "utterance"),
      this.subscription(owner),
      this.store.list(owner, "utterance"),
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
    const inserted = await this.store.insert(this.record(device.owner, "utterance", value.id, value));
    const record = await this.store.get(device.owner, "utterance", value.id);
    if (!record) throw new RelayError(503, "Utterance is temporarily unavailable");
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
    const candidate = await this.store.deliveryCandidate(device.owner, device.id, this.now());
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
    const records = await this.store.pendingPage(owner, after);
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
    return (await this.store.list(owner, "utterance"))
      .map((r) => JSON.parse(r.value) as Utterance)
      .filter((r) => r.status !== "replied")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  async reply(owner: string, input: unknown) {
    const params = z.object({ utterance_id: z.string().uuid(), text }).strict().parse(input);
    const record = await this.store.get(owner, "utterance", params.utterance_id);
    if (!record) throw new RelayError(404, "Unknown utterance");
    const value: Utterance = JSON.parse(record.value);
    if (value.reply && value.reply !== params.text)
      throw new RelayError(409, "Utterance already has a different reply");
    value.reply = params.text;
    value.status = "replied";
    const message = this.record(owner, "message", `reply_${value.id}`, {
      message_id: `reply_${value.id}`,
      utterance_id: value.id,
      text: params.text,
      deviceId: value.deviceId,
      createdAt: new Date(this.now()).toISOString(),
    });
    if (!(await this.store.writeReply(this.record(owner, "utterance", value.id, value), record.value, message)))
      throw new RelayError(409, "Utterance changed; retry with the same reply");
    return { utterance_id: value.id, stored_for_g2: true, physical_display_confirmed: false };
  }
  async send(owner: string, input: unknown) {
    const params = z.object({ message_id: z.string().uuid(), text }).strict().parse(input);
    const value = { ...params, createdAt: new Date(this.now()).toISOString() };
    if (!(await this.store.insert(this.record(owner, "message", params.message_id, value)))) {
      const existing = JSON.parse((await this.store.get(owner, "message", params.message_id))!.value);
      if (existing.text !== params.text) throw new RelayError(409, "Message ID already used");
    }
    return { message_id: params.message_id, stored_for_g2: true, physical_display_confirmed: false };
  }
  async messages(device: Device) {
    // One leased event attempt per active device poll; no background execution is promised.
    await this.drain(device);
    return (await this.store.list(device.owner, "message", device.id))
      .map((r) => JSON.parse(r.value))
      .filter((r) => !r.deviceId || r.deviceId === device.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(-100);
  }
}
