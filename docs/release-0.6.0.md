# Release 0.6.0: staged replies (issue #5)

Source: branch `keenranger/issue-5-ack-final`. Feature commit `fba3daed0a874659960c35507bb336c77954af19`; signed merge `9228bc05d8fbc316cd852e490d758c33f3e9e8fc` integrates `2434943` (privacy/terms pages, companion 0.5.1), which another session had already deployed to Sites. Not pushed to GitHub origin and not merged to `main`.

## Change

- MCP: new `acknowledge_g2_utterance` (optional, at most 500 characters) stores the model's own short reply before work without completing the utterance; `reply_to_g2` stays the final stage. Fixed message IDs `ack_<utterance_id>` / `reply_<utterance_id>`, sequence 1 / 2. Identical retries are idempotent, different text is 409. One conditional D1 statement stores an acknowledgement only while its utterance is live and unanswered; a late one returns `superseded_by_final` unstored. Polls omit an acknowledgement once its final exists.
- Device poll reads stored replies first and hands the bounded callback retry to `waitUntil`; lease, backoff and attempt limits are unchanged, and a failed retry never fails the read.
- Companion: a final replaces its acknowledgement in history (also within one poll), and an acknowledgement is never re-added after it. The capture being submitted shows its own acknowledgement or final on G2 at once; a capture still recording keeps its running text, and a reader on an older reply keeps it. An acknowledgement adds `최종 답변 대기` to the G2 header. A cancelled or timed-out submission now says the answer is not cancelled if it was stored.

## Evidence

| Requirement | Method | Result | Boundary |
| --- | --- | --- | --- |
| Relay contract, races, isolation, deletion/expiry, read-first poll | `pnpm test` (node, MemoryStore + production SQL on SQLite) on `9228bc0` | 126/126 pass | Not hosted D1 |
| Companion history and display | `pnpm -C even-app test`, `tests/companion-runtime.test.mjs` (actual entry point) | 105/105, 44/44 pass; mutation check confirms the in-flight display regression | Fakes for SDK/DOM/network |
| Built Worker in workerd | Local `wrangler dev` of `dist/server`, isolated D1, synthetic loopback identities: `tests/http-smoke.mjs` and a staged-reply smoke | Both pass; `waitUntil` import runs | No subscription or real callback |
| G2 rendering | Official simulator 0.9.5 (`@evenrealities/evenhub-simulator`), local relay | Ack header `답변 1/1 · 최종 답변 대기`, then final without it: PASS on a bundle patched only to accept an HTTP loopback relay and seed storage | Exact release bundle blocked: simulator rejects a self-signed HTTPS relay |
| Independent review | Codex read-only adversarial pass on `fba3dae` | No material defects | Source-only |

Framebuffers (original 576x288 RGBA, kept outside the repo): connected `76a21696afb6c8410fb21039b3e3719673dbff957b7ab409e8d9b544011ddc6f`, ack `b3e0bc8be8f3d63da91973498fba0568bc04fdce4c3f333c34f5fc57db75cfac`, final `1c106a0290d7f8398003bd42cac16f274f2393a6bb0f02eb00bc14065b1fe013`.

## Deployment (2026-10-26)

- Sites: official helper fast-forwarded the Sites source to `9228bc0`; saved version 10 (`appgprj_6adb099c2f588191a35d9749cda26f1f~appgver_7d46cd27c3908191adc9dcceaee51db2`), deployment `appgdep_6adf2172b6748191affac9a674489f92` succeeded at 2026-10-26T09:46:38Z. Archive SHA-256 `9e8b53654ba358f8465a87fe6c08426a2abb931086baeb2793bcd491c285aa62`. Unauthenticated read-back: `/api/status` 401, `/api/device/messages` 401, its OPTIONS 204, `/privacy` and `/terms` 200. No schema change.
- Even Hub: build 122894, 0.6.0, Private, no channels, 7,566,712 bytes, matching local `outputs/dot-cloud-0.6.0.ehpk` SHA-256 `8c5d807b025a8e6b582b5b133ece3e9875df868c438ac1eaf853e6619e665e2e` (SDK 0.0.16, minimum Even app 2.2.10). Not promoted or submitted for review.

## Open

Whether a real host calls `acknowledge_g2_utterance` before working, hosted MCP/D1 behavior of the new tool, per-stage latency (utterance to callback to ack to display) and optical display on a physical G2 are unverified. A companion older than 0.6.0 shows an acknowledgement and its final as two messages.
