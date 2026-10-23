# 0.4.1 review candidate — 2026-10-23

Source base: `12d2cb8`; isolated branch `fix/g2-display-recovery`. Original `/Users/mark/orca/workspaces/even-g2-dots-cloud/kelpie` and `/Users/mark/src/even-g2-dots-cloud` preserved. No upload, rename, promotion, review submission or deployment performed.

## Change and evidence

Failed G2 writes were left uncached, but polling unchanged history did not attempt them again. Successful polls now reconcile unacknowledged text. Rejected host writes return a failed acknowledgement instead of blocking the independent container. The reply body is attempted before the less critical microphone header. Acknowledged reply bodies are not rewritten, preserving native scrolling.

Ready glasses sessions no longer stop merely because the phone document becomes hidden. Page unload and confirmed host exit still cancel requests/capture. Root double-tap requests `shutDownPageContainer(1)`; a cancelled confirmation does not terminate the session. This follows the published Even Hub lifecycle contract, but does not override OS suspension. Session-only Soniox keys still disappear on cold restart unless the user explicitly opted into SDK storage.

Validation: 80 companion tests and 29 relay/runtime tests pass; the latter includes the actual companion entry point with fake host/DOM/HTTP boundaries. It covers an unchanged reply recovering from failed display acknowledgement, successful bodies not being resent, hidden-phone polling, root confirmation mode 1, continuation after cancelled confirmation, pagehide cancellation and confirmed-host-exit fencing. Companion build, lint, test typecheck and pinned wake-asset verification pass. `git diff --check` passes.

First pnpm script execution attempted to rewrite shared dependency shims and was sandbox-blocked; subsequent verification uses existing binaries directly, without reinstalling dependencies in concurrent worktrees. Simulator installed separately from the official npm registry: 0.9.5.

## Artifact and remote status

Candidate `dot-cloud-0.4.1-candidate.ehpk`: 7,563,201 bytes, SDK 0.0.16, min Even app 2.2.10, official online packaging completed without warnings. Candidate is local only. Existing name `Dot Cloud` is retained pending user naming decision; it must be aligned across manifest/UI/portal before submission.

Authenticated remote app `app.mark.evendotscloud`: latest 0.4.0 (119653), Private, 7,563,082 bytes, no beta/public channels. Authenticated portal viewed in user's Mark Mac Chrome: `even_dots`, no screenshots, description, privacy/terms or developer information; Submit disabled. The existing name contains “Even” and violates current independent-app naming policy. Do not rename without the user's selected name.

## Simulator evidence

Official simulator 0.9.5 ran the actual built entry point. Startup logs confirm two text containers, a nonempty body/header update, and double-tap delivery followed by `ShutDownPageContainer`. The integration regression independently verifies argument 1. The simulator framebuffer did not establish a visible system confirmation dialog, so dialog appearance, cancellation UX and phone WebView closure remain physical-device gates. Original RGBA screenshots have pure-green RGB with glyphs in alpha; preserve their alpha rather than converting them to RGB. No keys, pairing codes, provider calls or real conversation data were entered.

## Latency and measurement

Reply discovery adds zero to 2.5 seconds plus HTTP duration because the next poll is scheduled 2.5 seconds after the prior response. Local wake capture adds its 1.2-second silence endpoint; manual release ends capture directly. Audio already streams to Soniox while recording. No production timing measurements or voice/provider requests were performed.

A hung host promise can still stall the serialized SDK queue. A timeout cannot cancel a native BLE update, so this patch does not release the queue into overlapping native writes. Capture host-call duration on real hardware before choosing a cancellation/restart strategy.

Record four independent times for one correlated utterance/message: server reply storage; phone message response; SDK body request and acknowledgement; user optical confirmation. Server storage and SDK acknowledgement cannot prove visible pixels.

## Physical beta QA — requires owner with phone and G2

1. Select final name, apply consistently, review and upload the newly packaged version to Private; separately authorize beta promotion for official locked-phone testing. Confirm exact installed version in the phone. Never test stale 0.4.0 while attributing results to 0.4.1.
2. Pair via the existing one-time-code flow. Typed Korean question must arrive once, produce a correlated reply, appear on phone, then be read aloud by the wearer from G2. Record message ID and times without logging keys or audio.
3. Send two identical replies; verify each navigates independently. Read a long reply, allow wake status changes, verify scroll is preserved. Navigate older/newer messages and split parts.
4. Recover from a temporary disconnect or rejected update; confirm the unchanged reply is retried and appears. Reopen after suspension; credentials restore, and session-only Soniox key requires reentry as disclosed.
5. Set the owner's Soniox key, hold/release G2 for Korean speech, verify automatic submission and returned reply. Repeat local wake cue. Confirm the cue itself is absent from the transcript. Do not record private speech for artifacts.
6. With beta installed, lock phone for five minutes. Use glasses/ring only for the core flow; test two minutes idle, unlock/use another phone app/re-lock. Verify microphone status and turn off wake detection to confirm capture stops. Android reclamation and iOS WebView behavior require separate observed results.
7. Root double-tap must show the system confirmation. Cancel: session remains usable. Confirm: phone WebView closes; launch Conversate without restarting glasses.
8. Repeat one end-to-end round trip with the Mac off. This task has no attached physical G2/phone control or optical sensor, so it cannot execute or certify these steps.

## Remaining submission checklist

- Final user-selected name, ≤20 chars and no case-insensitive “Even”; tagline ≤50 chars; matching manifest, glasses and listing.
- User-approved public description and release notes in ko/en; describe compatible hardware in description.
- Developer profile/contact, monochrome icon foreground/background, greyscale cover. Existing icon completeness is unverified.
- Genuine simulator screenshots matching final branding/build; do not use a phone preview as G2 proof.
- Public privacy/terms URLs approved by owner. Source has no automatic transcript retention/deletion policy; no deletion/retention commitment should be invented. See release-copy-draft.md.
- Physical beta QA above, source review, private upload authorization, optional beta promotion authorization, final content confirmation. Public review stays portal-only. Published build numbers/artifacts are immutable; listing edits have their own portal review process.

References: https://hub.evenrealities.com/docs/ship/app-submission ; https://hub.evenrealities.com/docs/build/background-lifecycle ; https://hub.evenrealities.com/docs/build/page-lifecycle ; https://hub.evenrealities.com/docs/cli . Checked 2026-10-23.
