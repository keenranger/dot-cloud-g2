# AGENTS.md

Operational guide for agents working in this repository. Product and security design live in `README.md` and `even-app/README.md`; this file covers release paths and their boundaries.

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
pnpm -C even-app install
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

## Security and evidence

- Soniox: the phone connects directly to Soniox over WSS with the user's key. The key stays in session memory by default; device persistence is an opt-in SDK setting. The relay never receives the key or raw audio.
- Do not touch account sessions, `.env*`, `.dev.vars*`, credentials, or other secrets.
- Do not fabricate proof. Passing tests or builds is not evidence of real behavior in the Even Hub WebView, Soniox, the G2 glasses, or a Mac-off round trip. Report only what was observed on real devices and services, and name what remains unverified.
