# Local verification, 2026-10-23

## Verified locally

- Server: 23 Node tests, TypeScript checks, oxlint, and the production Vinext/Worker build passed.
- Companion: 19 Node tests, TypeScript/Vite build, and oxlint passed.
- The companion test loads the packaged sherpa-onnx WASM and real KWS/VAD models with the `dots` configuration offline, feeds silence, and disposes the runtime. This proves loading and silent nonactivation, not positive recognition accuracy.
- A later separate [offline positive smoke](wake-positive-smoke.md) used installed macOS Samantha speech. `Hey dots. What time is it?` emitted a wake and captured clip; one unrelated sentence and digital silence emitted neither. No production setting changed. This is one synthetic activation case, not a human/G2 accuracy benchmark.
- All 11 pinned wake assets passed SHA-256 verification. Source/model notices and the upstream MIT license are copied into the companion build.
- Deterministic tests cover post-cue trimming, silence/no-speech/max-duration limits, opt-in/foreground/busy/manual/draft gates, off-before-upload cancellation, late submission responses, and bounded message history.
- SQLite tests apply all three generated migrations and exercise owner isolation, atomic code consumption, reply transaction rollback/CAS, pending indexes, retry leases/backoff, cursor traversal, and conditional unsubscribe.
- A built Worker ran on loopback with synthetic fixture identity and local D1. `node tests/http-smoke.mjs` passed owner and CSRF denial, concurrent one-use pairing, a Korean text utterance, a correlated MCP reply, device CORS, and revocation. No real Dot or transcription provider was contacted.
- Browser QA covered signed-out navigation, local mock sign-in, owner-not-configured behavior, copy controls, and desktop layout. Local mock sign-in is not hosted Sign in with ChatGPT evidence.

## Packaging fixture

The official Even Hub CLI 0.1.14 accepted a local fixture package with SDK 0.0.16 and resolved the minimum app version as 2.2.10.

- File: `outputs/dots-cloud-fixture-not-for-install.ehpk`
- Bytes: 7,554,263
- SHA-256: `3841092925e1df69157cc6968ec13d65305951f85dc99239708b264b2c68f10e`
- Relay whitelist: `https://example.invalid`, intentionally a placeholder.
- Package ID: `app.mark.evendotscloud`; namespace availability is not established.

This is packaging evidence only. Do not install, upload, or distribute the fixture as a usable app. Generate a new manifest with the actual deployed origin and create a new package before the real device test. Even Hub acceptance is still unverified.

## External gates still open

- No Site has been registered or deployed; `.openai/hosting.json` has no `project_id`.
- Hosted ChatGPT authentication, identity-header stripping, owner allowlist, and device bearer/CORS behavior are unverified.
- Site-generated plugin discovery of MCP events, a real Dot subscription, signed webhook verification/delivery, and an actual Dot reply are unverified.
- No server speech API credential is configured or exercised. Korean transcription quality and latency are unverified.
- No physical G2 capture, keyword recognition, gestures, Hangul display, paging, background behavior, or battery tests were performed.

The requested account/device round trip is not complete. Local tests and the packaging fixture do not establish these external gates.

## Independent checks

Managed Claude Opus 5.5 sessions investigated the official protocol and reviewed cloud authorization, transactions/retries, companion response ordering/history, and the local wake integration. A separate scoped Codex read-only pass independently found event-recovery and companion ordering/history issues; those findings received fixes and deterministic tests. The wake review's stale prompt issue was also fixed and tested. Neither review role produced physical-device or hosted-account evidence.
