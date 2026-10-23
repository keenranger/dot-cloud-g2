# Dot Cloud G2

Dot Cloud G2 connects Even G2 to ChatGPT Dot without a Mac relay, using a Sites-hosted relay and an Even Hub companion. Each user signs in with ChatGPT, pairs their own companion with a one-time code, and connects their own Dot. The intended voice flow delivers utterance events to Dot, then returns its MCP reply to the paired G2. Actual hosted event delivery and physical G2 behavior remain unverified.

This project is independent of the upstream Dot Link reference checkout (`even-g2-dots`). It does not install a Mac background service or require Tailscale.

## Architecture

```text
G2 microphone → Even Hub companion → cloud STT (disabled) → durable utterance
                                                       ↓ signed MCP webhook
                                                  ChatGPT Dot
                                                       ↓ reply_to_g2
G2 display ← Even Hub companion ← authenticated message API ← durable reply
```

Sites provides a public server, D1 storage, and native Sign in with ChatGPT. Each signed-in user has their own tenant identity from Sites-injected headers. Device records, pairing codes, utterances, subscriptions, and replies are scoped to that identity. Device requests use a separately issued bearer token; no browser cookie or shared Sites service-access token is copied into the companion.

The companion includes optional phone-local `Hey dots` detection using packaged sherpa-onnx WASM keyword spotting and Silero VAD from the Dot Link reference. Listening starts off and is explicitly enabled in the companion. The intended flow sends only the post-cue command to cloud transcription; transcription is currently disabled pending a per-user credential and billing design. Wake detection itself needs neither Live nor an inference API key. English cue pronunciation and Korean command transcription are separate concerns; real `Hey dots` recognition accuracy is not established by offline loading or silence tests.

The server implements MCP events, but the Sites plugin's discovery and forwarding of event subscriptions has not been proven. The requested event-driven integration is not complete until an actual Dot subscribes, receives an event, and calls the reply tool. Polling the device response API does not replace that requirement.

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

`node tests/http-smoke.mjs` is the local production-Worker HTTP harness on loopback port 5174, with all local migrations applied. Synthetic signed-in identities are restricted to loopback. The multiuser smoke scenario covers authentication and CSRF, separate user data, one-use pairing, a Korean text utterance, correlated MCP replies, CORS, and scoped device revocation. Record the actual run result separately; this fixture does not contact Dot or a speech provider and does not prove hosted tenant isolation.

Generate migrations after changing `db/schema.ts` with `pnpm db:generate`. Apply each migration to a local database once, using the generated build config:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_many_adam_destine.sql
```

Apply any later migration files in order. Hosted migrations are applied by the Sites deployment workflow; do not replay local SQL against production.

## Hosted configuration

- D1 binding: `DB`, declared in `.openai/hosting.json`.
- MCP capability: `mcp`, declared in the same manifest.
- Public ingress allows each user to sign in and manage only their own connections. No single-user allowlist or account ID setup is required.
- Speech transcription is disabled until the per-user credential, consent, and billing approach is selected and implemented. Do not configure a shared speech API key to enable transcription for all public users.
- ChatGPT sign-in establishes identity; it does not supply speech API credentials or include API usage. The existing transcription adapter targets OpenAI audio transcriptions, but is not an enabled public service.

The public Site accepts non-cookie device bearer requests while management and MCP operations require the current user's trusted ChatGPT identity. Public ingress must not permit unauthenticated management or access to another user's records. No platform service-access token belongs in the companion.

Hosted verification must prove that Sites strips forged identity headers, passes device Authorization and OPTIONS requests correctly, and supplies the same trusted per-user identity to the generated MCP plugin. These are platform gates, not established by unit tests.

## Pair and connect

Setup involves two independent connections. The Even Hub device pairing links the G2 companion to this relay with a one-time code and a device bearer token. The ChatGPT MCP connection links Dot to the relay's MCP endpoint at `<origin>/mcp` (hosted: `https://hey-dots-g2.keenranger.chatgpt.site/mcp`). Neither connection substitutes for the other.

1. Open the hosted setup page and use Sign in with ChatGPT.
2. Review your personal connection status. No account ID configuration is required. Speech input is unavailable until per-user transcription setup is implemented; use typed input to validate the text path.
3. ChatGPT MCP connection, web first: the Site's native MCP plugin must be installed in ChatGPT. If it is not, add `<origin>/mcp` as a custom MCP server on the ChatGPT Plugins page in ChatGPT on the web in a desktop browser and install it, following [Connect a custom MCP server](https://developers.openai.com/api/docs/guides/custom-mcp-server); that guide documents the web flow only. Then ask Dot in chat to subscribe to `utterance.created` with session `g2` and call `reply_to_g2` with the event's `utterance_id` and Korean reply text. Per the MCP Events guide, ChatGPT itself calls `events/subscribe` when a user asks to monitor an event; the plugin exposes no subscribe tool, and the dashboard's subscription status only reports whether that call has reached the relay.
4. Even Hub device pairing: create a one-time pairing code on the setup page.
5. Build/package `even-app` with the exact deployed HTTPS relay origin in its network whitelist, then install it through Even Hub. Enter the relay origin (without `/mcp`) and pairing code in the companion.
6. For the currently available text path, type a message and use the Send button. The companion polls for replies while visible and attempts to page text onto G2. The recording controls and optional automatic submission are implemented in the companion, but cloud transcription is disabled; recording does not establish a working voice path.

Alternatively enable `Hey dots` listening while the companion is active. This does not wake an exited or suspended Even app. The interface shows microphone/listening state, and manual and text controls remain available.

What the fetched OpenAI docs establish, and what they do not:

- [Get started with your dot](https://learn.chatgpt.com/docs/dots/getting-started): a dot can be set up in the ChatGPT mobile app, desktop app, or a desktop browser (mobile web is not supported), and the same dot continues across devices after setup. The page does not describe adding a custom MCP server to a dot.
- [Connect a custom MCP server](https://developers.openai.com/api/docs/guides/custom-mcp-server): custom servers are added on ChatGPT on the web over SSE or streaming HTTP. Mobile registration is not described.
- [MCP Events](https://developers.openai.com/plugins/build/mcp-events): events are available in Work chats on ChatGPT web, Work chats in the desktop app with Cloud selected, and Dots, using webhook delivery and MCP protocol version `2026-07-28`. iOS and Android are not mentioned, so event delivery while using a dot from the iPhone app is unverified.

See [the companion README](even-app/README.md) for SDK interaction and build details. A successful server receipt proves storage or callback acceptance, not Dot processing or a visible physical display.

## Data and privacy

The relay does not persist raw audio. Speech transcription is currently disabled. Before enabling the implemented PCM16/WAV-to-provider adapter, the per-user credential, billing, and consent design must be resolved; enabled provider-side handling would follow that provider's policy. Text utterances, replies, subscriptions, and device records persist in D1; this implementation does not yet offer automatic transcript deletion or a retention policy. Do not treat it as production-ready for sensitive conversations.

Pairing codes and device tokens are stored as hashes. Callback signing secrets remain server-side. User management and MCP operations require trusted Sites identity and scope database operations to that user. Device APIs accept only their scoped bearer tokens. Registration, utterance submission, and speech calls have server-side rate limits. Device revocation is available on each user's dashboard and affects only their own devices.

## Acceptance gates

- Local tests, type checking, production build, and companion build: record actual results separately.
- Hosted Sign in with ChatGPT, cross-user isolation, pairing, CORS and manifest permissions: unverified until deployed and exercised.
- Actual Dot event subscription, signed callback challenge/delivery, correlated reply: unverified.
- Real Korean audio transcription and latency: disabled and unverified; requires an approved per-user credential/billing implementation and an actual recording.
- Physical G2 microphone, gestures, Hangul glyphs, paging, and response display: unverified.

No local check proves these external gates. The goal remains open until the requested real account/device round trip works.

## References

- [Even Hub device APIs](https://hub.evenrealities.com/docs/build/device-apis)
- [ChatGPT dots: getting started](https://learn.chatgpt.com/docs/dots/getting-started)
- [OpenAI custom MCP server](https://developers.openai.com/api/docs/guides/custom-mcp-server)
- [OpenAI MCP events](https://developers.openai.com/plugins/build/mcp-events)
- [OpenAI speech transcription](https://developers.openai.com/api/docs/guides/speech-to-text)
- [Dot Link reference implementation](https://github.com/YusukeIt0/dot-link)
