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
