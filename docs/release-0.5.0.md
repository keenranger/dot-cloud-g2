# 0.5.0 release candidate — 2026-10-24

**LOCAL CANDIDATE — NOT DEPLOYED, UPLOADED OR SUBMITTED.** Current production is Even Hub 0.4.2 (build 120294, Private, no channels) and a relay without retention or erase. The parent's Even Hub CLI check found 0.4.2 as the latest remote version and 0.5.0 unused. Native Sites publishing, Even Hub upload/update, beta promotion, review submission and purge schedule activation are not authorized for this candidate.

## Source

- Base `a266438` on `prepare-public-release`, which includes `7189b3b` (saved voice preferences, G2 audio status) and the pinned pnpm toolchain.
- Local candidate changes: the retention and owner-erase backend (`outputs/release-readiness/retention-implementation.md`) and the companion's reaction to erase and expiry (`outputs/release-readiness/companion-erasure.md`).
- Version `0.5.0` in `even-app/package.json` and `even-app/scripts/manifest.mjs`. The `packageManager` field and dependencies are unchanged.
- **The bounded independent corrected-source review found no actionable findings.** The parent owns the final version build.

## User-visible changes since 0.4.2

1. **Saved preferences.** An explicit Hey dots and voice auto-send OFF/ON choice is saved through SDK storage. A saved OFF keeps the microphone closed during startup. An unreadable saved value is treated as OFF, with a phone message.
2. **Audio status, observation only.** After the SDK accepts an open request, the label reads "오디오 수신 대기 중"; only a real frame switches it to "마이크 켜짐". With no frames for 4 s after opening or 6 s after the last frame, the phone and G2 header report "G2 오디오 수신 확인 안 됨". Nothing is closed, reopened, discarded or blocked because of quiet. A zero-frame manual capture gets Soniox's distinct `no-audio` message.
3. **30-day cutoff.** The relay hides conversation records once 30 days have passed since `createdAt` (UTC) from every read, delivery, retry and reply, and the companion prunes those replies from its cache. A retry of an expired ID gets 410.
4. **Owner erase.** The dashboard's "대화 기록 삭제" control (same-origin, Sites identity only) erases all of the owner's conversations at once: one transaction, text-free tombstones, a revision increment. The companion clears its cached replies on the next active poll and keeps the draft, key, pairing, preferences and microphone state.

Unchanged and settled: Soniox key session-only by default with explicit remember opt-in; default-on Hey dots, including while the phone is locked or the Even app is backgrounded; iPhone + G2 target.

## Physical cleanup: intended, not live

A daily purge at 03:00 Asia/Seoul is intended but **not activated or published**. Once activated, each run targets up to 20,000 rows through bounded, rate-limited calls to the `enforce_conversation_retention` MCP tool (at most 20 rounds of 1,000 rows, with 41 SQL statements including rate limiting). While that job is healthy, physical removal after the 30-day cutoff can lag by up to 24 hours. Failed runs and backlogs beyond one run add further delay. No physical deletion on exactly day 30 is claimed. Provider copies (ChatGPT, Soniox), infrastructure logs and backups are outside the relay's reach.

## Release notes draft (1–3 lines per language)

- English: Your Hey dots and auto-send choices are now remembered. Conversations older than 30 days are no longer shown, and you can erase all conversations from the relay dashboard. The microphone status now says when G2 audio has not been confirmed instead of stopping.
- Korean: Hey dots와 자동 전송 설정을 기억합니다. 30일이 지난 대화는 더 이상 표시되지 않으며, 릴레이 대시보드에서 전체 대화를 삭제할 수 있습니다. G2 오디오 수신이 확인되지 않으면 녹음을 멈추지 않고 상태로 알려 줍니다.

## Reviewer note draft — bring-your-own speech key

No API key or secret is bundled in the package. Voice transcription uses a Soniox key that each user enters on their own phone. By default the key is held in session memory only; it is saved through Even Hub SDK local storage only if the user selects remember on this device, and it can be cleared or replaced in settings. Audio streams from the phone directly to `wss://stt-rt.soniox.com`; the relay never receives the key or raw audio, and its server-side transcription endpoint is disabled. Typed messages work without a key.

## Evidence matrix

| Gate | Source | Mock / local | Hosted / physical |
| --- | --- | --- | --- |
| Retention fence and owner erase | Working tree, bounded corrected-source review clean | Root `pnpm test` 76/76, lint, typecheck, build (retention report) | Hosted D1 migration `0003`: not run |
| Companion erase and expiry | Working tree, bounded corrected-source review clean | Companion 98/98, runtime 22/22 (erasure report); mock boundaries only; no hosted integration | Even Hub WebView on G2: not observed |
| Saved preferences | `a266438` | Saved-OFF and unreadable-OFF runtime tests | Relaunch persistence on iPhone: not observed |
| Audio observation | `a266438` | Quiet, zero-frame, exit runtime tests; even-app 95/95 at that point (audio-fixes appendix) | 60 s silence frame cadence, locked and unlocked: not observed |
| Scheduled purge | Tool only | Bounded sweep tests R4, R9, R10 | Schedule not created; no run observed |
| 0.5.0 package | Version fields only | Not built here | Not uploaded |

Test counts are from the worker reports at the time they ran. Re-run the integrated suites on the final tree before building.

## Before release (each needs its own authorization)

1. Final backend and companion source review, then a signed commit.
2. Parent's final 0.5.0 build, pack and checksum.
3. Native Sites deploy (applies migration `0003`), then a hosted check of the retention tool and the erase route.
4. Activation of the 03:00 Asia/Seoul purge schedule, and a verified run, before any copy describes automatic physical deletion.
5. Even Hub upload of 0.5.0 as Private, then physical iPhone + G2 QA (erase sync, relaunch persistence, audio status, locked phone).
6. Owner approval of public display name, support email and portal phone/address scope; legal review of policy and terms. Beta promotion and review submission are separate decisions.

## Local retention verification update

Physical sweeps delete expired conversation content and atomically leave owner-scoped, text-free ID fences (identifiers and sweep timestamp only). These fences reject same-ID retries with `410` for 30 further days from the sweep, then expire without replacement. This is bounded retry protection, not a permanent ID guarantee.

Each maintenance invocation targets at most 20,000 rows and uses at most 41 SQL statements including rate limiting. Fence insertion and later deletion add metadata storage and index writes; hosted D1 plan, quota, actual rows written and batch-result behavior remain unverified activation gates. Measure the first hosted sweep before activating the intended daily 03:00 Asia/Seoul cleanup. The schedule remains unactivated.

Submission-time fallback cleanup is best-effort: failure logs only the constant, non-content warning `retention_fallback_sweep_failed` and does not block a fresh submission. Read and expiry fences still apply; insertion failures remain errors.

Final parent checks passed: root tests 76/76, companion tests 98/98, root lint/typecheck/build, companion lint/typecheck:test/build, pinned wake-asset verification, and diff checks. The bounded independent corrected-source review closed the initial sweep-resurrection, callback-expiry and phone-expiry findings with no actionable findings. Tests use SQLite/D1 shims and fake host/provider boundaries; they do not establish hosted D1 or physical behavior. Hosted migration 0003, atomic batch behavior, deletion metadata, quota, schedule activation and real-device validation remain open.
