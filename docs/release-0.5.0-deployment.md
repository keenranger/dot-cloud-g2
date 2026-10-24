# 0.5.0 deployment evidence — 2026-10-24

The user authorized deployment. This records a successful relay deployment and a Private companion upload, not public Even Hub store publication or policy approval.

## Source and local validation

- Signed source: `7f48b9c4d217e4e111477c5aed261c08133ed841` (GPG status G), integrating caption/retention work and the final deferred-reply correction.
- Root tests 95/95, companion tests 100/100, runtime scenarios 41/41; root and companion lint/type checks/builds passed. See `outputs/release-readiness/final-integration-fix.md`.
- These are source and fake-boundary test results, not physical/provider evidence. The earlier clean-build comparison for `1341bea` is historical, not a reproducibility result for this source.

## Sites deployment

- Project: `appgprj_6adb099c2f588191a35d9749cda26f1f`.
- Saved version: 6, `appgprj_6adb099c2f588191a35d9749cda26f1f~appgver_5adb43dc24688191be9cb76e40706a58`.
- Deployment: `appgdep_6adca17de560819180424353d0c654a1`, succeeded at `2026-10-24T12:16:10.672605Z`.
- URL: https://hey-dots-g2.keenranger.chatgpt.site; public audience unchanged.
- The official native Sites helper pushed the exact source to the Sites source repository only. This does not assert a GitHub push or main merge.
- The Sites workflow applies migration `0003`. Deployment success is not independent hosted D1 schema, atomic-batch, SELECT-result, deletion-metadata or quota verification.

## Even Hub artifact

- Version 0.5.0; build ID 120792; Private; no channels.
- `outputs/dot-cloud-0.5.0.ehpk`: 7,566,491 bytes.
- SHA-256: `daee63bd8776fbd7c958ae4a1a6759cdfa78abad322a526140cc15ee85dc52c4`.
- Official CLI upload followed by `evenhub ls` confirmed version/status/size. SDK 0.0.16; minimum Even app 2.2.10.
- Private upload does not prove installation, live execution, beta promotion, public review or store publication.

## Observed hosted checks

Home returned HTTP 200. Native MCP owner `get_status` succeeded: one device, subscribed true, pending zero. Conversation-delete ingress rejected a request with no Origin with 403, a same-origin request without identity with 401, and a same-origin request with a forged identity header with 401. No auth or user content was supplied and no mutation occurred. These are authentication/ingress denial checks, not authenticated owner-delete proof. `eventTransport` remains hardcoded `unverified`; `phoneKeyConfigured: null` means unknown, not absent or ready.

## Remaining gates

- Daily 03:00 Asia/Seoul cleanup is **not active**; no schedule was created. Current connected MCP inventory exposes only the four older Hey Dots tools, not `enforce_conversation_retention`. Updated discovery/reconnection is needed before hosted writer verification and quota/metadata measurement. No hosted maintenance call is claimed.
- Independently verify hosted D1 migration/schema, transactional fence/deletion behavior, batch results, deletion metadata, actual write costs and plan/quota before schedule activation.
- Physical iPhone/G2 install, lock/background behavior, microphone routing/shutdown, live Soniox, native captions/scroll retention, assistive technology, correlated cloud Dot reply and Mac-off voice round trip remain unverified.
- Public identity/contact approved: keenranger / kghnkl0103@gmail.com (2026-10-24). Mailbox operation, phone/address scope, legal effective date, policy hosting and policy approval remain unresolved. Policy/reviewer text stays DRAFT.
