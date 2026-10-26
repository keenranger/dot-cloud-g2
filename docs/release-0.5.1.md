# 0.5.1 release candidate — 2026-10-26

**LOCAL CANDIDATE — NOT DEPLOYED, NOT UPLOADED.** Built from `origin/main` `ba981dc` plus the signed commit that adds this file. Sites deploy, Even Hub upload, portal entries and store review are separate steps; re-read remote state before acting.

## Changes

- Public policy routes on the relay: `/privacy` (`app/privacy/page.tsx`) and `/terms` (`app/terms/page.tsx`), sharing `app/components/policy-page.tsx`. English text, effective 2026-10-26, publisher keenranger, contact kghnkl0103@gmail.com. The home footer links to both. They describe current `main` behavior: permanent AES-256-GCM connection key with hash lookup, masked reveal/copy, rotation/withdrawal, retained pre-existing devices; session-only Soniox key with opt-in remember, G2 microphone, default-on Hey dots, no audio or Soniox key at the relay; 30-day read cutoff and owner erase; daily cleanup scheduled but not yet observed unattended; provider copies, logs and backups outside the commitment.
- They state no legal name, address, phone, governing law or liability allocation, and claim no provider audit or physical-device proof.
- Companion version `0.5.1` in `even-app/package.json` and `even-app/scripts/manifest.mjs`. No other companion source changed.
- README, companion README and release docs corrected for Sites version 8, the cleanup schedule state and the published policies.

## Local verification

| Check | Result |
| --- | --- |
| Root `pnpm test` | First run failed with `ERR_MODULE_NOT_FOUND` for `even-app/node_modules/typescript` because it ran before the companion install; after the frozen companion install, 115/115 passed, and 115/115 again on the final source |
| Root lint, typecheck, build | Passed on the final source |
| Companion frozen install, build (with wake-asset verification), test, lint, `typecheck:test` | Passed; tests 100/100 |
| Built Worker on loopback (`pnpm start`) | `/`, `/privacy`, `/terms` each HTTP 200 without sign-in; pages render `<main lang="en">`, one `h1` with ordered `h2` sections, `<time datetime="2026-10-26">`, a `mailto:` contact, and Korean dashboard labels marked `lang="ko"` |

Node 24.13.0, pnpm 12.14.0, Darwin arm64. Rendered browser layout, keyboard focus and spoken assistive technology were not exercised for these pages; the check was of served HTML only.

## Package

- `RELAY_ORIGIN=https://hey-dots-g2.keenranger.chatgpt.site pnpm -C even-app manifest`, then global `evenhub` 0.2.0: `evenhub pack even-app/app.json even-app/dist --sdk-ver 0.0.16 -o outputs/dot-cloud-0.5.1.ehpk`.
- `outputs/dot-cloud-0.5.1.ehpk`: 7,566,482 bytes, SHA-256 `3afebd091600b0f5d35ae6814e3d721cb2e5ef0a09a50f6eeee39df7892c090a`. Package `app.mark.evendotscloud`, version 0.5.1, `min_app_version` 2.2.10, no pack warnings.
- Manifest whitelist: the relay origin above, `wss://stt-rt.soniox.com`, `https://stt-rt.soniox.com`; permissions `network` and `g2-microphone` unchanged from 0.5.0.
- Logs, the 17-file dist hash list and rendered page captures are kept locally under `outputs/release-0.5.1/` (ignored).

## Remaining gates

- The policy URLs return the new pages only after this source is deployed through the native Sites workflow; then check both URLs on the hosted origin.
- Even Hub upload and read-back of this exact artifact, portal policy URLs and store review.
- The daily cleanup has no observed unattended run; nonzero deletion and quota remain unverified. Update `/privacy` if the schedule changes.
- Physical phone/G2, hosted D1 semantics, real provider behavior and Mac-off operation remain as recorded in the README acceptance gates.
