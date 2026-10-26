# AGENTS.md

Operational guide for agents working in this repository. Product and security design live in `README.md` and `even-app/README.md`; this file covers verification, release paths and their boundaries.

## Production targets

| Target | Identity |
| --- | --- |
| Source repository | `origin` = `https://github.com/keenranger/dot-cloud-g2.git` (public), branch `main` |
| Sites project | `appgprj_6adb099c2f588191a35d9749cda26f1f` (recorded in `.openai/hosting.json`) |
| Relay public URL | `https://hey-dots-g2.keenranger.chatgpt.site` (MCP endpoint: `/mcp`) |
| Even Hub app | package ID `app.mark.evendotscloud`, portal display name `Lens MCP for G2` (observed 2026-10-24), manifest name `Lens MCP for G2` (builds through 0.4.0: `Dot Cloud`) |
| Even Hub portal | `https://hub.evenrealities.com/hub/app.mark.evendotscloud/store-listing` |

## Publishing authorization

- Publishing needs explicit user authorization for the target and action: GitHub push, Sites save/deploy, and Even Hub upload. That authorization persists within the same ongoing task and its approved targets, actions, and conditions; do not ask again solely because the turn, commit, or version changed. It does not become standing authorization after the task is complete, and material scope changes need renewed authorization.
- Even Hub public review, store publishing, `evenhub promote`, `evenhub delist`, `evenhub rm`, `evenhub update`, and `evenhub create` each need their own explicit authorization. An upload authorization does not include any of them.
- Commits are GPG-signed (`git commit -S`).
- Future changes go on a branch and through a reviewable pull request; do not push directly to `main`. Already released history on `main` stays as is (no rewrite or force-push).

## Relay deploy (Sites)

Use the native Sites skill workflow only. Never deploy with `wrangler deploy` or any other path that bypasses Sites.

1. Read `.openai/hosting.json` and keep its `project_id`. Never create a new Sites project for this repository, and preserve the existing fields.
2. Locate the official helpers from the installed Sites skill instead of hard-coding a version. The plugin root is the directory holding `scripts/site-workflow.mjs` and `scripts/build-site.mjs` (at the time of writing: `~/.codex/plugins/cache/openai-curated-remote/sites/<version>/`). Follow that skill's `SKILL.md` as the contract.
3. Obtain a source credential with `create_source_repository_write_credential` for this project. Pass it to `node <plugin-root>/scripts/site-workflow.mjs --project-id appgprj_6adb099c2f588191a35d9749cda26f1f` through hidden stdin only. Keep it in session memory; never put it in arguments, environment files, logs, or output.
4. Package with commands `[["node", "<plugin-root>/scripts/build-site.mjs"]]` and an absolute `archivePath`. The helper owns signed commit, native push, and the archive; keep the archive unchanged until saving succeeds.
5. Publish with the returned `project_id`, `commit_sha`, and `archive`: `save_site_version`, then `deploy_site_version` (the Site has a public audience). Poll `get_deployment_status` only while `pending`, `building`, or `publishing`; stop on a terminal result.
6. Preserve the project audience and public authorization settings. Hosted D1 migrations are applied by the Sites deployment; never replay local SQL against production.

Pushing source to GitHub (`origin`) is a separate target from the Sites source repository. Push only within explicit user authorization; existing authorization for the same ongoing publishing task remains valid.

## Companion release (Even Hub)

Use the global CLI `/Users/mark/Library/pnpm/bin/evenhub` (verified 0.2.0; it supports `upload`). A reference clone ships CLI 0.1.14, which is suitable for packaging only.

Read-only checks, safe at any time:

```sh
evenhub --version
evenhub self-check --json
evenhub ls app.mark.evendotscloud --json
```

If the CLI is not signed in, ask the user to run `evenhub login` interactively. Never read or copy CLI auth files.

Build and package (scripts as defined in `even-app/package.json`):

```sh
pnpm -C even-app install --frozen-lockfile
pnpm -C even-app build
pnpm -C even-app test
pnpm -C even-app lint
pnpm -C even-app typecheck:test
RELAY_ORIGIN=https://hey-dots-g2.keenranger.chatgpt.site pnpm -C even-app manifest
evenhub pack even-app/app.json even-app/dist --sdk-ver 0.0.16 -o outputs/dot-cloud-<version>.ehpk
shasum -a 256 outputs/dot-cloud-<version>.ehpk
stat -f %z outputs/dot-cloud-<version>.ehpk
```

- Run `pack` from the repository root. `RELAY_ORIGIN` must be the exact HTTPS origin with no path; `manifest` writes the git-ignored `even-app/app.json`.
- The version is hard-coded in `even-app/scripts/manifest.mjs` and `even-app/package.json`. Update both for a release. Routine version bumps within an authorized release need no separate approval.
- Before relying on a CLI flag, confirm it with `evenhub <command> --help`.

Upload (requires explicit authorization):

```sh
evenhub upload outputs/dot-cloud-<version>.ehpk --package-id app.mark.evendotscloud -m "<changelog>" --json
evenhub ls app.mark.evendotscloud --json
```

- Verify with `evenhub ls` that the remote entry's version, status, and size match the local artifact.
- If an upload result is ambiguous, read remote state with `evenhub ls` first. Never retry blindly and never pass `--new-draft` without a confirmed reason.
- Prefer the CLI. The browser portal is a fallback only. It needs the ChatGPT browser extension with "Allow access to file URLs" granted by the user, and must not scrape or reuse auth state.
- Installation of Private builds: in the Even app, Me > Apps > Private builds.

### Historical snapshot (2026-10-23, before 0.3.0)

- Remote `0.2.0`: status Private, 7558005 bytes, no channels. Local `outputs/dot-cloud-0.2.0.ehpk` SHA-256 `27e957b85808816e30754a85737af8d10ba7ead2f31bcb8912dc5b89929d2b59`.
- Built from signed source commit `37580095fcff175784234845b58adce7967633f5` on `main`.
- Remote `0.1.0` is also Private. Neither is in review or public.

### Historical 0.3.0 upload (2026-10-23)

This records the earlier 0.3.0 release only; it does not describe the current source or latest remote build.

- Build ID 119595 was Private, 7,558,524 bytes, with no channels. Local `outputs/dot-cloud-0.3.0.ehpk` SHA-256: `79e85e6d03e08eb4b4f2b912f1195e110746740ffd2230f08840d0d622ccbb31`; the recorded `evenhub ls` size matched.
- Source: signed commit `4cd639ad390e17d8ea690b31fcb34cb70cb83f21`, which added phone-side Soniox streaming during recording.
- Builds 0.2.0 (119579) and 0.1.0 (119524) were also Private, with none in review or public at that time.
- The relay was deployed through the existing Sites project at the URL above. Its recorded Sites-workflow source commit was `3d586c7c4dc29bd99573464f0fa9169d526ad372`; the 0.3.0 source change touched only `even-app/`.

Re-read the remote state before acting; these historical snapshots are not current-state verification.

### Deployment snapshot (2026-10-24)

- Signed source `7f48b9c4d217e4e111477c5aed261c08133ed841`; native Sites workflow saved version 6 and deployment `appgdep_6adca17de560819180424353d0c654a1` succeeded at 12:16:10.672605 UTC. Audience remained public.
- Even Hub 0.5.0, build 120792: Private, no channels, 7,566,491 bytes; SHA-256 `daee63bd8776fbd7c958ae4a1a6759cdfa78abad322a526140cc15ee85dc52c4`. CLI upload/read-back confirmed; SDK 0.0.16, minimum Even app 2.2.10.
- See `docs/release-0.5.0-deployment.md`. Daily cleanup is not active; hosted D1 semantics/quota and physical runtime proof remain open. Policy documents remain drafts. Re-read remote state before acting.

## Verification without physical devices

Maximize applicable verification before handing remaining work to physical-device QA. A missing phone or G2 blocks hardware-dependent gates, not local implementation, integration, simulator, accessibility or packaging checks.

### Exercise the changed behavior

- Run the relevant root and companion checks from their `package.json` files. For releases or interacting changes, validate the integrated source, not separate branches or an earlier candidate.
- Use `tests/companion-runtime.test.mjs` to drive the actual companion entry point through fake SDK, DOM, network and timer boundaries. Reproduce ordering failures with controlled acknowledgements, requests and clocks. Helper-only tests do not establish integration behavior.
- Cover affected combinations: partial/final transcription, auto-send ON/OFF, explicit navigation, deferred replies, cancellation, unknown submission outcomes, deletion/expiry, stale snapshots, visibility transitions and reconnects. Add failing regressions for observed defects rather than duplicating implementation logic.
- Run production relay SQL and migrations against an isolated local database. Exercise owner isolation, transaction failure, expiry boundaries, retries and late callbacks. Local SQLite/D1 shims do not establish hosted D1 semantics or quotas.
- Exercise the real packaged wake WASM/models offline when wake behavior changes. Silence proves initialization and negative detection only. Use synthetic or explicitly authorized, non-sensitive recorded audio for positive and negative phrase cases; record input format and corpus provenance. Do not infer acoustic accuracy from silence or fake detector events.

### Use the official Even Hub simulator

Local verification includes preparing and running the official simulator. If it is missing, use a versioned, task-local installation or cache through the native package manager; do not stop at a failed PATH lookup or scan unrelated home directories. Verify the official publisher, selected version and supported commands before use. Before package installation, create a standalone temporary package outside the repository/workspace; an empty outputs directory can make pnpm select the enclosing parent project. Do not change global settings, application dependencies or lifecycle-script policy merely to make verification pass.

Run the exact candidate's built companion against an isolated local relay or controlled fixtures. Exercise startup, Korean and long text, running captions, reply navigation and supported gesture events. Test display rejection and delayed acknowledgements in the actual-entry-point harness when the simulator cannot inject them. Use only automation capabilities documented by the installed simulator; do not invent endpoints or treat unsupported scenarios as passed.

Capture the original glasses framebuffer after the target state renders. Record source commit and dirty state, build identity, simulator version, scenario, logs, image path and hash. Preserve the original RGBA/alpha encoding. A phone WebView capture or older screenshot is not a candidate glasses capture; label derived viewing aids and keep them separate from the original. Route GUI work through the existing separate-executor rules.

### Verify the local phone and dashboard experience

Use the supported local preview and native local sign-in with disposable data. Check keyboard operation, focus after success/cancel/failure, accessible names, live feedback, Korean IME, responsive layout and overflow. Inspect the actual DOM/accessibility tree and use available assistive technology; source inspection alone does not prove announcements or focus behavior.

A failure of one browser backend does not establish that all browser verification is unavailable. Inspect the supported browser/executor inventory and use an available alternative through its normal approval flow. Do not scrape sessions, bypass authentication or retry unavailable tools blindly. An HTTP 200 establishes server readiness, not a rendered or accessible interface.

### Recover and preserve evidence

Preserve the first failure and source identity before repair. Diagnose it, make a bounded routine local repair within the authorized scope, record what changed, and rerun the affected check. Do not repeat an unchanged failure, relax checks or silently download an alternative tool. Preparing the official simulator as described above is authorized local setup; missing local tooling is not a physical-device blocker. If a capability remains unavailable, mark only that gate blocked and continue independent checks.

For release reproducibility, use clean source exports, frozen installs and isolated dependency stores rather than linking a shared `node_modules`. Compare all output paths and hashes when claiming reproducibility. Earlier-source results do not establish the final candidate; rerun affected validation after integration or fixes, including when separately passing branches introduce ordering interactions.

Keep a concise evidence matrix: requirement, exact source/build, method, observed result, artifact/log and remaining boundary. Preserve reports and release artifacts outside a worktree before removing it; ignored files can contain the only copies.

### Keep physical boundaries explicit

Mocks and simulated visibility/events prove application behavior under those inputs, not iOS lock-time suspension, Even WebView lifetime, real G2 microphone routing, BLE timing, optical readability, battery use, real provider performance or Mac-off operation.

Before reporting that progress requires hardware, complete the applicable checks above and name the exact remaining physical scenario and acceptance criterion. Do not require irrelevant checks or repeat unchanged successful suites without a new reason. Simulator setup and local validation do not authorize production data changes, account/permission changes, publishing or physical-device mutation.

## Security and evidence

- Soniox: the phone connects directly to Soniox over WSS with the user's key. The key stays in session memory by default; device persistence is an opt-in SDK setting. The relay never receives the key or raw audio.
- Do not touch account sessions, `.env*`, `.dev.vars*`, credentials, or other secrets.
- Do not fabricate proof. Label source review, automated tests, simulator/browser observations, hosted-service checks and physical-device observations separately. Report the exact evidence and its limits; no layer substitutes for another.
