# 0.4.1 review candidate — 2026-10-23

Source base: `12d2cb8`; isolated branch `fix/g2-display-recovery`. Original `/Users/mark/orca/workspaces/even-g2-dots-cloud/kelpie` and `/Users/mark/src/even-g2-dots-cloud` preserved. Authorized display rename and Private upload completed. No beta promotion, review submission or deployment performed.

## Change and evidence

Failed G2 writes were left uncached, but polling unchanged history did not attempt them again. Successful polls now reconcile unacknowledged text. Rejected host writes return a failed acknowledgement instead of blocking the independent container. The reply body is attempted before the less critical microphone header. Acknowledged reply bodies are not rewritten, preserving native scrolling.

Ready glasses sessions no longer stop merely because the phone document becomes hidden. Page unload and confirmed host exit still cancel requests/capture. Root double-tap requests `shutDownPageContainer(1)`; a cancelled confirmation does not terminate the session. This follows the published Even Hub lifecycle contract, but does not override OS suspension. Session-only Soniox keys still disappear on cold restart unless the user explicitly opted into SDK storage.

Validation: 80 companion tests and 29 relay/runtime tests pass; the latter includes the actual companion entry point with fake host/DOM/HTTP boundaries. It covers an unchanged reply recovering from failed display acknowledgement, successful bodies not being resent, hidden-phone polling, root confirmation mode 1, continuation after cancelled confirmation, pagehide cancellation and confirmed-host-exit fencing, and pagehide during deferred startup. Independent read-only history review found the late-startup reactivation race; a separate pageLoaded fence now prevents it. Companion build, lint, test typecheck and pinned wake-asset verification pass. `git diff --check` passes.

First pnpm script execution attempted to rewrite shared dependency shims and was sandbox-blocked; subsequent verification uses existing binaries directly, without reinstalling dependencies in concurrent worktrees. Simulator installed separately from the official npm registry: 0.9.5.

## Artifact and remote status

Release artifact `lens-mcp-for-g2-0.4.1.ehpk`: 7,563,225 bytes, SDK 0.0.16, min Even app 2.2.10, official online packaging completed without warnings. Uploaded and re-read as Private build 119761, version 0.4.1, no channels. SHA-256: `d949fd22ed9757e4e65b83a5309da0bccd6f3d4bbb3b6ddd195786be33c9559e`. Selected display name: `Lens MCP for G2` (15 characters). Package identity and Hey dots cue remain unchanged.

Authenticated remote app `app.mark.evendotscloud`: latest 0.4.0 (119653), Private, 7,563,082 bytes, no beta/public channels. Authenticated portal viewed in user's Mark Mac Chrome: `even_dots`, no screenshots, description, privacy/terms or developer information; Submit disabled. The existing name contains “Even” and violates current independent-app naming policy. This historical portal snapshot precedes the authorized Lens MCP for G2 draft rename.

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

- Selected Lens MCP for G2: align manifest, glasses and private listing; tagline ≤50 chars.
- User-approved public description and release notes in ko/en; describe compatible hardware in description.
- Developer profile/contact, monochrome icon foreground/background, greyscale cover. Existing icon completeness is unverified.
- Genuine simulator screenshots matching final branding/build; do not use a phone preview as G2 proof.
- Public privacy/terms URLs approved by owner. Source has no automatic transcript retention/deletion policy; no deletion/retention commitment should be invented. See release-copy-draft.md.
- Physical beta QA above, source review, private upload authorization, optional beta promotion authorization, final content confirmation. Public review stays portal-only. Published build numbers/artifacts are immutable; listing edits have their own portal review process.

References: https://hub.evenrealities.com/docs/ship/app-submission ; https://hub.evenrealities.com/docs/build/background-lifecycle ; https://hub.evenrealities.com/docs/build/page-lifecycle ; https://hub.evenrealities.com/docs/cli . Checked 2026-10-23.

## Naming and private portal verification

User delegated final naming after being told Lens MCP overlaps with infrastructure products. Selected Lens MCP for G2 (15 characters); brief public exact-name and glasses-category searches found no direct same-category match, not a trademark clearance. Existing Lens MCP Server and Zoho Lens MCP names remain a broader search collision. Manifest, phone title, on-glasses startup/setup notice and private portal now use Lens MCP for G2. Package ID, native storage keys, MCP/automation identity, credentials and Hey dots cue are unchanged. Portal tagline: Your ChatGPT Dot on G2, connected through MCP. Description expressly limits support to the user’s ChatGPT Dot, independent of Even Realities, and disclaims a generic MCP client.

Remote re-read after upload: build 119761, 0.4.1, Private, 7,563,225 bytes, channels [], review null. Portal creator name, icon foreground/background and privacy URL remain empty. Public operator/contact, retention/deletion commitments, legal terms and locked-wake consent remain pending; naming delegation did not approve them.

## Asset and policy preparation checkpoint

Original 24x24 icon passed strict pixel/color/block validation and official CLI update validation; saved to private listing icon path `prod/app.mark.evendotscloud/icons/74/5eb9ad737f64daa5435139ddc9c128.svg`. Original monochrome 1600x900 cover and editable SVG are local under assets/store. Actual 576x288 RGBA simulator capture is ready there unchanged.

The screenshot file chooser rejected setFiles because the existing ChatGPT Chrome extension lacks Allow access to file URLs. No screenshot upload executed; remote re-read confirms screenshot count 0 and no cover. The permission was not enabled, and the upload was not retried or bypassed. The observed editor generates a cover from screenshots plus portal environments; the original standalone cover is an additional local asset, not a falsely claimed saved portal cover.

Privacy/terms approval draft is docs/privacy-terms-approval-draft.md; it explicitly says current relay dialogue can remain indefinitely, has no automatic/self-service deletion, and revocation does not erase history. Proposed 30-day deletion remains separate and unimplemented. No personal operator/contact details or legal commitments were published. Short practical hardware sequence is docs/physical-release-smoke.md.

Runtime source/build unchanged since 1c0c6a7; existing 109-test result still applies. Asset-only checks: icon 24x24, permitted RGBA pixels and raster-consumed 2x2 blocks; PNG source capture 576x288; cover 1600x900 greyscale; visual inspection of generated icon/cover. No additional runtime test rerun needed for artwork/docs. Remote remains build 119761 / 0.4.1 / Private / no channels / review null. Creator name and privacy URL still empty.
