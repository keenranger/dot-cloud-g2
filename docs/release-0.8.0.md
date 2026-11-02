# Dots Lens for G2 0.8.0

## Changes

- Remove example URLs from the companion UI and reject bundle URL origins absent from the generated network whitelist before packaging. A failed check removes the stale manifest.
- Provide English, German, French, Spanish, Italian, Simplified Chinese, Japanese and Korean on the companion and owned website pages, including complete policy translations.
- Initially select a concrete supported language from the user's language preferences. A saved explicit choice takes precedence; the list has no Automatic option. Companion language changes retain connections, drafts, capture state and interim/final replies.
- Add fixed public GitHub repository and Issues links for usage guidance, questions and feature requests, without including user data in their URLs.
- Fix locale selection after policy client navigation and wrap long localized controls on narrow screens.

## Verification

The integrated root suite passed 168 tests and the companion suite passed 126 tests. Root and companion builds, lint and type checks passed. The production-origin manifest URL whitelist check passed. Claude Opus independently reviewed the website's seven translated catalogs and full policy translations, and another Opus worker reviewed the companion support translations. An independent Codex pass identified the stale dropdown selection; the correction was reproduced and verified in the native browser.

Native browser verification used a frozen source export, isolated dependencies and disposable local database state. It covered all eight languages on the signed-out home, privacy, terms, missing page and signed-in dashboard; static GitHub destinations and safe link attributes; native selection and Apply; keyboard-visible focus; and 320px/desktop layout. Both observed overflow defects were preserved before repair, and affected cases passed on the final CSS. German/Japanese companion dashboard URLs carried the language code, and the local receiving pages resolved it correctly. No production link or external account flow was exercised.

## Remaining boundaries

- Missing-page body content is localized, but its document title and document-level language retain the English layout defaults; its content container carries the correct language.
- The generic error boundary starts in English and selects the browser language after mounting; runtime error injection was not performed.
- Actual assistive-technology speech, operating-system Korean IME, revealed-key browser layout, Even SDK persistence, real phone/G2 behavior, external-browser return, lock/background lifetime, providers and hosted authentication remain separate verification gates.
- Translations received model review, not native-speaker or legal certification. Existing canonical English policy text was preserved.
- Publication results and artifact identity must be recorded from the actual Sites and Even Hub responses; local checks do not establish publication or physical-device success.

## Companion artifact

`outputs/dot-cloud-0.8.0.ehpk` was built with SDK 0.0.16 and minimum Even app 2.2.10. Size: 7,610,160 bytes. SHA-256: `887730e5cca2968f1b938375b067ce6b9e2c1be1c049f3bf688457fee1eafeb0`.

The first CLI packaging attempt rejected a network permission description longer than 300 characters. The description was shortened without changing destinations or data handling; manifest validation and CLI packaging then passed. Upload requires a currently authenticated Even CLI session; packaging alone does not establish upload or review status.

## Publication record (2026-11-02)

- Reviewed, GPG-signed source: `18c47fe7c90f4dc7a331efd429a855719fcda41b`. GitHub branch `fix/bundle-network-whitelist` was pushed and PR [#11](https://github.com/keenranger/dot-cloud-g2/pull/11) opened against `main`; it was not merged. GitHub reported no automated checks for the branch, so local checks must not be described as CI results.
- The native Sites workflow built and pushed the same source, saved version 13 and completed deployment `appgdep_6ae83d2ceb9081919351235671c5d542` successfully at `https://hey-dots-g2.keenranger.chatgpt.site`. The existing public audience and project identity were preserved. Deployment archive SHA-256: `ecebf51963867ccf99a68a31c4dfaa046575c8f80537bd0246772b1252fdb558`.
- Anonymous HTTP checks with the native curl client passed all 24 combinations of eight languages and home/privacy/terms: HTTP success, expected scoped language and the exact GitHub Issues destination. An earlier Python urllib request received HTTP 403; it was retained as a client-specific observation. These are response checks, not hosted browser, authenticated-account or cross-app proof.
- After interactive CLI login renewal, `evenhub upload` created build **130157**, version **0.8.0**, status **Private**, size **7,610,160 bytes**. A separate `evenhub ls` read-back confirmed version, size, status and empty channels. The previously public version was 0.6.3; the rejected 0.7.0 remained unchanged.
- Private upload does not establish public review or publication. The CLI supports upload; public review/public publishing is a portal operation. Any later review submission must be recorded from its own confirmed result.
