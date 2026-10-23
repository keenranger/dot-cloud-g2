# Store and privacy copy — owner review draft

Not published. Final name, developer identity/contact, policy URLs and any retention/deletion commitments need owner confirmation.

Tagline (English): Talk to your cloud agent from your glasses

Description (English): Speak or type a question and read your connected cloud agent’s replies on G2. Pair the companion with your relay in ChatGPT. Hold to speak, or use local “Hey dots” detection while the glasses session is active. Voice transcription uses your own Soniox key. Setup requires the phone, a connected ChatGPT agent and a Soniox account for speech. Typed messages work without a speech key. Background availability depends on the phone OS and Even app; locked-phone support is awaiting physical beta verification.

Description (Korean): G2에서 음성으로 질문하고 연결된 클라우드 에이전트의 답변을 읽으세요. ChatGPT에서 연결 코드를 만든 다음 휴대폰으로 연결합니다. 길게 눌러 말하거나, 안경 세션이 실행되는 동안 로컬 “Hey dots” 호출을 사용할 수 있습니다. 음성 전사에는 본인의 Soniox 키가 필요하며, 텍스트 입력은 키 없이 사용할 수 있습니다. 잠금 상태 동작은 물리 기기 베타 검증 후 공개 설명에 확정 반영해야 합니다.

Release notes (English): Recover replies after a rejected glasses display update. Keep an active glasses session running when the phone screen locks, subject to OS availability, and use the system exit confirmation on double-tap.

Release notes (Korean): 안경 표시 갱신이 실패하면 받은 답변을 다시 표시합니다. 휴대폰 화면이 잠겨도 실행 중인 안경 세션을 유지하고, 두 번 탭하면 시스템 종료 확인창을 엽니다. 실제 백그라운드 실행은 휴대폰 OS 상태에 따라 달라집니다.

## Verified privacy/data-flow facts for policy authoring

- Glasses microphone → phone-local bounded buffers. “Hey dots” is on by default after pairing/key prerequisites; user can turn it off. It can remain active when the phone is locked while the glasses session is alive. Local cue detection does not send pre-cue audio to the relay/provider.
- User voice after wake cue, or manual hold recording → direct Soniox real-time WSS under the user's account/key. The relay receives neither raw audio nor the Soniox key. Audio is capped at 30 seconds per clip. Soniox processing/storage follows the user's provider relationship; this project cannot promise provider deletion.
- Soniox key → session memory by default. Only explicit remember-on-device opt-in writes through Even Hub SDK native local storage. It can be cleared/replaced in settings. No app-added encryption at rest is claimed.
- Typed/final transcript text → paired HTTPS relay → ChatGPT agent via MCP/event callback. Agent reply → relay → authenticated device polling → G2 SDK text update. Local phone UI retains up to 100 deduplicated replies in memory.
- Relay persists text utterances/replies, subscriptions and device records in D1. Current implementation has no automatic transcript-deletion or retention schedule. Revoking a device disables its token; it does not delete conversation records. Decide and implement a retention/deletion mechanism or approve an accurate disclosure before publishing a privacy policy.
- Pairing codes and device tokens are stored as hashes server-side; returned device bearer token is stored via SDK native local storage. Owner sign-in uses trusted Sites identity. Owner/session credentials are not copied into the companion package.
- Relay domain: https://hey-dots-g2.keenranger.chatgpt.site . Soniox: wss://stt-rt.soniox.com . The network whitelist includes the matching HTTPS Soniox host. Do not bundle keys in distributable packages.
- No claim of medical, financial or emergency use. No optical display confirmation is available from the server.

Owner decisions: final independent app name; legal/developer identity and support contact; publishable privacy/terms location; retention/deletion policy; whether to allow default-on wake while locked (currently disclosed by UI as active-session microphone use); final description and localized release notes after physical QA.
