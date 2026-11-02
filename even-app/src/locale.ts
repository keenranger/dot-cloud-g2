import type { SplitMarkers } from "./protocol.ts";
import type { SonioxTranscriptionError } from "./soniox-transcriber.ts";
import type { RequestFailure } from "./voice-flow.ts";
import type { WakeBlocker } from "./wake-gate.ts";
import { de } from "./messages/de.ts";
import { en, type IdleState, type Messages } from "./messages/en.ts";
import { es } from "./messages/es.ts";
import { fr } from "./messages/fr.ts";
import { it } from "./messages/it.ts";
import { ja } from "./messages/ja.ts";
import { ko } from "./messages/ko.ts";
import { zh } from "./messages/zh.ts";

/** The UI languages Even Hub accepts in `supported_languages`; `zh` is Simplified Chinese. */
export const LANGUAGES = ["en", "de", "fr", "es", "it", "zh", "ja", "ko"] as const;
export type Language = (typeof LANGUAGES)[number];
export const LANGUAGE_STORAGE = "dot-cloud-language-v1";
export const APP_NAME = "Dots Lens for G2";
/** Each language's name in itself, as the language list shows it. */
export const AUTONYMS: Record<Language, string> = {
  en: "English",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  it: "Italiano",
  zh: "简体中文",
  ja: "日本語",
  ko: "한국어",
};
/** The BCP 47 tag for `lang`, so the script and glyph forms match (Simplified Chinese is not Japanese kanji). */
export const langTag = (code: Language): string => (code === "zh" ? "zh-Hans" : code);
const CATALOGS: Record<Language, Messages> = { en, de, fr, es, it, zh, ja, ko };

let language: Language = "en";
export const currentLanguage = (): Language => language;
export function setLanguage(value: Language): void {
  language = value;
}
/** The text of the selected language. */
export const msg = (): Messages => CATALOGS[language];

const isLanguage = (value: string): value is Language => (LANGUAGES as readonly string[]).includes(value);
/**
 * A saved choice: a language code as the radio switch (en, ko) and this list save it. Anything else, including nothing
 * saved and the "auto" an earlier list saved, is undefined and leaves the language detected at startup in place.
 */
export const parseLanguagePreference = (raw: string | null | undefined): Language | undefined =>
  raw && isLanguage(raw) ? raw : undefined;

/**
 * The first of the phone's preferred languages (BCP 47 tags, most preferred first) that the app has, matched by its
 * primary subtag so a regional variant such as de-AT or es-419 uses its language; English when none matches.
 * Traditional Chinese (zh-Hant, or zh-TW, zh-HK, zh-MO without a script) is not matched to Simplified Chinese.
 */
export function detectLanguage(preferred: readonly (string | undefined)[]): Language {
  for (const tag of preferred) {
    const [primary = "", ...rest] = (tag ?? "").toLowerCase().replace(/_/g, "-").split("-");
    if (!isLanguage(primary)) continue;
    if (
      primary === "zh" &&
      (rest.includes("hant") || (!rest.includes("hans") && rest.some((s) => ["tw", "hk", "mo"].includes(s))))
    )
      continue;
    return primary;
  }
  return "en";
}

export const wakeBlocked = (reason: WakeBlocker): string => msg().wakeBlocked[reason];
export const failureText = (kind: RequestFailure, submission: boolean): string =>
  msg().requestFailure(kind, submission);
export const sttText = (error: SonioxTranscriptionError): string => msg().stt(error);
/** A fixed message a helper module throws (written in Korean), in the selected language; other text stays as it is. */
export function messageText(text: string): string {
  const key = (Object.keys(ko.thrown) as (keyof Messages["thrown"])[]).find((k) => ko.thrown[k] === text);
  return key ? msg().thrown[key] : text;
}
export const idleText = (state: IdleState): string => msg().idle(state, APP_NAME);
export const edgeText = (count: number, delta: number): string => msg().edge(count, delta);
/** Every language's markers: a reply split once still fits after the language changes. */
export const SPLIT_MARKERS: readonly SplitMarkers[] = LANGUAGES.map((code) => CATALOGS[code].splitMarkers);
export const splitMarkers = (): SplitMarkers => msg().splitMarkers;
export const captionLive = (): string => msg().captionLive;
export const captionFinishing = (): string => msg().captionFinishing;
