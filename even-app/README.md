# Even Hub cloud companion

This independent companion connects G2 directly to the hosted relay and to Soniox speech-to-text. It requires no Mac service and no customer-run server. The owner signs into the relay in ChatGPT, creates a one-time device code, then enters the relay HTTPS origin and code in this app. Only the returned device-scoped bearer token is saved through Even Hub native local storage; ChatGPT browser cookies and owner tokens are not copied to the glasses app.

## Build

```sh
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm typecheck:test
RELAY_ORIGIN=https://YOUR-DEPLOYED-SITE.example pnpm manifest
```

`pnpm manifest` writes the ignored `app.json` with an explicit network whitelist origin. Copy that manifest alongside the contents of `dist/` when preparing an Even Hub package. An empty whitelist is deliberately not emitted: its host behavior has not been assumed. The exact deployed relay origin must be added before packaging and must match the origin entered on the phone. SDK version is pinned to 0.0.16 (requires Even app 2.2.10 or newer according to its package metadata). This repository does not publish or upload a package.

The relay must allow CORS for the actual hosted/packaged Even Hub WebView origin, including Authorization and Content-Type headers and OPTIONS preflights. The relay URL allowlist and backend CORS allowlist are separate settings.

## Interaction and evidence

Create the G2 startup text container before opening its microphone. Hold/release G2 LONG_PRESS_EVENT / LONG_PRESS_RELEASE_EVENT to capture up to 30 seconds; phone start/stop buttons provide the same operation. Scroll changes reply pages and crosses into adjacent messages at page boundaries. Labeled phone buttons independently navigate pages and messages. Up to 100 deduplicated replies are retained; new batches follow the newest reply only when the reader is already at the tail, preserving an earlier reading position otherwise. A reply received before its submission HTTP response settles cannot be replaced by a stale waiting notice. Audio is SDK mono PCM16 little endian at 16 kHz. The phone strips the WAV container by walking its RIFF chunks and streams the PCM straight to Soniox (`wss://stt-rt.soniox.com`, `stt-rt-v5`, Korean hint) with the user's own key in the `soniox-api-key` WebSocket subprotocol; the relay only receives the resulting text through `POST /api/device/utterances`. Neither the key nor audio is sent to the relay. Each recording carries one UUID from capture to submission, and a typed or reviewed draft keeps its UUID until the relay accepts it, so a resend is idempotent. Voice transcripts send automatically by default, so holding and releasing G2 completes recording, transcription, and server submission without touching the phone. The accessible automatic-send checkbox can be turned off to review the editable transcript first; typed text always uses the explicit send action. A recording submits at most once, with the connection generation checked after transcription and before sending. Ctrl/Command+Enter respects Korean IME composition.

Pairing: `POST /api/device/pair {code}` returns `{token,deviceId}`. Authenticated endpoints: `POST /api/device/utterances {id,text}`, `GET /api/device/messages` returning `{messages:[{message_id,text,createdAt,utterance_id?}]}`. The relay defines accepted as callback HTTP acceptance. It does not prove that Dot processed the message. The phone explicitly separates server storage/callback receipt from reply arrival and G2 text update acknowledgement. A successful SDK update acknowledges the update request, not independent optical verification.

Requests are aborted while hidden or disconnected; polling is serialized at 2.5-second intervals while active. Disconnect clears native local credentials; revoke the paired device from the server to invalidate the token itself. Replies are paginated to 240 Unicode code points per update. G2 SDK writes are serialized and stale queued writes are invalidated on a connection change.

## Soniox key (bring your own)

The phone settings accept the user's own Soniox API key in a masked field. The key is read, then the field is cleared immediately. By default it stays in memory only and disappears when the app closes. The **remember on this device** checkbox is an explicit opt-in that writes it through Even Hub SDK `setLocalStorage` only; there is no browser storage fallback. Turning remembering off, replacing the key or clearing it overwrites the stored copy, and a storage write that cannot be confirmed is reported as such. No encryption at rest is claimed; how the Even app stores SDK values is not documented. Users should create a dedicated key in the Soniox console that only has real-time speech-to-text permission.

Without a key, the record button is disabled, G2 hold and Hey dots show a notice instead of opening the microphone, and typed text still works. A transcription is aborted when the app is hidden, the connection is disconnected or replaced, the key changes or is removed, or (for a Hey dots clip) Hey dots is turned off, and an aborted or stale transcript is never submitted. User notices come from the failure kind and at most the numeric provider code; the key and provider error text are never logged or shown. There is no automatic retry, since every Soniox session is billable.

The network whitelist contains the relay origin, `wss://stt-rt.soniox.com` and `https://stt-rt.soniox.com`, matching published Even Hub Soniox apps. `api.soniox.com` is not listed because it is unused.

## Remaining runtime checks

Build and protocol tests use fake sockets and sentinel keys only; they do not prove a real Soniox session, physical microphone capture, Even Hub network permissions/CORS, gesture delivery, ChatGPT event delivery, or visible G2 text. Validate these separately with a deployed relay, authorized ChatGPT MCP subscription, and connected physical G2. Background/hidden pages intentionally stop polling and recording; continuous background conversation is not claimed.

## Optional local Hey dots activation

The default-off **Hey dots** checkbox opens the G2 microphone only while this app is active and paired. Phone-local keyword spotting detects the English phrase `HEY DOTS`, then captures only the post-cue utterance. That clip is transcribed directly by Soniox and the text goes through the same MCP submission pipeline. Pre-cue PCM stays in the bounded local worker/ring buffers, is never sent anywhere, and is cleared on cancellation. The microphone state is visible on both the phone and a separate G2 header. Replies retain their display area when listening resumes.

This adapts the MIT-licensed Dot Link wake detector/worker/engine/name modules from local source revision `fe00d2e2c43686eca572ce5694612b505843a820`; see `public/DOT-LINK-LICENSE.txt` and the original implementation notes in `public/REFERENCE-WAKE-WORD.md`. The pinned assets are sherpa-onnx **1.13.8**, int8 Zipformer GigaSpeech 3.3M English keyword spotting, and Silero VAD. The `distribution/wake/manifest.json` preserves file sizes, SHA-256, upstream source commit and download provenance. All 11 assets were copied from already-verified local Dot Link assets without downloads. Builds and tests recheck every packaged asset. Runtime/model licenses and notices are included in `public/wake-assets/THIRD-PARTY-NOTICES.txt` and copied into `dist/`. `pnpm format` excludes the pinned runtime files so their hashes remain unchanged.

Silero uses a 1.2-second silence endpoint; no-speech capture expires at 6 seconds and clips are capped at 30 seconds. The worker queue fails closed above 48,000 pending bytes, rejects malformed/oversized PCM, and uses generation guards. Turning the option off, hiding/exiting the app, disconnecting, a manual recording, Soniox transcription/submission, a missing Soniox key, or an unsent text draft suspends local listening and closes its microphone. No app-exited wakeup or background operation is claimed. Manual hold/release, phone buttons and text remain available. A long press during wake capture cancels that wake clip and starts a new manual recording; releasing completes the manual clip. Empty/no-speech wake captures restore the selected reply instead of leaving the speak-now prompt. Turning wake activation off before a captured clip begins processing prevents that clip from being uploaded. The new package ID is `app.mark.evendotscloud`; availability still needs confirmation in Even Hub.

Offline real-WASM tests initialize the custom `dots` keyword and models and confirm silent input does not activate. Deterministic engine tests cover post-cue trimming, no-speech expiry, silence endpoint, maximum duration and cancellation. These are not evidence of positive `Hey dots` acoustic detection accuracy, Korean-pronunciation accuracy, physical G2 microphone behavior, or battery use; those require physical audio validation.
