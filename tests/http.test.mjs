import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { database } from "./helpers/d1.mjs";
import { testPairingSecret } from "./helpers/relay.mjs";

// Test-only module resolution: route code and its D1 store run unchanged, with
// Cloudflare's environment injected locally. No HTTP or provider calls escape.
globalThis.__relayTestEnv = { PAIRING_KEY_ENCRYPTION_KEY: testPairingSecret };
globalThis.__relayBackground = [];
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "cloudflare:workers") return { url: "relay-test:cloudflare", shortCircuit: true };
    const candidate = specifier.startsWith("@/")
      ? new URL(`../${specifier.slice(2)}`, import.meta.url)
      : specifier.startsWith(".") && context.parentURL?.startsWith("file:")
        ? new URL(specifier, context.parentURL)
        : null;
    if (candidate && !candidate.pathname.match(/\.[a-z]+$/i) && existsSync(`${candidate.pathname}.ts`))
      return { url: `${candidate.href}.ts`, shortCircuit: true };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === "relay-test:cloudflare")
      return {
        format: "module",
        // waitUntil keeps background tasks so tests can tell they did not delay the response, then await them.
        source:
          "export const env = globalThis.__relayTestEnv; export const waitUntil = (task) => globalThis.__relayBackground.push(task);",
        shortCircuit: true,
      };
    return nextLoad(url, context);
  },
});
const identity = await import("../app/api/identity/route.ts");
const pairing = await import("../app/api/pairing/route.ts");
const reveal = await import("../app/api/pairing/reveal/route.ts");
const pair = await import("../app/api/device/pair/route.ts");
const utterances = await import("../app/api/device/utterances/route.ts");
const messages = await import("../app/api/device/messages/route.ts");
const status = await import("../app/api/status/route.ts");
const revoke = await import("../app/api/devices/revoke/route.ts");
const conversations = await import("../app/api/conversations/delete/route.ts");
const transcribe = await import("../app/api/device/transcribe/route.ts");
const mcp = await import("../app/mcp/route.ts");

function ownerRequest(owner, path, body, extra = {}) {
  return new Request(`https://relay.test${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "oai-authenticated-user-id": owner,
      ...(body === undefined ? {} : { "Content-Type": "application/json", Origin: "https://relay.test" }),
      ...extra,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
function deviceRequest(token, path, body, extra = {}) {
  return new Request(`https://relay.test${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...extra,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function rpc(owner, method, params) {
  const response = await mcp.POST(
    new Request("https://relay.test/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", "oai-authenticated-user-id": owner },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    }),
  );
  assert.equal(response.status, 200);
  return response.json();
}
async function tool(owner, name, args = {}) {
  const response = await rpc(owner, "tools/call", { name, arguments: args });
  assert(!response.error);
  return response.result;
}
async function provision(owner, spoofOwner) {
  const codeResponse = await pairing.POST(
    ownerRequest(owner, "/api/pairing", { owner: spoofOwner }, { "x-owner-id": spoofOwner }),
  );
  assert.equal(codeResponse.status, 200);
  const { code } = await codeResponse.json();
  const paired = await pair.POST(
    deviceRequest("unused", "/api/device/pair", { code }, { "oai-authenticated-user-id": spoofOwner }),
  );
  assert.equal(paired.status, 200);
  return paired.json();
}

test("HTTP and actual D1 isolate two signed-in tenants, ignoring body and device header owner spoofing", async (t) => {
  const db = database();
  globalThis.__relayTestEnv.DB = db;
  // Legacy single-owner/shared-key values cannot silently restrict or fund other users.
  globalThis.__relayTestEnv.RELAY_OWNER_ID = "alice";
  globalThis.__relayTestEnv.OPENAI_API_KEY = "must-never-reach-a-provider";
  const sent = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(new URL(url).hostname, "connectors.api.openai.com");
    const payload = JSON.parse(options.body);
    if (payload.type === "verification") return Response.json({ challenge: payload.challenge });
    sent.push({ url: String(url), payload });
    return new Response(null, { status: 204 });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    db.sqlite.close();
  });
  for (const user of ["alice", "bob"]) {
    const response = await identity.GET(ownerRequest(user, "/api/identity"));
    assert.deepEqual(await response.json(), { userId: user, ownerConfigured: true, ownerAuthorized: true });
  }
  assert.equal((await identity.GET(new Request("https://relay.test/api/identity"))).status, 401);
  const alice = await provision("alice", "bob");
  const bob = await provision("bob", "alice");
  const secret = `whsec_${Buffer.alloc(32, 7).toString("base64")}`;
  const subscriptions = new Map();
  for (const user of ["alice", "bob"]) {
    const subscription = await rpc(user, "events/subscribe", {
      name: "utterance.created",
      arguments: { session_id: "g2" },
      delivery: { mode: "webhook", url: `https://connectors.api.openai.com/${user}`, secret },
    });
    assert(!subscription.error);
    subscriptions.set(user, subscription.result.id);
  }
  assert.notEqual(subscriptions.get("alice"), subscriptions.get("bob"));
  const id = randomUUID();
  for (const [user, paired, other] of [
    ["alice", alice, "bob"],
    ["bob", bob, "alice"],
  ]) {
    const response = await utterances.POST(
      deviceRequest(
        paired.token,
        "/api/device/utterances",
        { id, text: `${user} 전용 질문` },
        { "oai-authenticated-user-id": other, "x-owner-id": other },
      ),
    );
    assert.equal(response.status, 200);
    const pending = await tool(user, "get_pending_utterances");
    assert.deepEqual(
      JSON.parse(pending.content[0].text).utterances.map((item) => item.text),
      [`${user} 전용 질문`],
    );
  }
  assert.deepEqual(
    sent.map((event) => [new URL(event.url).pathname, event.payload.data.text]),
    [
      ["/alice", "alice 전용 질문"],
      ["/bob", "bob 전용 질문"],
    ],
  );
  const foreignOnly = randomUUID();
  await utterances.POST(
    deviceRequest(alice.token, "/api/device/utterances", { id: foreignOnly, text: "alice 비공개" }),
  );
  assert.equal((await tool("bob", "reply_to_g2", { utterance_id: foreignOnly, text: "침입" })).isError, true);
  assert.equal(
    (await tool("bob", "reply_to_g2", { owner: "alice", utterance_id: foreignOnly, text: "침입" })).isError,
    true,
  );
  for (const user of ["alice", "bob"]) {
    assert(!(await tool(user, "reply_to_g2", { utterance_id: id, text: `${user} 전용 답변` })).isError);
    const own = user === "alice" ? alice : bob;
    const result = await messages.GET(
      deviceRequest(own.token, "/api/device/messages", undefined, {
        "oai-authenticated-user-id": user === "alice" ? "bob" : "alice",
      }),
    );
    assert.deepEqual(
      (await result.json()).messages.map((message) => message.text),
      [`${user} 전용 답변`],
    );
    const snapshot = await status.GET(ownerRequest(user, "/api/status"));
    const value = await snapshot.json();
    assert.equal(value.deviceCount, 1);
    assert.equal(value.subscribed, true);
    assert.equal(value.sttConfigured, false);
    assert.equal(value.transcriptionMode, "phone_direct_soniox");
    assert.equal(value.phoneKeyConfigured, null);
  }
  const messageId = randomUUID();
  for (const user of ["alice", "bob"])
    assert(!(await tool(user, "send_message_to_g2", { message_id: messageId, text: `${user} 전용 알림` })).isError);
  for (const [user, paired] of [
    ["alice", alice],
    ["bob", bob],
  ]) {
    const result = await messages.GET(deviceRequest(paired.token, "/api/device/messages"));
    assert.deepEqual(
      new Set((await result.json()).messages.map((message) => message.text)),
      new Set([`${user} 전용 답변`, `${user} 전용 알림`]),
    );
  }
  await rpc("alice", "events/unsubscribe", {
    name: "utterance.created",
    arguments: { session_id: "g2" },
    delivery: { mode: "webhook", url: "https://connectors.api.openai.com/alice" },
  });
  assert.equal((await (await status.GET(ownerRequest("alice", "/api/status"))).json()).subscribed, false);
  assert.equal((await (await status.GET(ownerRequest("bob", "/api/status"))).json()).subscribed, true);
  const anotherCode = await (await pairing.POST(ownerRequest("alice", "/api/pairing", {}))).json();
  assert.equal(
    (await pair.POST(deviceRequest("unused", "/api/device/pair", { code: anotherCode.code, owner: "bob" }))).status,
    400,
  );
  assert.equal(
    (
      await utterances.POST(
        deviceRequest(alice.token, "/api/device/utterances", {
          id: randomUUID(),
          text: "다른 사용자로 쓰기",
          owner: "bob",
        }),
      )
    ).status,
    400,
  );
  await revoke.POST(ownerRequest("bob", "/api/devices/revoke", { deviceId: alice.deviceId }));
  assert.equal((await messages.GET(deviceRequest(alice.token, "/api/device/messages"))).status, 200);
  await revoke.POST(ownerRequest("bob", "/api/devices/revoke", { all: true }));
  assert.equal((await messages.GET(deviceRequest(bob.token, "/api/device/messages"))).status, 401);
  assert.equal((await messages.GET(deviceRequest(alice.token, "/api/device/messages"))).status, 200);
  assert.equal((await messages.GET(ownerRequest("alice", "/api/device/messages"))).status, 401);
  const speech = await transcribe.POST(deviceRequest(alice.token, "/api/device/transcribe", {}));
  assert.equal(speech.status, 503);
  assert.match((await speech.json()).error, /Per-user/);
});

test("connection key state is Sites-owner scoped metadata; reveal is explicit, same-origin, no-store and owner-only", async (t) => {
  globalThis.__relayTestEnv.DB = database();
  t.after(() => globalThis.__relayTestEnv.DB.sqlite.close());
  assert.equal((await pairing.GET(new Request("https://relay.test/api/pairing"))).status, 401);
  const anonymous = { method: "POST", headers: { Origin: "https://relay.test" } };
  assert.equal((await reveal.POST(new Request("https://relay.test/api/pairing/reveal", anonymous))).status, 401);
  assert.deepEqual(await (await pairing.GET(ownerRequest("alice", "/api/pairing"))).json(), { active: null });
  const issued = await (await pairing.POST(ownerRequest("alice", "/api/pairing", {}))).json();
  assert.deepEqual(Object.keys(issued).sort(), ["code", "createdAt"]);
  const stateResponse = await pairing.GET(ownerRequest("alice", "/api/pairing", undefined, { "x-owner-id": "bob" }));
  assert.equal(stateResponse.headers.get("Cache-Control"), "no-store");
  const state = await stateResponse.json();
  assert.deepEqual(state.active, {
    fingerprint: state.active.fingerprint,
    createdAt: issued.createdAt,
    revealable: true,
    expiresAt: null,
  });
  assert(!JSON.stringify(state).includes(issued.code));
  assert.deepEqual(await (await pairing.GET(ownerRequest("bob", "/api/pairing"))).json(), { active: null });
  // Reveal requires the page's own origin; a cross-site or originless POST is refused.
  for (const origin of [undefined, "https://evil.test"]) {
    const headers = { "oai-authenticated-user-id": "alice", ...(origin ? { Origin: origin } : {}) };
    const refused = await reveal.POST(
      new Request("https://relay.test/api/pairing/reveal", { method: "POST", headers }),
    );
    assert.equal(refused.status, 403);
    assert(!(await refused.text()).includes(issued.code));
  }
  const shown = await reveal.POST(ownerRequest("alice", "/api/pairing/reveal", {}, { "x-owner-id": "bob" }));
  assert.equal(shown.status, 200);
  assert.equal(shown.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await shown.json(), { code: issued.code, fingerprint: state.active.fingerprint });
  const bobs = await reveal.POST(
    ownerRequest("bob", "/api/pairing/reveal", {}, { "oai-authenticated-user-id": "bob" }),
  );
  assert.equal(bobs.status, 404);
  assert(!(await bobs.text()).includes(issued.code));
  const first = await (await pair.POST(deviceRequest("unused", "/api/device/pair", { code: issued.code }))).json();
  const second = await (await pair.POST(deviceRequest("unused", "/api/device/pair", { code: issued.code }))).json();
  assert.deepEqual(Object.keys(first).sort(), ["deviceId", "token"]);
  assert.notEqual(first.token, second.token);
  // Rotating invalidates the old key; existing devices remain.
  const replacement = await (await pairing.POST(ownerRequest("alice", "/api/pairing", {}))).json();
  assert.equal((await pair.POST(deviceRequest("unused", "/api/device/pair", { code: issued.code }))).status, 400);
  assert.equal(
    (await (await reveal.POST(ownerRequest("alice", "/api/pairing/reveal", {}))).json()).code,
    replacement.code,
  );
  assert.equal((await (await status.GET(ownerRequest("alice", "/api/status"))).json()).deviceCount, 2);
  assert.equal((await pair.POST(deviceRequest("unused", "/api/device/pair", { code: replacement.code }))).status, 200);
  // Withdrawing is same-origin, stops new pairing and keeps devices.
  const withdrawRequest = (headers) =>
    new Request("https://relay.test/api/pairing", {
      method: "DELETE",
      headers: { "oai-authenticated-user-id": "alice", ...headers },
    });
  assert.equal((await pairing.DELETE(withdrawRequest({}))).status, 403);
  assert.equal((await pair.POST(deviceRequest("unused", "/api/device/pair", { code: replacement.code }))).status, 200);
  assert.deepEqual(await (await pairing.DELETE(withdrawRequest({ Origin: "https://relay.test" }))).json(), {
    withdrawn: true,
  });
  assert.equal((await pair.POST(deviceRequest("unused", "/api/device/pair", { code: replacement.code }))).status, 400);
  assert.equal((await reveal.POST(ownerRequest("alice", "/api/pairing/reveal", {}))).status, 404);
  assert.equal((await (await status.GET(ownerRequest("alice", "/api/status"))).json()).deviceCount, 4);
  assert.equal((await messages.GET(deviceRequest(first.token, "/api/device/messages"))).status, 200);
});

test("without the connection-key secret, issue and reveal fail closed while pairing, status and the old key keep working", async (t) => {
  globalThis.__relayTestEnv.DB = database();
  const configured = globalThis.__relayTestEnv.PAIRING_KEY_ENCRYPTION_KEY;
  t.after(() => {
    globalThis.__relayTestEnv.PAIRING_KEY_ENCRYPTION_KEY = configured;
    globalThis.__relayTestEnv.DB.sqlite.close();
  });
  const issued = await (await pairing.POST(ownerRequest("alice", "/api/pairing", {}))).json();
  for (const value of [undefined, "not-a-key"]) {
    globalThis.__relayTestEnv.PAIRING_KEY_ENCRYPTION_KEY = value;
    assert.equal((await pairing.POST(ownerRequest("alice", "/api/pairing", {}))).status, 503);
    const shown = await reveal.POST(ownerRequest("alice", "/api/pairing/reveal", {}));
    assert.equal(shown.status, 503);
    assert(!(await shown.text()).includes(issued.code));
    assert.equal((await pair.POST(deviceRequest("unused", "/api/device/pair", { code: issued.code }))).status, 200);
    assert.equal((await status.GET(ownerRequest("alice", "/api/status"))).status, 200);
    assert.equal((await (await pairing.GET(ownerRequest("alice", "/api/pairing"))).json()).active.revealable, true);
  }
  // A key sealed under one secret is reported unrecoverable under another, and is not removed.
  globalThis.__relayTestEnv.PAIRING_KEY_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
  assert.equal((await pairing.POST(ownerRequest("alice", "/api/pairing", {}))).status, 200);
  const sealedUnderOther = await (await pairing.GET(ownerRequest("alice", "/api/pairing"))).json();
  globalThis.__relayTestEnv.PAIRING_KEY_ENCRYPTION_KEY = configured;
  assert.equal((await reveal.POST(ownerRequest("alice", "/api/pairing/reveal", {}))).status, 409);
  assert.deepEqual(await (await pairing.GET(ownerRequest("alice", "/api/pairing"))).json(), sealedUnderOther);
});

test("MCP 2026-07-28 requests with per-request _meta subscribe, clamp TTL, and return complete results", async (t) => {
  const db = database();
  globalThis.__relayTestEnv.DB = db;
  let challenge = (payload) => payload.challenge;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    const payload = JSON.parse(options.body);
    return Response.json({ challenge: challenge(payload) });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    db.sqlite.close();
  });
  const _meta = {
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientCapabilities": {},
    "io.modelcontextprotocol/clientInfo": { name: "chatgpt", version: "1" },
  };
  const discover = await rpc("carol", "server/discover", { _meta });
  assert.equal(discover.result.resultType, "complete");
  assert.deepEqual(discover.result.supportedVersions, ["2026-07-28"]);
  assert.deepEqual(discover.result.capabilities, { tools: {}, events: {} });
  assert.equal(discover.result._meta["io.modelcontextprotocol/serverInfo"].name, "even-g2-cloud-relay");
  for (const method of ["tools/list", "events/list"])
    assert.equal((await rpc("carol", method, { _meta })).result.resultType, "complete");
  const secret = `whsec_${Buffer.alloc(32, 7).toString("base64")}`;
  const subscribe = {
    _meta,
    name: "utterance.created",
    arguments: { session_id: "g2" },
    delivery: { mode: "webhook", url: "https://connectors.api.openai.com/carol", secret },
    cursor: null,
    ttlMs: 7 * 86_400_000,
  };
  const before = Date.now();
  const subscription = await rpc("carol", "events/subscribe", subscribe);
  assert(!subscription.error, JSON.stringify(subscription.error));
  assert.equal(subscription.result.resultType, "complete");
  const granted = Date.parse(subscription.result.refreshBefore) - before;
  assert(granted <= 86_400_000 + 5_000 && granted >= 86_400_000 - 5_000);
  assert.equal(subscription.result.cursor, null);
  const status = await rpc("carol", "tools/call", { _meta, name: "get_status", arguments: {} });
  assert.equal(status.result.resultType, "complete");
  assert.equal(JSON.parse(status.result.content[0].text).subscribed, true);
  challenge = () => "wrong";
  const failed = await rpc("carol", "events/subscribe", {
    ...subscribe,
    delivery: { ...subscribe.delivery, url: "https://connectors.api.openai.com/other" },
  });
  assert.equal(failed.error.code, -32015);
  assert.equal(failed.error.data.reason, "challenge_failed");
  const unsubscribe = await rpc("carol", "events/unsubscribe", {
    _meta,
    name: "utterance.created",
    arguments: { session_id: "g2" },
    delivery: { mode: "webhook", url: "https://connectors.api.openai.com/carol" },
  });
  assert.deepEqual(unsubscribe.result, { resultType: "complete" });
  assert.equal(JSON.parse((await tool("carol", "get_status")).content[0].text).subscribed, false);
});

test("get_status reports unknown phone key and does not claim speech readiness", async (t) => {
  const db = database();
  globalThis.__relayTestEnv.DB = db;
  t.after(() => db.sqlite.close());
  const listed = await rpc("dave", "tools/list", {});
  const { description } = listed.result.tools.find((t) => t.name === "get_status");
  assert.match(description, /phone_direct_soniox/);
  assert.match(description, /sttConfigured refers only to legacy server-side transcription/);
  assert.match(description, /Do not infer phone speech readiness/);
  const value = JSON.parse((await tool("dave", "get_status")).content[0].text);
  assert.equal(value.sttConfigured, false);
  assert.equal(value.transcriptionMode, "phone_direct_soniox");
  assert.equal(value.phoneKeyConfigured, null);
  assert(!/soniox_api_key|apiKey|audio/i.test(JSON.stringify(value)));
});

test("conversation deletion is same-origin Sites owner only, strict, and ignores body owner spoofing", async (t) => {
  const db = database();
  globalThis.__relayTestEnv.DB = db;
  t.after(() => db.sqlite.close());
  const alice = await provision("alice");
  const bob = await provision("bob");
  for (const [paired, text] of [
    [alice, "alice 질문"],
    [bob, "bob 질문"],
  ])
    assert.equal(
      (await utterances.POST(deviceRequest(paired.token, "/api/device/utterances", { id: randomUUID(), text }))).status,
      200,
    );
  const initial = await (await messages.GET(deviceRequest(alice.token, "/api/device/messages"))).json();
  assert.deepEqual(Object.keys(initial), ["messages", "conversation_revision", "retention_cutoff"]);
  assert.deepEqual(initial.messages, []);
  assert.equal(initial.conversation_revision, 0);
  assert.equal(new Date(initial.retention_cutoff).toISOString(), initial.retention_cutoff);
  const remove = (request) => conversations.POST(request);
  assert.equal(
    (await remove(ownerRequest("alice", "/api/conversations/delete", { all: true }, { Origin: "https://evil.test" })))
      .status,
    403,
  );
  assert.equal(
    (
      await remove(
        new Request("https://relay.test/api/conversations/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "https://relay.test" },
          body: JSON.stringify({ all: true }),
        }),
      )
    ).status,
    401,
  );
  assert.equal((await remove(ownerRequest("alice", "/api/conversations/delete", {}))).status, 400);
  assert.equal(
    (await remove(ownerRequest("alice", "/api/conversations/delete", { all: true, owner: "bob" }))).status,
    400,
  );
  assert.equal(
    (
      await remove(
        deviceRequest(alice.token, "/api/conversations/delete", { all: true }, { Origin: "https://relay.test" }),
      )
    ).status,
    401,
  );
  const deleted = await remove(
    ownerRequest("alice", "/api/conversations/delete", { all: true }, { "x-owner-id": "bob" }),
  );
  assert.equal(deleted.status, 200);
  assert.deepEqual(await deleted.json(), { deleted: true, utterances: 1, messages: 0, conversation_revision: 1 });
  assert.equal((await (await status.GET(ownerRequest("alice", "/api/status"))).json()).pendingCount, 0);
  assert.equal((await (await status.GET(ownerRequest("bob", "/api/status"))).json()).pendingCount, 1);
  assert.equal((await (await status.GET(ownerRequest("alice", "/api/status"))).json()).deviceCount, 1);
  assert.equal(
    (await (await messages.GET(deviceRequest(alice.token, "/api/device/messages"))).json()).conversation_revision,
    1,
  );
  assert.equal(
    (await (await messages.GET(deviceRequest(bob.token, "/api/device/messages"))).json()).conversation_revision,
    0,
  );
});

test("MCP retention tool is fixed policy, counts only, and rate limited per caller", async (t) => {
  const db = database();
  globalThis.__relayTestEnv.DB = db;
  t.after(() => db.sqlite.close());
  db.sqlite
    .prepare("INSERT INTO relay_records (owner,kind,id,value,expires_at) VALUES ('alice','message','old',?,NULL)")
    .run(JSON.stringify({ text: "오래된 비밀", createdAt: "2020-01-01T00:00:00.000Z" }));
  const listed = await rpc("erin", "tools/list", {});
  const definition = listed.result.tools.find((item) => item.name === "enforce_conversation_retention");
  assert.deepEqual(definition.inputSchema.properties, {});
  assert.equal(definition.inputSchema.additionalProperties, false);
  const rejected = await tool("erin", "enforce_conversation_retention", { owner: "alice", cutoff: "2030-01-01" });
  assert.equal(rejected.isError, true);
  const text = (await tool("erin", "enforce_conversation_retention")).content[0].text;
  assert(!text.includes("비밀") && !text.includes("alice"));
  const result = JSON.parse(text);
  assert.equal(result.deleted, 1);
  assert.equal(result.more, false);
  assert.equal(result.retentionDays, 30);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM relay_records WHERE kind = 'message'").get().n, 0);
  for (let n = 0; n < 5; n++) assert(!(await tool("erin", "enforce_conversation_retention")).isError);
  const limited = await tool("erin", "enforce_conversation_retention");
  assert.equal(limited.isError, true);
  assert.match(limited.content[0].text, /Rate limit/);
});

test("one MCP retention call stays within the D1 per-invocation query budget at its 20,000-row bound", async (t) => {
  const db = database();
  globalThis.__relayTestEnv.DB = db;
  t.after(() => db.sqlite.close());
  const insert = db.sqlite.prepare("INSERT INTO relay_records (owner,kind,id,value,expires_at) VALUES (?,?,?,?,NULL)");
  db.sqlite.exec("BEGIN");
  for (let n = 0; n < 20_500; n++)
    insert.run(
      `owner${n % 5}`,
      "message",
      `m${n}`,
      JSON.stringify({ text: "x", createdAt: "2020-01-01T00:00:00.000Z" }),
    );
  db.sqlite.exec("COMMIT");
  const prepare = db.prepare.bind(db);
  let statements = 0;
  db.prepare = (sql) => {
    statements++;
    return prepare(sql);
  };
  const first = JSON.parse((await tool("frank", "enforce_conversation_retention")).content[0].text);
  // Rate-limit upsert plus 20 bounded fence + delete batches; D1 Free allows 50 queries per Worker invocation.
  assert.equal(statements, 41);
  assert.deepEqual([first.deleted, first.more], [20_000, true]);
  statements = 0;
  const second = JSON.parse((await tool("frank", "enforce_conversation_retention")).content[0].text);
  assert.deepEqual([second.deleted, second.more, statements], [500, false, 3]);
});

test("MCP acknowledgement and final reach the device poll, which never waits for a blocked callback", async (t) => {
  const db = database();
  globalThis.__relayTestEnv.DB = db;
  const release = Promise.withResolvers();
  const attempted = Promise.withResolvers();
  const delivered = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(new URL(url).hostname, "connectors.api.openai.com");
    const payload = JSON.parse(options.body);
    if (payload.type === "verification") return Response.json({ challenge: payload.challenge });
    delivered.push(payload.data.utterance_id);
    attempted.resolve();
    await release.promise;
    return new Response(null, { status: 204 });
  };
  t.after(() => {
    release.resolve();
    globalThis.fetch = originalFetch;
    db.sqlite.close();
  });
  const listed = await rpc("alice", "tools/list", {});
  const ack = listed.result.tools.find((item) => item.name === "acknowledge_g2_utterance");
  assert.deepEqual(ack.inputSchema.required, ["utterance_id", "text"]);
  assert.equal(ack.inputSchema.properties.text.maxLength, 500);
  const alice = await provision("alice", "bob");
  const bob = await provision("bob", "alice");
  // Stored before any subscription, so the first callback attempt is made by a poll.
  const id = randomUUID();
  assert.equal(
    (await utterances.POST(deviceRequest(alice.token, "/api/device/utterances", { id, text: "자료 찾아줘" }))).status,
    200,
  );
  const subscribed = await rpc("alice", "events/subscribe", {
    name: "utterance.created",
    arguments: { session_id: "g2" },
    delivery: {
      mode: "webhook",
      url: "https://connectors.api.openai.com/alice",
      secret: `whsec_${Buffer.alloc(32, 7).toString("base64")}`,
    },
  });
  assert(!subscribed.error);
  assert.equal((await tool("bob", "acknowledge_g2_utterance", { utterance_id: id, text: "침입" })).isError, true);
  const acked = await tool("alice", "acknowledge_g2_utterance", { utterance_id: id, text: "자료를 찾아볼게요." });
  assert.equal(JSON.parse(acked.content[0].text).stored_for_g2, true);
  globalThis.__relayBackground = [];
  const first = await (await messages.GET(deviceRequest(alice.token, "/api/device/messages"))).json();
  // The response carried the acknowledgement while the callback attempt it started is still blocked.
  assert.deepEqual(
    first.messages.map((m) => [m.message_id, m.stage, m.seq, m.text]),
    [[`ack_${id}`, "ack", 1, "자료를 찾아볼게요."]],
  );
  assert.equal(globalThis.__relayBackground.length, 1);
  await attempted.promise;
  assert.deepEqual(delivered, [id]);
  assert.deepEqual((await (await messages.GET(deviceRequest(bob.token, "/api/device/messages"))).json()).messages, []);
  assert(!(await tool("alice", "reply_to_g2", { utterance_id: id, text: "찾은 자료입니다." })).isError);
  const late = await tool("alice", "acknowledge_g2_utterance", { utterance_id: id, text: "자료를 찾아볼게요." });
  assert.equal(late.isError, undefined);
  const second = await (await messages.GET(deviceRequest(alice.token, "/api/device/messages"))).json();
  assert.deepEqual(
    second.messages.map((m) => [m.message_id, m.stage, m.text]),
    [
      [`ack_${id}`, "ack", "자료를 찾아볼게요."],
      [`reply_${id}`, "final", "찾은 자료입니다."],
    ],
  );
  release.resolve();
  await Promise.all(globalThis.__relayBackground);
  // The callback settled after the reply; the answered utterance stays answered and nothing was sent twice.
  assert.deepEqual(delivered, [id]);
  assert.equal(JSON.parse((await tool("alice", "get_pending_utterances")).content[0].text).utterances.length, 0);
});
