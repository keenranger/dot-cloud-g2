# Release 0.6.1: acknowledgement and final both stay readable (issue #5 correction)

Source: branch `keenranger/preserve-both-replies`, child of `keenranger/issue-5-ack-final` at `85ce48e` (signed merge `9228bc0` plus its 0.6.0 record). Signed source commit `95f80fa63b19bebaa592e71bd33a07bff1d9dff1`. Not pushed to GitHub origin, not merged to `main`, not uploaded or deployed.

## Correction

0.6.0 replaced an acknowledgement with its final answer, both in the relay poll and in the companion history. The owner corrected this: the intermediate acknowledgement and the final answer must both remain readable.

- Companion: the acknowledgement and the final are two history entries, deduplicated by `message_id`; the final never replaces or deletes the acknowledgement text. An utterance reads acknowledgement then final, also when the acknowledgement is seen after its final (placed just before it). An acknowledgement already kept stays when a relay no longer returns it, so 0.6.1 against the deployed 0.6.0 relay keeps any acknowledgement it polled before the final. The G2 header and the phone message position (`role="status"`) label the stage: `중간 답변` (with `최종 답변 대기` until its final is kept) and `최종 답변` beside its acknowledgement; a reply without an acknowledgement has no label. A reader at the tail follows the final as for any reply; a reader elsewhere, including on the acknowledgement, keeps body and place, and only the header changes. Existing message buttons and G2 scroll navigation read both. Both entries count toward the 100-reply cap and expire on their own `createdAt`.
- Relay (server change, needed): `poll` stopped omitting an answered acknowledgement. Without it, a device that did not poll between the two stages (a fast final within the 2.5-second interval, a paused page) or that reconnects later could never read the acknowledgement. Order stays `createdAt`, then `seq`. A first acknowledgement after the final is still refused (`superseded_by_final`), retries stay idempotent and conflicting text stays 409; deletion and retention are unchanged. The MCP tool descriptions now say both stay readable. No schema or migration change.
- Compatibility: a 0.6.0 companion against the new relay still shows only the final (its own client-side replacement); companions before 0.6.0 show both as unlabelled messages.

## Evidence

| Requirement | Method | Result | Boundary |
| --- | --- | --- | --- |
| Baseline before change | `pnpm test`, `pnpm -C even-app test` on `85ce48e` | 126/126, 105/105 pass | |
| Relay keeps both stages, order, idempotence, refusal after final | `pnpm test` (MemoryStore and production SQL on SQLite, incl. new D1 poll test with equal timestamps, retention and owner erase) | 129/129 pass | Not hosted D1 |
| Companion history | `pnpm -C even-app test` | 107/107 pass; the 7 staged-history tests fail against the 0.6.0 `message-history.ts` | |
| Actual entry point | `tests/companion-runtime.test.mjs` (fake SDK, DOM, network, timers): ack then final, final before ack, duplicate polls, reader on older reply or on the ack, live running text, 0.6.0 relay omission, G2 `SCROLL_TOP` and phone navigation | 46/46 pass | Fakes only |
| Types, lint, build | `pnpm lint`, `pnpm typecheck`, `pnpm -C even-app build/lint/typecheck:test`; oxfmt check on changed files | Pass | |
| Package | Global `evenhub` 0.2.0, `pack --sdk-ver 0.0.16`, `RELAY_ORIGIN=https://hey-dots-g2.keenranger.chatgpt.site`, clean tree at `95f80fa` | `outputs/dot-cloud-0.6.1.ehpk`, 7,566,810 bytes, SHA-256 `5fb95f4e897cf6e5c3d91f61ecc74a46810035ef8daa836c6068f3a14c20e53d`, min app 2.2.10, no warnings | Not uploaded |

## Open

Not run in this worker: the official simulator framebuffer for both labels (GUI is routed to a separate executor), the built Worker in workerd, an independent review pass, Sites deployment of the relay change, Even Hub upload. The full behavior needs both the relay deployment and the 0.6.1 companion. Hosted MCP/D1, a real host calling `acknowledge_g2_utterance`, per-stage latency, header legibility at 70 characters and optical display on a physical G2 remain unverified.
