import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Local production-Worker fixture only. Never send synthetic identity headers to a hosted Site.
// No singleton owner environment variable or shared speech credential is required.
const base = new URL(process.argv[2] ?? "http://127.0.0.1:5174");
assert.equal(base.hostname, "127.0.0.1", "This fixture is restricted to loopback");
const fixtureId = randomUUID();
const owner = { "oai-authenticated-user-id": `local_api_fixture_${fixtureId}` };
const otherOwner = { "oai-authenticated-user-id": `other_api_fixture_${fixtureId}` };
const jsonHeaders = { "Content-Type": "application/json" };
async function request(path, body, headers = {}) {
  return fetch(new URL(path, base), {
    method: body === undefined ? "GET" : "POST",
    headers: { ...jsonHeaders, ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function rpc(method, params, identity = owner) {
  const response = await request("/mcp", { jsonrpc: "2.0", id: randomUUID(), method, params }, identity);
  const payload = await response.text();
  assert.equal(response.status, 200, `${method}: ${payload}`);
  const body = JSON.parse(payload);
  assert.equal(body.error, undefined);
  return body.result;
}

assert.equal((await request("/api/status")).status, 401);
for (const identity of [owner, otherOwner]) {
  const status = await request("/api/status", undefined, identity);
  assert.equal(status.status, 200);
  assert.equal((await status.json()).sttConfigured, false);
  const identityResponse = await (await request("/api/identity", undefined, identity)).json();
  assert.equal(identityResponse.userId, identity["oai-authenticated-user-id"]);
  assert.equal(identityResponse.ownerAuthorized, true);
}
assert.equal((await request("/api/pairing", {}, owner)).status, 403);
const blockedMcp = await (await request("/mcp", {}, { ...owner, Origin: base.origin })).json();
assert.equal(blockedMcp.error.message, "Browser requests are not accepted on MCP");
const discovery = await rpc("server/discover", {});
assert.deepEqual(discovery.capabilities.events, {});

const paired = await request("/api/pairing", {}, { ...owner, Origin: base.origin });
assert.equal(paired.status, 200);
const { code, createdAt } = await paired.json();
const attempts = await Promise.all([request("/api/device/pair", { code }), request("/api/device/pair", { code })]);
// A used connection key stays valid with no expiry; each redemption is its own device token.
assert.deepEqual(
  attempts.map((result) => result.status),
  [200, 200],
);
const [{ token, deviceId }, reused] = await Promise.all(attempts.map((result) => result.json()));
assert.notEqual(reused.token, token);
const pairingState = await (await request("/api/pairing", undefined, owner)).json();
assert.equal(pairingState.active.createdAt, createdAt);
assert.equal(pairingState.active.expiresAt, null);
assert.equal(pairingState.active.revealable, true);
const revealed = await request("/api/pairing/reveal", {}, { ...owner, Origin: base.origin });
assert.equal(revealed.headers.get("cache-control"), "no-store");
assert.equal((await revealed.json()).code, code);
assert.equal((await request("/api/pairing/reveal", {}, owner)).status, 403);
assert.equal((await request("/api/pairing/reveal", {}, { ...otherOwner, Origin: base.origin })).status, 404);
assert.match(pairingState.active.fingerprint, /^[a-f0-9]{64}$/);
assert.equal((await (await request("/api/pairing", undefined, otherOwner)).json()).active, null);
const replacement = await (await request("/api/pairing", {}, { ...owner, Origin: base.origin })).json();
assert.equal((await request("/api/device/pair", { code })).status, 400);
assert.equal((await request("/api/device/pair", { code: replacement.code })).status, 200);
assert.equal((await request("/api/status", undefined, owner).then((r) => r.json())).deviceCount, 3);
// Withdrawing the key stops new pairing and keeps every paired device.
const withdrawn = await fetch(new URL("/api/pairing", base), {
  method: "DELETE",
  headers: { ...owner, Origin: base.origin },
});
assert.equal(withdrawn.status, 200);
assert.equal((await request("/api/device/pair", { code: replacement.code })).status, 400);
assert.equal((await (await request("/api/pairing", undefined, owner)).json()).active, null);
assert.equal((await request("/api/status", undefined, owner).then((r) => r.json())).deviceCount, 3);
const device = { Authorization: `Bearer ${token}` };
const otherCode = await (await request("/api/pairing", {}, { ...otherOwner, Origin: base.origin })).json();
const otherPaired = await request("/api/device/pair", { code: otherCode.code });
assert.equal(otherPaired.status, 200);
const otherDevice = { Authorization: `Bearer ${(await otherPaired.json()).token}` };
const utteranceId = randomUUID();
const submitted = await request(
  "/api/device/utterances",
  { id: utteranceId, text: "안경에서 보낸 한국어 입력" },
  { ...device, ...otherOwner },
);
assert.equal(submitted.status, 200);
const pending = await rpc("tools/call", { name: "get_pending_utterances", arguments: {} });
assert.equal(pending.isError, undefined);
assert.ok(JSON.parse(pending.content[0].text).utterances.some((row) => row.utterance_id === utteranceId));
const foreignPending = await rpc("tools/call", { name: "get_pending_utterances", arguments: {} }, otherOwner);
assert.deepEqual(JSON.parse(foreignPending.content[0].text).utterances, []);
const forbiddenReply = await rpc(
  "tools/call",
  { name: "reply_to_g2", arguments: { utterance_id: utteranceId, text: "다른 사용자의 응답" } },
  otherOwner,
);
assert.equal(forbiddenReply.isError, true);
const replied = await rpc("tools/call", {
  name: "reply_to_g2",
  arguments: { utterance_id: utteranceId, text: "로컬 응답 연결 확인" },
});
assert.equal(replied.isError, undefined);
const messages = await (await request("/api/device/messages", undefined, { ...device, ...otherOwner })).json();
assert.ok(messages.messages.some((row) => row.utterance_id === utteranceId && row.text === "로컬 응답 연결 확인"));
assert.deepEqual((await (await request("/api/device/messages", undefined, otherDevice)).json()).messages, []);
assert.equal((await request("/api/device/messages", undefined, owner)).status, 401);
assert.equal((await request("/api/device/transcribe", {}, device)).status, 503);
const preflight = await fetch(new URL("/api/device/messages", base), {
  method: "OPTIONS",
  headers: { Origin: "https://even-fixture.example", "Access-Control-Request-Headers": "authorization" },
});
assert.equal(preflight.status, 204);
assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), "*");
assert.equal((await request("/api/devices/revoke", { deviceId }, { ...otherOwner, Origin: base.origin })).status, 200);
assert.equal((await request("/api/device/messages", undefined, device)).status, 200);
assert.equal((await request("/api/devices/revoke", { all: true }, { ...otherOwner, Origin: base.origin })).status, 200);
assert.equal((await request("/api/device/messages", undefined, otherDevice)).status, 401);
assert.equal((await request("/api/device/messages", undefined, device)).status, 200);
assert.equal((await request("/api/devices/revoke", { all: true }, { ...owner, Origin: base.origin })).status, 200);
assert.equal((await request("/api/device/messages", undefined, device)).status, 401);
assert.equal((await request("/api/device/pair", { code: replacement.code })).status, 400);
assert.equal((await (await request("/api/pairing", undefined, owner)).json()).active, null);
console.log(
  "PASS local Worker HTTP: multiuser identity/CSRF gates, permanent owner-scoped connection key with reveal/withdraw, tenant-isolated Korean utterance and MCP reply, token-scoped messages, device CORS, isolated revocation, shared STT disabled",
);
console.log("Not verified: hosted identity, real Dot subscription/webhook, STT provider, physical G2");
