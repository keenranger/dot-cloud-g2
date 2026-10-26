import { env } from "cloudflare:workers";
import { z } from "zod";
import { Relay, RelayError, importPairingSecret, ownerIdentity as sitesIdentity } from "./core";
import { D1Store } from "./store";

export function runtime() {
  const bindings = env as unknown as { DB?: D1Database; PAIRING_KEY_ENCRYPTION_KEY?: string };
  if (!bindings.DB) throw new RelayError(503, "Database is not configured");
  return {
    relay: new Relay(
      new D1Store(bindings.DB),
      undefined,
      undefined,
      importPairingSecret(bindings.PAIRING_KEY_ENCRYPTION_KEY),
    ),
    // Shared server credentials must never authorize transcription for arbitrary tenants.
    // A per-user credential resolver can replace this fail-closed value after billing is chosen.
    apiKey: undefined as string | undefined,
  };
}
export async function boundedBody(request: Request, maximum: number) {
  const length = request.headers.get("content-length");
  if (length && Number(length) > maximum) throw new RelayError(413, "Request body is too large");
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maximum) throw new RelayError(413, "Request body is too large");
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
  return bytes;
}
export async function jsonBody(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
    throw new RelayError(415, "Use application/json");
  try {
    return JSON.parse(new TextDecoder().decode(await boundedBody(request, 32_768)));
  } catch (error) {
    if (error instanceof RelayError) throw error;
    throw new RelayError(400, "Invalid JSON");
  }
}
export function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}
export function failure(error: unknown) {
  if (error instanceof RelayError) return json({ error: error.message }, error.status);
  if (error instanceof z.ZodError) return json({ error: "Invalid request parameters" }, 400);
  return json({ error: "Request could not be completed" }, 500);
}
export async function deviceIdentity(request: Request, relay: Relay) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) throw new RelayError(401, "Device token is required");
  return relay.authenticate(authorization.slice(7));
}
export function identityConfiguration(request: Request) {
  const userId = sitesIdentity(request);
  return {
    userId,
    ownerConfigured: true,
    ownerAuthorized: true,
  };
}
export function ownerIdentity(request: Request) {
  return sitesIdentity(request);
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) throw new RelayError(403, "Same-origin request required");
}
// Device routes use bearer authentication only, with no cookie or Sites identity fallback.
export function deviceCors(response: Response) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  return response;
}
export function deviceOptions() {
  return deviceCors(new Response(null, { status: 204 }));
}
