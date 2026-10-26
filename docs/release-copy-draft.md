# Store and privacy copy — owner review draft

> **2026-10-26:** the public policy text now lives at `/privacy` and `/terms` (see [release 0.5.1](release-0.5.1.md)). Privacy wording below is historical; where it differs, the published pages are current.

**DRAFT — not published, not legally reviewed, not approved for public use.** Current production: Even Hub 0.4.2 (Private build) and a relay without retention/deletion. Local candidate: 0.5.0 (source base `a266438` plus local backend and companion changes; bounded corrected-source review clean; hosted validation pending; not deployed or uploaded). The owner approved public developer name keenranger and support/privacy email kghnkl0103@gmail.com on 2026-10-24; whether the portal shows telephone/address publicly remains unconfirmed. Native Sites publishing, Even Hub upload/update, beta promotion and review submission are not authorized for this candidate.

Live portal state on 2026-10-24 (`outputs/release-readiness/environment-audit.md`): name `Lens MCP for G2`, tagline, permissions text and icon are present. Category is unset. Screenshots, cover, privacy/terms URLs and developer contact details are missing. No review build is selected and nothing is submitted.

Tagline (English): Your ChatGPT Dot on G2, connected through MCP

Description (English): Lens MCP for G2 is an independent G2 companion for your ChatGPT Dot through MCP. Speak or type a question and read its replies on your glasses. It is not an official Even Realities app or a general-purpose MCP client. Pair the companion with your relay in ChatGPT. Hold to speak, or use local “Hey dots” detection while the glasses session is active. Voice transcription uses your own Soniox key. Setup requires the phone, a connected ChatGPT Dot and a Soniox account for speech. Typed messages work without a speech key. Background availability depends on the phone OS and Even app; locked-phone support is awaiting physical beta verification.

Description (Korean): Lens MCP for G2는 MCP로 본인의 ChatGPT Dot에 연결하는 독립 G2 앱입니다. 음성이나 텍스트로 질문하고 안경에서 답변을 읽으세요. Even Realities 공식 앱이나 범용 MCP 클라이언트가 아닙니다. ChatGPT에서 연결 코드를 만든 다음 휴대폰으로 연결합니다. 길게 눌러 말하거나, 안경 세션이 실행되는 동안 로컬 “Hey dots” 호출을 사용할 수 있습니다. 음성 전사에는 본인의 Soniox 키가 필요하며, 텍스트 입력은 키 없이 사용할 수 있습니다. 백그라운드 동작은 휴대폰 OS와 Even 앱에 따라 달라지며, 잠금 상태 동작은 물리 기기 베타 검증을 기다리고 있습니다.

Release notes for 0.5.0 candidate (Even Hub asks for 1–3 lines per supported language describing user-visible changes; use only after the build is verified):

- English: Your Hey dots and auto-send choices are now remembered. Conversations older than 30 days are no longer shown, and you can erase all conversations from the relay dashboard. The microphone status now says when G2 audio has not been confirmed instead of stopping.
- Korean: Hey dots와 자동 전송 설정을 기억합니다. 30일이 지난 대화는 더 이상 표시되지 않으며, 릴레이 대시보드에서 전체 대화를 삭제할 수 있습니다. G2 오디오 수신이 확인되지 않으면 녹음을 멈추지 않고 상태로 알려 줍니다.

Release notes for 0.4.2 (current production, kept for reference):

- English: Keep Hey dots, voice input and replies running when the phone screen locks or the Even app goes to the background, subject to OS availability. Recover replies after a rejected glasses display update and keep your reading position. Double-tap opens the system exit confirmation.
- Korean: 휴대폰 화면이 잠기거나 Even 앱이 백그라운드로 가도 Hey dots, 음성 입력과 답변 수신을 유지합니다(OS 상태에 따라 다름). 안경 표시 갱신이 실패하면 받은 답변을 다시 표시하고 읽던 위치를 유지합니다. 두 번 탭하면 시스템 종료 확인창이 열립니다.

The 0.5.0 notes must not mention automatic physical deletion: the daily purge is not activated, and physical removal is not promised on exactly day 30.

## Reviewer note draft — bring-your-own speech key

No API key or secret is bundled in the package. Voice transcription uses a Soniox key that each user enters on their own phone. By default the key is held in session memory only. It is saved through Even Hub SDK local storage only if the user explicitly selects remember on this device, and it can be cleared or replaced in settings. Audio streams from the phone directly to `wss://stt-rt.soniox.com`. The relay never receives the key or raw audio, and its server-side transcription endpoint is disabled. Typed messages work without a key. Without a key, voice controls show a notice instead of opening the microphone. The Hey dots / auto-send preference store (0.5.0) never writes the key.

## Verified privacy/data-flow facts for policy authoring

- Glasses microphone → phone-local bounded buffers. “Hey dots” is on by default after pairing/key prerequisites; user can turn it off. The 0.5.0 candidate remembers an explicit OFF/ON choice (SDK storage key `dot-cloud-preferences-v1`); a saved OFF keeps the microphone closed during startup, and an unreadable saved value is treated as OFF. Production 0.4.2 starts Hey dots on at each launch. Missing G2 audio frames are only reported, never acted on. It can remain active when the phone is locked while the glasses session is alive; this is intended. Local cue detection does not send pre-cue audio to the relay/provider.
- User voice after wake cue, or manual hold recording → direct Soniox real-time WSS under the user's account/key. The relay receives neither raw audio nor the Soniox key. Audio is capped at 30 seconds per clip. Soniox processing/storage follows the user's provider relationship; this project cannot promise provider deletion.
- Server-side transcription (`/api/device/transcribe`) fails closed: the runtime supplies no server credential, so it returns 503 before reading any audio.
- Soniox key → session memory by default. Only explicit remember-on-device opt-in writes through Even Hub SDK native local storage. It can be cleared/replaced in settings. No app-added encryption at rest is claimed.
- Typed/final transcript text → paired HTTPS relay → ChatGPT agent via MCP/event callback. Agent reply → relay → authenticated device polling → G2 SDK text update. Local phone UI retains up to 100 deduplicated replies in memory. Voice auto-send is on by default; the 0.5.0 candidate remembers an explicit choice, 0.4.2 does not.
- Proactive agent messages (`send_message_to_g2`) are stored without a device ID and delivered to every paired device of the owner.
- Relay persists text utterances/replies, proactive messages, subscriptions and device records in D1. Production 0.4.2: no retention period or user-facing deletion; conversations can remain indefinitely. 0.5.0 candidate (owner-approved, local only): conversation records are hidden from every read, delivery and retry 30 days after `createdAt` (UTC); the owner can erase all conversations immediately from the dashboard (same-origin, Sites identity only), which deletes content in one transaction, writes text-free tombstones, increments a revision and makes the companion clear its cache on the next active poll. A daily physical purge at 03:00 Asia/Seoul is intended but not activated; once healthy it lags the cutoff by up to 24 hours, and failures or backlogs over one run (about 20,000 rows) add delay. Provider copies, logs and backups, and content already sent to ChatGPT/Soniox or displayed, are outside the relay's reach. Revoking a device deletes its authentication record only. Expired pairing, subscription and rate-limit rows are not purged.
- Pairing codes and device tokens are stored as hashes server-side; returned device bearer token is stored via SDK native local storage. Owner sign-in uses trusted Sites identity. Owner/session credentials are not copied into the companion package.
- Relay domain: https://hey-dots-g2.keenranger.chatgpt.site . Soniox: wss://stt-rt.soniox.com . The network whitelist includes the matching HTTPS Soniox host. Do not bundle keys in distributable packages.
- No claim of medical, financial or emergency use. No optical display confirmation is available from the server.

Selected name: Lens MCP for G2. Approved public developer/contact (2026-10-24): keenranger / kghnkl0103@gmail.com. Open owner decisions: whether portal telephone/address are public; publishable privacy/terms location and legal review; portal Category; reviewer test-account provisioning; final description and localized release notes after physical QA. Settled: 30-day retention with owner erase; iPhone + G2 target; default-on Hey dots, including while the phone is locked or backgrounded, with the explicit choice remembered; session-only Soniox key with explicit remember opt-in.

### Candidate retention clarification — DRAFT

Physical sweeps delete expired conversation content and atomically leave owner-scoped, text-free ID fences (identifiers and sweep timestamp only). These fences reject same-ID retries with `410` for 30 further days from the sweep, then expire without replacement. This is bounded retry protection, not a permanent ID guarantee.

Each maintenance invocation targets at most 20,000 rows and uses at most 41 SQL statements including rate limiting. Fence insertion and later deletion add metadata storage and index writes; hosted D1 plan, quota, actual rows written and batch-result behavior remain unverified activation gates. Measure the first hosted sweep before activating the intended daily 03:00 Asia/Seoul cleanup. The schedule remains unactivated.

Public developer/contact values are approved as keenranger / kghnkl0103@gmail.com (2026-10-24); mailbox operation is unverified. Effective dates, hosting, phone/address and policy approval remain unresolved. No policy approval, hosting, schedule activation or public readiness is established.
