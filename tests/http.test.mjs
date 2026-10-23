import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { database } from "./helpers/d1.mjs";

// Test-only module resolution: route code and its D1 store run unchanged, with
// Cloudflare's environment injected locally. No HTTP or provider calls escape.
globalThis.__relayTestEnv = {};
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
      return { format: "module", source: "export const env = globalThis.__relayTestEnv;", shortCircuit: true };
    return nextLoad(url, context);
  },
});
const identity = await import("../app/api/identity/route.ts");
const pairing = await import("../app/api/pairing/route.ts");
const pair = await import("../app/api/device/pair/route.ts");
const utterances = await import("../app/api/device/utterances/route.ts");
const messages = await import("../app/api/device/messages/route.ts");
const status = await import("../app/api/status/route.ts");
const revoke = await import("../app/api/devices/revoke/route.ts");
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
