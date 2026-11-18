// The site's languages and how a visit picks one. Plain functions only, so the server, the browser and tests share
// them. The list, names and detection match the Even Hub companion (even-app/src/locale.ts); tests/web-locale.test.mjs
// keeps the two in step without bundling the companion's text into the site.

/** `zh` is Simplified Chinese. */
export const LOCALES = ["en", "de", "fr", "es", "it", "zh", "ja", "ko"] as const;
export type Locale = (typeof LOCALES)[number];

/** Each language's name in itself, as the language list shows it. */
export const AUTONYMS: Record<Locale, string> = {
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
export const langTag = (code: Locale): string => (code === "zh" ? "zh-Hans" : code);

const isLocale = (value: string): value is Locale => (LOCALES as readonly string[]).includes(value);

/** An address or saved choice counts only as an exact language code; anything else, such as "auto", is ignored. */
export function parseLocale(value: string | readonly string[] | null | undefined): Locale | undefined {
  const raw = typeof value === "string" ? value : value?.[0];
  return raw && isLocale(raw) ? raw : undefined;
}

/**
 * The first preferred language (BCP 47 tags, most preferred first) the site has, matched by its primary subtag so a
 * regional variant such as de-AT or es-419 uses its language; English when none matches. Traditional Chinese
 * (zh-Hant, or zh-TW, zh-HK, zh-MO without a script) is not matched to Simplified Chinese.
 */
export function detectLocale(preferred: readonly (string | undefined)[]): Locale {
  for (const tag of preferred) {
    const [primary = "", ...rest] = (tag ?? "").toLowerCase().replace(/_/g, "-").split("-");
    if (!isLocale(primary)) continue;
    if (
      primary === "zh" &&
      (rest.includes("hant") || (!rest.includes("hans") && rest.some((s) => ["tw", "hk", "mo"].includes(s))))
    )
      continue;
    return primary;
  }
  return "en";
}

/** The tags of an Accept-Language header, highest quality first; equal qualities keep their order. */
export function parseAcceptLanguage(header: string | null | undefined): string[] {
  const entries: { tag: string; q: number; i: number }[] = [];
  (header ?? "").split(",").forEach((part, i) => {
    const [tag = "", ...params] = part.trim().split(";");
    let q = 1;
    for (const param of params) {
      const [name, value] = param.trim().split("=");
      if (name?.trim().toLowerCase() === "q")
        q = /^(0(\.\d{0,3})?|1(\.0{0,3})?)$/.test(value?.trim() ?? "") ? Number(value) : 0;
    }
    if (tag && tag !== "*" && q > 0) entries.push({ tag: tag.trim(), q, i });
  });
  return entries.sort((a, b) => b.q - a.q || a.i - b.i).map((e) => e.tag);
}

/** An explicit `?lang=` wins, then the saved choice, then the browser's languages, then English. */
export function resolveLocale({
  query,
  cookie,
  acceptLanguage,
}: {
  query?: string | readonly string[] | null;
  cookie?: string | null;
  acceptLanguage?: string | null;
}): Locale {
  return parseLocale(query) ?? parseLocale(cookie) ?? detectLocale(parseAcceptLanguage(acceptLanguage));
}

/**
 * A date-only ISO day (YYYY-MM-DD) written in a language. Read and written in UTC, so the day never shifts with the
 * server's or browser's time zone.
 */
export function formatDay(isoDay: string, dateLocale: string): string {
  return new Intl.DateTimeFormat(dateLocale, { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${isoDay}T00:00:00Z`),
  );
}
