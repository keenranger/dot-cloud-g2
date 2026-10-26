# Reusable pairing codes — deployment and QA, 2026-10-26

## User behavior

Refresh the site and generate a **new connection code once** after this deployment. Previously consumed pre-deployment codes cannot be recovered: the old implementation removed them, and the server never stores plaintext codes. An existing unconsumed code may remain usable until its original expiry; generating a new code removes that ambiguity.

A new code is reusable for a fixed **600 seconds from creation**. Redemption does not renew the deadline. Each redemption creates a distinct device ID and permanent device credential; existing devices remain connected. The device credential's separate lifecycle is unchanged. A replacement code invalidates the previous code; revoke-all withdraws the code and all of that owner's devices. Revoking one device does not withdraw the code.

The full code can be copied manually again and recovered after a **same-tab reload** from tab-local sessionStorage, but only after the current owner's server state confirms its fingerprint and expiry. There is no cross-browser plaintext retrieval or server-side plaintext recovery. A failed check, mismatch, expiry or changed owner clears the cached code and related notices. A create response is not displayed until a post-response owner check validates it; stale requests cannot replace a newer result.

There is no new schema, migration or dependency for this feature. The device pairing HTTP contract remains `{code}` → `{token, deviceId}`. Redeeming is limited to 10 per owner per minute; there is no total device cap or newly asserted trusted-IP rate limit.

## Source and deployment identity

- Runtime source: signed `426417f9a9e14f129a6cedf56f1717c5685e339b` (GPG status G), branch `keenranger/pairing-code-recopy`.
- Implementation `55de18f`; client race corrections `f3c4df1`; companion label-only alignment `9363a64`; final owner/focus correction `426417f`.
- Existing Sites project: `appgprj_6adb099c2f588191a35d9749cda26f1f`.
- Saved version 7: `appgprj_6adb099c2f588191a35d9749cda26f1f~appgver_1782c5df847881918664c38d3a578c50`.
- Deployment `appgdep_6aded29cd89081918876e1d83d3b4c2a`: **SUCCEEDED** at `2026-10-26T04:10:18.947221Z`.
- Public URL https://hey-dots-g2.keenranger.chatgpt.site; public audience unchanged.
- The official native helper pushed exact runtime source to the Sites source repository only. No GitHub/origin publication, PR merge or parent PR #6 change is established here.
- Source archive: `outputs/pairing-recopy/site-final.tar.gz`, 1,699,840 bytes, 103 entries; SHA-256 `e17d71b19d94c07c2d0455ca3e71f465690e07c415c9dca08795e14a8faeaa37`. A later documentation commit does not change this runtime-source provenance.

## Actual verification

| Layer / identity | Observed result | Boundary |
| --- | --- | --- |
| Final local checks, `426417f` | Root 110/110 tests; lint/typecheck/build passed | Includes actual-entry companion runtime with fakes; not physical proof |
| Production SQL via local SQLite and built Worker/Miniflare HTTP | Same code redeemed twice with distinct credentials; fixed 600 s boundary; replacement invalidates old; devices retained; revoke-all withdraws code; owner-scoped GET | Hosted positive-owner pairing was not performed |
| Actual Chrome, final `426417f` | Normal create followed by mandatory owner GET; two manual copies; same-tab reload/recopy; actual local double redemption; create/revoke mutual exclusion; final revoke/reload | Disposable local identity/database, no production data |
| Chrome paused-request races | Late old-owner POST followed by null-owner GET stays hidden; mismatch clears code/notices and restores enabled create focus; explicit navigation retained; same-owner refresh before write recovers; stale 401/GET cannot erase newer code | A/B owner responses are controlled HTTP fixtures, not real account switching |
| Source review | Opus server-policy review plus independent bounded Codex final owner/focus review found no actionable blockers | Model reviews did not independently rerun tests/browser |
| Hosted ingress | Home HTTP 200; anonymous GET `/api/pairing` 401; forged-identity GET 401 | Rejection evidence only; no owner pairing or existing-data mutation |

Initial browser/source failures were preserved before correction. Final browser verdict is PASS for the focused current-candidate scenarios. Prior TTL/replacement/expiry evidence is explicitly reused; no new 10-minute browser wait is claimed. Native keyboard/AX focus was observed, not spoken assistive-technology output.

## Companion package boundary

The child HTML label is now generic `연결 코드`; standard `autocomplete="one-time-code"` is retained. Its label-only build and pinned wake checks passed. This **site-only deployment does not update the existing Private 0.5.0 Even Hub package**, which can retain the old one-time-code label while using the compatible reusable backend. No Even Hub upload was performed for this change.

## Preserved local evidence and remaining gates

Detailed ignored evidence remains under `outputs/pairing-recopy/`: `report.md`, `client-review-fixes.md`, `owner-check-fix.md`, `review-opus.md`, `http-smoke.txt`, `browser-final/report.md`, `browser-final/SHA256SUMS`, and `label-check.md`. Independent final verdict: `/tmp/lens-pairing-owner-final-verdict.md`. Raw codes/tokens, database files, full browser screenshots and raw logs are not included in this tracked document.

Hosted real-owner issue/reuse/revoke, hosted D1 transaction/RETURNING behavior and true account switching remain unverified. No existing hosted user data was changed by the recorded smoke checks. Physical phone/G2 pairing, BLE, Even WebView lifetime, spoken screen-reader announcements and Mac-off operation remain open. Client clock skew can shorten the visible code window. Daily conversation cleanup remains inactive; this feature does not activate it or approve public policies.
