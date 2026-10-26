# Lens MCP for G2

Lens MCP for G2 (source project: Dot Cloud G2) connects Even G2 to ChatGPT Dot without a Mac relay, using a Sites-hosted relay and an Even Hub companion. Each user signs in with ChatGPT, pairs their own companion with a short-lived pairing code, and connects their own Dot. Speech is not transcribed on the device: the companion streams audio from the phone directly to Soniox's cloud over WebSocket with the user's own API key, and only the resulting transcript reaches the relay. The relay delivers utterance events to Dot, then returns its MCP reply to the paired G2. An actual cloud Dot has reported an active subscription. Separately, a proactive message sent through the native MCP from the root Codex development conversation was physically confirmed on G2 by the user; no cloud-Dot-initiated physical reply and no complete Mac-off voice round trip has been verified.

This project is independent of the upstream Dot Link reference checkout (`even-g2-dots`). It does not install a Mac background service or require Tailscale.

## Architecture

```text
G2 microphone → Even Hub companion ⇄ Soniox real-time STT (user's key, direct WSS)
                     ↓ transcript text only
               relay → durable utterance
                                                       ↓ signed MCP webhook
                                                  ChatGPT Dot
                                                       ↓ reply_to_g2
G2 display ← Even Hub companion ← authenticated message API ← durable reply
```

Sites provides a public server, D1 storage, and native Sign in with ChatGPT. Each signed-in user has their own tenant identity from Sites-injected headers. Device records, pairing codes, utterances, subscriptions, and replies are scoped to that identity. Device requests use a separately issued bearer token; no browser cookie or shared Sites service-access token is copied into the companion.

The companion includes optional phone-local `Hey dots` detection using packaged sherpa-onnx WASM keyword spotting and Silero VAD from the Dot Link reference. Listening is on by default in the companion, can be turned off there (0.5.0 remembers an explicit OFF/ON choice), and opens the G2 microphone only while the companion's G2 page is open, paired, has a Soniox key and has the G2 page ready. By app policy, a locked phone or a backgrounded Even app does not stop listening, manual G2 capture or replies, and only the G2 microphone is used; whether the Even app keeps the companion running while the phone is locked is not yet verified on a device. Only the post-cue command is sent to Soniox from the phone. Wake detection itself needs neither Live nor an inference API key. English cue pronunciation and Korean command transcription are separate concerns; real `Hey dots` recognition accuracy is not established by offline loading or silence tests.

The server implements MCP events. A real Dot has reported an active subscription through the Sites plugin, but event delivery of a spoken utterance and the correlated reply have not been proven. The requested event-driven integration is not complete until an actual Dot subscribes, receives an event, and calls the reply tool. Polling the device response API does not replace that requirement.

Unanswered utterances survive callback failures. Active device polling or resubmitting the same ID can retry delivery with the same event ID, a durable lease, backoff, and at most five attempts. This is request-driven recovery, not a background job guarantee. `get_pending_utterances` accepts an optional `cursor`; follow `next_cursor` until null to inspect the whole unanswered backlog.

## Local development

```sh
pnpm install
pnpm test
pnpm typecheck
pnpm lint
pnpm run build
pnpm run dev -- --host 127.0.0.1
```

The portable Sites starter simulates ChatGPT sign-in only in local development. Local mock authentication does not establish hosted Sign in with ChatGPT success. Preserve the starter's Sites integration and dispatch-owned authentication routes.

`node tests/http-smoke.mjs` is the local production-Worker HTTP harness on loopback port 5174, with all local migrations applied. Synthetic signed-in identities are restricted to loopback. The multiuser smoke scenario covers authentication and CSRF, separate user data, owner-scoped reusable pairing (reuse until expiry, replacement and revoke-all invalidation), a Korean text utterance, correlated MCP replies, CORS, and scoped device revocation. Record the actual run result separately; this fixture does not contact Dot or a speech provider and does not prove hosted tenant isolation.

Generate migrations after changing `db/schema.ts` with `pnpm db:generate`. Apply each migration to a local database once, using the generated build config:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_many_adam_destine.sql
```

Apply any later migration files in order. Hosted migrations are applied by the Sites deployment workflow; do not replay local SQL against production.

## Hosted configuration

- D1 binding: `DB`, declared in `.openai/hosting.json`.
- MCP capability: `mcp`, declared in the same manifest.
- Public ingress allows each user to sign in and manage only their own connections. No single-user allowlist or account ID setup is required.
- Speech transcription needs no Site configuration. Each user enters their own Soniox API key in the companion on their phone (see [Speech recognition key](#speech-recognition-key)). Do not configure a shared speech API key on the server, and never ask users to enter a key on the Site.
- ChatGPT sign-in establishes identity; it does not supply speech API credentials or include API usage. The legacy server-side transcription adapter (OpenAI audio transcriptions) is not an enabled public service: it fails closed because the runtime supplies no server credential, so `/api/device/transcribe` returns 503 before reading any audio body. `sttConfigured` in the status API reports only that legacy server setting; it says nothing about whether a phone has a Soniox key, which the server cannot observe.

The public Site accepts non-cookie device bearer requests while management and MCP operations require the current user's trusted ChatGPT identity. Public ingress must not permit unauthenticated management or access to another user's records. No platform service-access token belongs in the companion.

Hosted verification must prove that Sites strips forged identity headers, passes device Authorization and OPTIONS requests correctly, and supplies the same trusted per-user identity to the generated MCP plugin. These are platform gates, not established by unit tests.

## Pair and connect

Setup involves two independent connections. The Even Hub device pairing links the G2 companion to this relay with a short-lived pairing code and a device bearer token. The ChatGPT MCP connection links Dot to the relay's MCP endpoint at `<origin>/mcp` (hosted: `https://hey-dots-g2.keenranger.chatgpt.site/mcp`). Neither connection substitutes for the other.

1. Open the hosted setup page and use Sign in with ChatGPT.
2. Review your personal connection status. No account ID configuration is required. The dashboard shows a sanitized summary of the latest Dot delivery attempt (category, HTTP status, time, retry counts) without utterance text, callback URLs, response bodies, or keys. A receipt means the callback endpoint accepted the event, not that Dot processed it or that G2 displayed a reply.
3. ChatGPT MCP connection, web first: the Site's native MCP plugin must be installed in ChatGPT. If it is not, add `<origin>/mcp` as a custom MCP server on the ChatGPT Plugins page in ChatGPT on the web in a desktop browser and install it, following [Connect a custom MCP server](https://developers.openai.com/api/docs/guides/custom-mcp-server); that guide documents the web flow only. Then ask Dot in chat to subscribe to `utterance.created` with session `g2` and call `reply_to_g2` with the event's `utterance_id` and Korean reply text. Per the MCP Events guide, ChatGPT itself calls `events/subscribe` when a user asks to monitor an event; the plugin exposes no subscribe tool, and the dashboard's subscription status only reports whether that call has reached the relay.
4. Even Hub device pairing: create a pairing code on the setup page. Each signed-in owner has at most one active code. It can be redeemed repeatedly until its fixed 10-minute expiry (redemption never extends it); each redemption creates a separate device token, limited to 10 redemptions per owner per minute. Creating a new code invalidates the previous one at once, and disconnecting all devices withdraws it; already paired devices stay paired when a new code is created. The dashboard keeps the code in this browser tab's session storage, so it can be shown and copied again after a reload of the same tab, but only while the relay reports it as the owner's active, unexpired code (`GET /api/pairing` returns its hash and expiry, never the code). Other tabs, browsers and devices cannot retrieve it; the relay stores only its hash.
5. Build/package `even-app` with the exact deployed HTTPS relay origin in its network whitelist, then install it through Even Hub (Me > Apps > Private builds for an authorized Private upload). Enter the relay origin (without `/mcp`) and pairing code in the companion.
6. Enter your Soniox API key in the companion's settings (see below). Speak, or type a message and use the Send button. The companion polls for replies while its G2 page is open (it does not stop polling on a phone lock itself; behavior while locked is not yet verified on a device) and sends each whole reply to an event-capturing G2 text container for native wrapping and scrolling (scroll behavior is not yet verified on physical G2); only a reply over the SDK's 2,000-character upgrade limit is split into parts. G2 display acknowledgements confirm the update request, not what is visible on the glasses.

Alternatively say `Hey dots` while the companion is active; listening is on by default and can be turned off. This does not wake an exited or suspended Even app. The interface shows microphone/listening state, and manual and text controls remain available.

What the fetched OpenAI docs establish, and what they do not:

- [Get started with your dot](https://learn.chatgpt.com/docs/dots/getting-started): a dot can be set up in the ChatGPT mobile app, desktop app, or a desktop browser (mobile web is not supported), and the same dot continues across devices after setup. The page does not describe adding a custom MCP server to a dot.
- [Connect a custom MCP server](https://developers.openai.com/api/docs/guides/custom-mcp-server): custom servers are added on ChatGPT on the web over SSE or streaming HTTP. Mobile registration is not described.
- [MCP Events](https://developers.openai.com/plugins/build/mcp-events): events are available in Work chats on ChatGPT web, Work chats in the desktop app with Cloud selected, and Dots, using webhook delivery and MCP protocol version `2026-07-28`. iOS and Android are not mentioned, so event delivery while using a dot from the iPhone app is unverified.

See [the companion README](even-app/README.md) for SDK interaction and build details. A successful server receipt proves storage or callback acceptance, not Dot processing or a visible physical display.

## Speech recognition key

Transcription is processed in Soniox's cloud, called directly from the phone with the user's own [Soniox](https://soniox.com) account. The Site never receives, stores, or relays the key, and no server-side key setup is required.

1. In the Soniox console, create an API key that has the real-time transcription permission. See [API key permissions](https://soniox.com/docs/guides/api-key-permissions).
2. On the phone, open the Lens MCP for G2 app in Even Hub, open its settings, and paste the key.
3. By default the key is held in memory for the current app session only. Optionally choose to remember it, which keeps it in Even Hub app storage on that phone. The same settings let you clear or replace the key at any time.

Security notes:

- The key is a root API key for the user's Soniox account and is billed there. A remembered key is only as safe as the phone, its OS, and the Even Hub app; the companion does not add its own encryption and cannot make the key theft-proof. Prefer not to remember it on a shared or untrusted phone, and revoke it in the Soniox console if the phone is lost.
- Audio goes from the phone directly to Soniox. The transcript text then goes to this relay, is stored in D1, and is delivered to Dot.
- The server cannot tell whether a phone has a key configured; check the companion.

## Data and privacy

The relay does not receive or persist raw audio. Audio is sent from the phone to Soniox under the user's own account and Soniox's policy. The legacy server-side transcription adapter remains disabled and fails closed before reading audio. Text utterances, replies, proactive agent messages, subscriptions, and device records persist in D1. Proactive messages sent with `send_message_to_g2` carry no device ID and are stored for, and delivered to, every paired device of that owner.

**Version status.** Sites version 6 deployed successfully on 2026-10-24 at 12:16:10.672605 UTC from signed source `7f48b9c4d217e4e111477c5aed261c08133ed841`. Even Hub CLI upload and read-back confirmed version 0.5.0, build 120792, Private, with no channels. Public store release, beta promotion and policy approval are not established. The Sites workflow applies migration `0003`; this is not independent verification of hosted D1 schema, atomic batches, returned metadata or quota.

See [0.5.0 deployment evidence](docs/release-0.5.0-deployment.md) for exact deployment and artifact identities. Cleanup scheduling is not active; hosted D1 batch/write/quota behavior and physical QA remain open.

Conversation retention and deletion in the 0.5.0 candidate (the owner approved this requirement):

- **30-day read and delivery cutoff.** Every conversation read, delivery and retry is fenced by `createdAt` in UTC: a record created 30 days or more ago (`createdAt <= now - 30 days`) is no longer returned, delivered, retried or replied to, whether or not it has been physically removed. This covers utterances, replies, proactive messages, legacy rows and rows of revoked devices. A retry of an expired ID gets `410`.
- **Owner erase.** The signed-in owner can erase all of their conversations immediately from the dashboard (same-origin request with Sites identity only; device tokens cannot call it). One transaction deletes the owner's utterances and messages, writes text-free tombstones (a timestamp only, no content) so that late retries of erased IDs are refused with `410`, and increments a conversation revision. The companion clears its cached replies when it sees the higher revision on its next active poll. Devices, pairing, subscriptions and rate-limit rows are not affected. Tombstones themselves fall under the 30-day cutoff.
- **Physical cleanup is not live.** A scheduled daily purge at 03:00 Asia/Seoul is intended but is **not activated or published**. When activated, each run targets up to 20,000 rows through bounded, rate-limited maintenance tool calls (at most 20 rounds of 1,000 rows, with 41 SQL statements including rate limiting). Under that policy, physical removal after the 30-day cutoff can lag by up to 24 hours while the job is healthy; failed runs and backlogs beyond one run's capacity add further delay. No physical deletion on exactly day 30, and no automatic deletion today, is claimed.
- **Outside the relay's reach.** Content already sent to ChatGPT (Dot) or Soniox, or already shown on the phone or G2, cannot be erased by the relay. Provider copies, infrastructure logs and backups are outside this guarantee and have not been audited.
- Expired pairing, subscription and rate-limit rows become unusable but are not purged by a scheduled job.

Do not treat this service as production-ready for sensitive conversations.

Pairing codes and device tokens are stored as hashes. Callback signing secrets remain server-side. User management and MCP operations require trusted Sites identity and scope database operations to that user. Device APIs accept only their scoped bearer tokens. Pairing-code creation and redemption (per owner), utterance submission, and speech calls have server-side rate limits. Redemption of an unknown code is not rate limited; codes are 256-bit random values, so guessing is not practical, but such requests still cost a database lookup. Device revocation is available on each user's dashboard and affects only their own devices. Revocation deletes the device's authentication record; it is not conversation deletion, and that device's past utterances and messages remain stored under the owner (until the owner erases them or, in the 0.5.0 candidate, they pass the 30-day cutoff).

## Acceptance gates

- Local tests, type checking, production build, and companion build: record actual results separately.
- Hosted Sign in with ChatGPT, cross-user isolation, pairing, CORS and manifest permissions: unverified until deployed and exercised.
- Actual Dot event subscription: a real Dot has reported subscribed. Signed callback delivery of a spoken utterance and its correlated reply: unverified.
- Real Korean audio transcription through phone-direct Soniox and its latency: unverified; requires a user-supplied key and an actual recording on the phone.
- Full Mac-off voice round trip (speech, transcript, Dot reply, G2 display): unverified.
- 0.5.0 retention and owner erase: deployed through Sites, but independent hosted D1 checks, a scheduled purge actually removing rows, the companion clearing its cache on a real G2 after an erase, and ChatGPT tool behavior after an erase are unverified. The daily purge schedule is not activated.
- Physical G2 microphone, gestures, Hangul glyphs, and paging: unverified. A proactive native-MCP message from the root Codex development conversation was physically confirmed on G2 by the user; a cloud-Dot-initiated reply on a physical G2 has not been observed.

No local check proves these external gates. The goal remains open until the requested real account/device round trip works.

## References

- [Even Hub device APIs](https://hub.evenrealities.com/docs/build/device-apis)
- [ChatGPT dots: getting started](https://learn.chatgpt.com/docs/dots/getting-started)
- [OpenAI custom MCP server](https://developers.openai.com/api/docs/guides/custom-mcp-server)
- [OpenAI MCP events](https://developers.openai.com/plugins/build/mcp-events)
- [OpenAI speech transcription](https://developers.openai.com/api/docs/guides/speech-to-text)
- [Dot Link reference implementation](https://github.com/YusukeIt0/dot-link)

## Local retention verification update

Physical sweeps delete expired conversation content and atomically leave owner-scoped, text-free ID fences (identifiers and sweep timestamp only). These fences reject same-ID retries with `410` for 30 further days from the sweep, then expire without replacement. This is bounded retry protection, not a permanent ID guarantee.

Each maintenance invocation targets at most 20,000 rows and uses at most 41 SQL statements including rate limiting. Fence insertion and later deletion add metadata storage and index writes; hosted D1 plan, quota, actual rows written and batch-result behavior remain unverified activation gates. Measure the first hosted sweep before activating the intended daily 03:00 Asia/Seoul cleanup. The schedule remains unactivated.

Submission-time fallback cleanup is best-effort: failure logs only the constant, non-content warning `retention_fallback_sweep_failed` and does not block a fresh submission. Read and expiry fences still apply; insertion failures remain errors.

Final parent checks passed: root tests 95/95, companion tests 100/100, companion runtime scenarios 41/41, root lint/typecheck/build, companion lint/typecheck:test/build, pinned wake-asset verification, and diff checks. The bounded independent corrected-source review closed the initial sweep-resurrection, callback-expiry and phone-expiry findings with no actionable findings. Tests use SQLite/D1 shims and fake host/provider boundaries; they do not establish hosted D1 or physical behavior. Independent verification of hosted migration 0003, atomic batch behavior, deletion metadata, quota, schedule activation and real-device validation remain open.

## Historical runtime evidence (2026-10-23, 0.3.0)

At the 0.3.0 upload, the relay was deployed and the Private companion upload size matched the local package (see the historical snapshot in `AGENTS.md`). The signed-in owner's native MCP `get_status` reported one paired device, an active subscription, no pending utterances and `delivery.last: null`; an edge device-route CORS preflight returned the expected headers. These are dated observations, not current runtime verification. Neither deployment nor upload establishes phone installation, actual WebView CORS/manifest permissions, cross-user isolation with another real account, Soniox latency, or a Mac-off voice round trip.

The `eventTransport` status field stays `unverified` by design; runtime evidence instead requires a recorded accepted delivery attempt followed by a `reply_to_g2` for the same utterance ID. This historical note does not replace the current acceptance gates above.
