# Permanent connection key — version 8, 2026-10-26

## Current behavior

New connection keys have **no expiry**. The dashboard starts masked; the signed-in owner explicitly reveals/hides the key and can copy it only while shown. Refresh and a separate browser tab can recover it through an authorized reveal request, without issuing a new key. No plaintext key is written to browser persistent storage; the legacy tab-cache entry is removed. The server stores a SHA-256 lookup identifier and an AES-256-GCM envelope, with a fresh IV and owner/row-bound authenticated data, not plaintext.

Refresh conceals plaintext before awaiting status/owner metadata. Hiding the page invalidates pending reveals; returning requires an owner re-check. Latest-operation fences discard stale reveal successes and failures after rotation, withdrawal or owner-state changes. Rotation and withdrawal use explicit two-step warnings with focus restoration. Nothing automatically reveals or issues a key.

**Migration:** legacy finite hash-only keys are not upgraded or recoverable. They remain redeemable only until their original expiry. Issue one new permanent key to use the new behavior; existing paired devices are preserved. Rotating or withdrawing the connection key prevents future pairing with it but keeps existing devices; revoke-all withdraws the key and devices together. Single-device revocation keeps the key. The separate device credential lifecycle and `{code}` → `{token, deviceId}` contract remain unchanged.

A copied permanent key can pair new devices until rotation/withdrawal, rate limited to 10 per owner per minute. Reveal is same-origin, owner-scoped, no-store and limited to 30 per owner per minute. AES-GCM protects database-only exposure, not a compromised Worker or leaked encryption secret. Missing/invalid encryption configuration fails issue/reveal closed without deleting the old key. Changing/losing the encryption secret makes prior keys unrevealable until rotation, while hash-based redemption remains possible. No schema, migration or dependency was added.

## Version 8 deployment proof

- Runtime source: signed `2be9181a5029401cbb30f9551170c0fe2823366c` (GPG G); initial permanent-key implementation `e93eb236`, followed by final client/focus fences.
- Existing Sites project `appgprj_6adb099c2f588191a35d9749cda26f1f`, saved version 8: `appgprj_6adb099c2f588191a35d9749cda26f1f~appgver_17c0ca46af048191a15ba6c85a4afa13`.
- Deployment `appgdep_6adee63739788191805020be59cd62d9`: **SUCCEEDED**, `2026-10-26T05:33:55.611073Z`, environment-set revision 1.
- URL https://hey-dots-g2.keenranger.chatgpt.site. No GitHub publication/main merge or Even Hub upload is asserted by this Sites deployment record.
- Native accepted tar: SHA-256 `86e5342b0cd38eff4403fd47339ef756f84748723436996079c22fc04cffef4e`, 1,720,320 bytes, 104 files. These are native accepted-archive fields, not a claim about local gzip byte identity.
- The existing Private 0.5.0 companion package was not updated by this site deployment. Its connection-code label and unchanged pairing contract remain compatible.

## Final local verification

| Layer | Result | Limit |
| --- | --- | --- |
| Final `2be9181` checks | Root 115/115 tests, lint/typecheck/build passed | Companion unchanged; its suite not repeated |
| Local crypto/SQL/HTTP | Permanent reveal/redeem beyond 10 minutes and one year; tamper/wrong-secret/owner isolation failures; unique IV; rotation/withdrawal; legacy non-promotion; same key still reveals/pairs after 31-day conversation sweep | Controlled clocks, SQLite/Miniflare and synthetic secret, not hosted owner proof |
| Actual Chrome final candidate | Masked create/reload/new tab; explicit reveal and two manual copies; refresh masks before response; metadata-pending reveal disabled; reveal503 focus; deliberate navigation retained; rotate/withdraw cancel focus | Disposable local identity/database; keyboard/AX, not spoken AT |
| Actual Chrome races | Old reveal401 cannot erase newer rotation; late successful reveal after rotation/withdrawal or owner-null stays hidden; repeated actual local redemption yields distinct devices; revoke-all cleans up | Owner response fixtures are not real account switching |
| Reviews | Opus initial crypto/server review clean; independent Codex final repair review clean | Review and browser evidence are separate; initial113 count is superseded by final115 |

**Actual tab visibility/BFCache testing remains BLOCKED/unrun.** Browser tab activation was unsupported; bounded native attempts were rejected when the user changed Chrome. No visibility transition, pending-reveal-after-restore or BFCache pass is claimed. Source and helper fence tests do not substitute for that browser gate. Initial browser failures and their final corrections remain preserved.

Hosted authenticated issue/reveal/redeem, hosted D1 semantics/quota, real account switching, spoken assistive technology, phone/G2/BLE, optical/provider behavior and Mac-off operation remain unproved. Successful deployment does not close these gates. Daily conversation cleanup is still inactive.

Detailed local evidence: `outputs/pairing-permanent/report.md`, `client-fixes.md`, `client-fixes-final-checks.txt`, `http-smoke.txt`, `review-opus.md`, and `browser/report.md` with `browser/SHA256SUMS`. Only this summary is tracked; raw keys, encryption secrets, tokens, databases and full browser artifacts are not published here.

---

The following version 7 record is historical. Its fixed 600-second key policy and sessionStorage cache were superseded by version 8 above; its deployment identities and observations remain dated evidence.

# Historical version 7: finite reusable codes — 2026-10-26

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
- **Sites-accepted archive fields:** native response `archive_format=tar`, content hash `e17d71b19d94c07c2d0455ca3e71f465690e07c415c9dca08795e14a8faeaa37`, size 1,699,840 bytes, `archive_storage.file_count=103`.
- **Local input:** `outputs/pairing-recopy/site-final.tar.gz`, gzip size 455,709 bytes, SHA-256 `b8463117bd47fc6b9abb7603a67a3161c6cf9592123d19f17d71dcfa394f5d35`. Decompressed raw tar: 1,951,232 bytes, SHA-256 `faeb22d0a06ccef0973b3646364f53f1e3f74a4e8d61814f1d8644074a075630`.
- Python tar inspection found 244 members: 225 regular files, including 122 macOS AppleDouble `._*` metadata files of 163 bytes each. Excluding those leaves **103 regular payload files**, matching the native storage file count, plus 19 normal directories. The earlier shell listing count was not a complete metadata-aware member inventory.
- These are different archive representations and metadata accounting, not comparable byte streams. Exact byte equivalence is not asserted or required to establish deployment success. The official save accepted source `426417f`, linked saved version 7, and its deployment succeeded; those native results are authoritative. No evidence of local archive overwrite or deployment corruption was found. No repack, rebuild or redeployment was performed to force matching hashes. Documentation-only commits do not change the runtime-source provenance.

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
