# Lens MCP for G2 — release readiness checklist and reviewer packet draft

**LOCAL DRAFT — NOT SUBMITTED OR APPROVED.** Updated 2026-10-24 for the local 0.5.0 candidate. Nothing here records a public review submission, store publishing, beta promotion, Sites deploy or policy/legal approval. Re-read the remote state before acting; this snapshot goes stale.

| | Current production | Local candidate |
| --- | --- | --- |
| Even Hub | 0.4.2, build 120294, Private, no channels (latest per the parent's CLI check; 0.5.0 unused remotely) | 0.5.0 in `even-app/package.json` and `even-app/scripts/manifest.mjs`; not built, packaged or uploaded here (the parent owns the final build) |
| Source | 0.4.2 built from `bb4c0a6` | base `a266438` (adds saved preferences and non-invasive audio status, `7189b3b`) plus local retention/erase backend and companion changes; **bounded corrected-source review clean; hosted validation pending** |
| Relay | Deployed Site without retention/erase; migration `0003` not applied | Retention fence, owner erase and bounded purge tool in the working tree; not deployed |

Not authorized for this candidate: native Sites publish/deploy, Even Hub upload/update, beta promotion, review submission, purge schedule activation.

The Even Hub requirements come from the official [App Submission & QA Guidelines](https://hub.evenrealities.com/docs/ship/app-submission), [Packaging & Deployment](https://hub.evenrealities.com/docs/ship/packaging), [CLI apps](https://hub.evenrealities.com/docs/cli/apps) and [CLI builds](https://hub.evenrealities.com/docs/cli/builds).

## Evidence classes

Each gate below is marked with the strongest evidence that currently exists for it:

- **Source:** behavior that can be read directly in the code or manifest (0.4.2 at `bb4c0a6`; 0.5.0 in the local candidate; bounded corrected-source review clean).
- **Mock:** unit, integration or simulator runs. These use fake SDK, provider and relay boundaries, or the official simulator. They do not establish real WebView, G2, Soniox, ChatGPT or locked-phone behavior.
- **Physical:** observed on a real phone, real G2 and real provider accounts. Only this class closes a runtime review gate.
- **Portal:** observed in the authenticated Even Hub portal (`outputs/release-readiness/environment-audit.md`, read-only).

Status values are DONE, OPEN, OWNER (needs an owner decision) and PENDING (separate work in progress).

## Per-gate checklist

### Manifest and package

| Gate | Requirement | Evidence | Status |
| --- | --- | --- | --- |
| Package ID | Reverse-domain, lowercase, no hyphens | Source: `app.mark.evendotscloud` (`even-app/scripts/manifest.mjs`) | DONE |
| Edition, version, SDK | `202601`; x.y.z; `min_sdk_version` at least 0.0.14 | Source: `202601`, `0.5.0` (candidate; production is `0.4.2`), `0.0.16` | DONE (source) |
| Name | 20 characters or fewer, no "Even"; must match listing and glasses name | Source: `Lens MCP for G2` (15). Portal: the listing name matches. Physical: the name shown on the glasses is not observed. | DONE (source, portal); glasses name OPEN |
| Permissions used and described | `network` with whitelist and `g2-microphone`, each `desc` 1–300 characters | Source: only these two are declared, and both are used. Portal: permissions checklist item is checked. | DONE |
| No bundled secrets | No API key in the `.ehpk` | Source: no key in source or manifest. The Soniox key is supplied by the user at runtime. | DONE; reviewer note below |
| Changelog | Non-empty, 500 characters or fewer | Portal/CLI: 0.4.2 has a changelog. 0.5.0: draft notes in `docs/release-0.5.0.md`; no upload changelog yet | OPEN (0.5.0) |
| Package artifact | Built from merged main | 0.4.2: `outputs/qa-0.4.2/release-proof.md` (SHA-256 `4f49f0fb…d2a`, 7,564,025 bytes; root tests 29/29, companion 92/92). 0.5.0: no artifact; local source reviewed; final artifact not packaged | DONE (0.4.2); OPEN (0.5.0) |

### Store listing (portal)

| Gate | Requirement | Evidence | Status |
| --- | --- | --- | --- |
| Name and tagline | Name up to 20 characters, tagline up to 50 | Portal: populated (15/20, 45/50) | DONE |
| Icon | 24×24 monochrome #F4F4F4, 2×2 blocks, legible | Portal: icon checklist item is checked. Source: `assets/store/icon-24.png` | DONE |
| Description and Category | Category and About are both required | Portal: About is populated (474/2000). **Category is unset.** | OWNER (choose a category) |
| Screenshots and cover | 576×288 PNG matching on-device render; monochrome background | Portal: none uploaded. Mock: `assets/store/screenshot-first-run.png` (simulator capture) is ready. | OPEN (upload) |
| Developer and contact information | Required before Confirm | Portal: developer name, telephone and address are empty; contact email is populated and shown publicly per the portal notice. Whether telephone/address are public is unconfirmed | OWNER (public display name, support email, phone/address scope) |
| Privacy and terms | Policy covers every permission; backend domains traceable to the developer | Portal: missing. Draft: `docs/privacy-terms-approval-draft.md` is unapproved. | OWNER |
| Release notes | 1–3 lines for each supported language (`en`, `ko`) | Draft: `docs/release-0.5.0.md`, `docs/release-copy-draft.md` | OPEN (owner review after physical QA) |
| Review build selection and submission | Done in the portal; each step needs separate authorization | Portal: no build selected; Submit disabled | OWNER |

### Data handling and policy facts

| Gate | Evidence | Status |
| --- | --- | --- |
| Raw audio never reaches the relay; server transcription fails closed | Source: `lib/relay/http.ts` (no server credential), `app/api/device/transcribe/route.ts` (503 before reading the body) | DONE (source) |
| Soniox key session-only by default, remembered only on explicit opt-in | Source: `even-app/src/soniox-key.ts`, `even-app/index.html` (opt-in unchecked); the preference store never writes the key (asserted in tests) | DONE (settled) |
| Proactive messages broadcast to all of the owner's devices | Source: `lib/relay/core.ts` `send` / `messages` | DONE (documented) |
| Retention requirement | Owner approved a 30-day UTC cutoff plus immediate owner erase | DONE (settled) |
| 30-day read/delivery cutoff (0.5.0) | Source: `lib/relay/core.ts` `RETENTION_MS`, `cutoff()`/`live()`; every conversation read in `lib/relay/store.ts` fenced on `createdAt`. Mock: `tests/retention.test.mjs` R1–R17; root `pnpm test` 76/76 (`outputs/release-readiness/retention-implementation.md`) | Source + Mock; bounded corrected-source review clean; hosted D1 OPEN |
| Owner erase with tombstones and revision (0.5.0) | Source: `store.ts` `eraseConversations`, `insertUnlessErased`; `app/api/conversations/delete/route.ts`; dashboard control. Mock: D1–D7 and the HTTP delete-route test | Source + Mock; bounded corrected-source review clean; hosted OPEN |
| Companion clears cache on revision increase and prunes by cutoff (0.5.0) | Source: `even-app/src/message-history.ts`, `main.ts` poll. Mock: 5 runtime tests, companion 98/98 (`outputs/release-readiness/companion-erasure.md`); fixtures use the agreed shape, mock boundaries only; no hosted integration | Mock; integration and physical OPEN |
| Scheduled physical purge (intended daily 03:00 Asia/Seoul) | Source: bounded `enforce_conversation_retention` MCP tool (at most 20,000 rows and 41 statements including rate limiting per invocation). **No schedule is activated or published** | OPEN (not activated; needs authorization) |
| Provider/backup limits disclosed | Docs: README, privacy draft, release copy | DONE (copy) |
| Hey dots and auto-send OFF/ON choice remembered (0.5.0) | Source at `a266438`: `even-app/src/preferences.ts` (`dot-cloud-preferences-v1`), settings wake blocker. Mock: saved-OFF and unreadable-OFF runtime tests | Source + Mock; relaunch persistence physical OPEN |
| Audio status is observation only (0.5.0) | Source: `watchAudio()` only reports "G2 오디오 수신 확인 안 됨"; `WAKE_BLOCKED.audio` removed. Mock: quiet, zero-frame and exit runtime tests (`outputs/release-readiness/audio-fixes.md` appendix) | Source + Mock; silence frame cadence physical OPEN |
| Default-on Hey dots while the phone is locked or backgrounded | Source: no phone-visibility input pauses the session | DONE (explicitly desired) |

### Runtime review gates (reviewers test a Beta build)

| Gate | Requirement | Source / Mock evidence | Physical | Status |
| --- | --- | --- | --- | --- |
| First run | Glasses show setup guidance; no black screen | Mock: simulator startup shows the text containers and a nonempty body | Not observed | OPEN |
| Setup persistence | Setup persists through `localStorage` | Source: pairing persists through SDK storage. The Soniox key persists only on opt-in (settled design). | Not observed | OPEN (physical) |
| CORS | Relay and Soniox reachable from the Even WebView | Source: relay CORS implemented; mock tests | Not observed | OPEN |
| Locked phone | Renders when locked; alive after 2 minutes idle and 5 minutes locked; unlock and relock are harmless | Source: nothing pauses on visibility. Mock: lifecycle harness. Code audit F1/F2 (`outputs/release-readiness/locked-code-audit.md`) addressed in source at `a266438`: unconfirmed stops are fenced, and missing frames are now reported rather than shown as listening. | Not observed | OPEN |
| Glasses-only core flow | Works on glasses and ring input with visible feedback | Mock: gesture tests | Not observed | OPEN |
| Exit | Root double-tap calls `shutDownPageContainer(1)`; WebView closes; other apps launch afterwards | Source and mock: mode 1 verified | Dialog and WebView closure not observed | OPEN |
| Speech | Real Soniox transcription with the user's key | Mock: fake sockets only | Not observed | OPEN |
| Dot round trip | Utterance event delivered, reply shown on G2 | A real Dot has reported subscribed. A proactive MCP message was physically confirmed on G2. | Cloud-Dot reply on G2 not observed | OPEN |
| Owner erase on device | After a dashboard erase, phone and G2 drop old replies on the next active poll | Mock: companion runtime tests | Not observed | OPEN |
| Saved preferences | A saved Hey dots OFF survives a full Even app relaunch with no microphone indicator during startup | Mock: runtime tests | Not observed | OPEN |
| Content and safety | No medical, financial or emergency functionality | Draft terms clause 3 disclaims these | — | DONE (copy) |

No physical target phone was available in the 2026-10-24 environment audit, so every Physical cell is unobserved.

## Reviewer packet draft

To be pasted into reviewer notes only after the owner approves it and a verified 0.5.0 build exists. It contains no operator, contact or legal details; those are unresolved.

> **What it is.** Lens MCP for G2 is an independent companion that connects the user's own ChatGPT Dot to G2 through MCP. It is not an official Even Realities app and not a general-purpose MCP client.
>
> **Setup.** Sign in to the relay with ChatGPT and create a one-time pairing code. Enter the relay origin and the code in the companion. Pairing is saved through SDK local storage. Typed messages work right after pairing.
>
> **Speech key (bring your own).** No API key or secret is bundled in the package. Voice transcription uses a Soniox key that each user enters on their own phone. By default the key is held in memory for the session only. It is saved through SDK local storage only if the user selects remember on this device, and it can be cleared or replaced at any time. Audio streams from the phone directly to `wss://stt-rt.soniox.com`. The relay never receives the key or audio, and its server-side transcription endpoint is disabled. Without a key, voice controls show a notice instead of opening the microphone.
>
> **Microphone.** Only the G2 microphone is used. Hold to record (up to 30 seconds), or use the local “Hey dots” cue. Hey dots is on by default, can be turned off (the choice is remembered), and keeps listening while the glasses session is active, including with the phone locked. Pre-cue audio stays on the phone. If no G2 audio frames are confirmed, the status says so; the app does not stop listening because of quiet.
>
> **Conversation data.** Relay conversations are hidden 30 days after creation (UTC), and the owner can erase all of them from the relay dashboard. Physical cleanup is not guaranteed on exactly day 30.
>
> **Backend domains.** `https://hey-dots-g2.keenranger.chatgpt.site` (relay), `wss://stt-rt.soniox.com` and `https://stt-rt.soniox.com` (speech).
>
> **Exit.** Root double-tap opens the system exit dialog (`shutDownPageContainer(1)`).
>
> **Test account needs.** Reviewers need a ChatGPT account with a Dot connected to the relay and, for voice, a Soniox key. [Owner to decide whether and how reviewer test credentials are provided; none are included here.]

## Open owner decisions

1. Operator public display name and public support email.
2. Whether the portal's telephone and address fields are public; leave them empty until confirmed.
3. Privacy policy and terms hosting location, effective date, legal review and any legal wording.
4. Portal Category.
5. Reviewer test-account provisioning.
6. Separate authorization for every Sites deploy, purge schedule activation, Even Hub upload/update, beta promotion, portal edit, build selection and review submission.

Settled, not to be re-asked: 30-day retention with owner erase; iPhone + G2 target; default-on Hey dots including locked/backgrounded, with the explicit choice remembered; session-only Soniox key with opt-in remember.

## Local retention verification update

Physical sweeps delete expired conversation content and atomically leave owner-scoped, text-free ID fences (identifiers and sweep timestamp only). These fences reject same-ID retries with `410` for 30 further days from the sweep, then expire without replacement. This is bounded retry protection, not a permanent ID guarantee.

Each maintenance invocation targets at most 20,000 rows and uses at most 41 SQL statements including rate limiting. Fence insertion and later deletion add metadata storage and index writes; hosted D1 plan, quota, actual rows written and batch-result behavior remain unverified activation gates. Measure the first hosted sweep before activating the intended daily 03:00 Asia/Seoul cleanup. The schedule remains unactivated.

Submission-time fallback cleanup is best-effort: failure logs only the constant, non-content warning `retention_fallback_sweep_failed` and does not block a fresh submission. Read and expiry fences still apply; insertion failures remain errors.

Final parent checks passed: root tests 76/76, companion tests 98/98, root lint/typecheck/build, companion lint/typecheck:test/build, pinned wake-asset verification, and diff checks. The bounded independent corrected-source review closed the initial sweep-resurrection, callback-expiry and phone-expiry findings with no actionable findings. Tests use SQLite/D1 shims and fake host/provider boundaries; they do not establish hosted D1 or physical behavior. Hosted migration 0003, atomic batch behavior, deletion metadata, quota, schedule activation and real-device validation remain open.
