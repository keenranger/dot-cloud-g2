"use client";

import { useEffect, useId } from "react";
import { AUTONYMS, LOCALES, type Locale, langTag } from "@/lib/locale";
import { LOCALE_COOKIE, copy } from "@/app/i18n/dashboard";

// A plain GET form, so a choice works before hydration and reloads the same page in the chosen language; the server
// re-reads the account, connection and key state, so nothing is reset or changed. The choice is applied only by the
// button, never when the list changes, and the saved choice keeps the language on later visits.
export default function LanguageSwitch({ locale, action }: { locale: Locale; action: string }) {
  const id = useId();
  const t = copy[locale].page;
  useEffect(() => {
    // The root layout renders one default language; screen readers need the page's actual language.
    document.documentElement.lang = langTag(locale);
  }, [locale]);
  return (
    <form
      className="language-switch"
      method="get"
      action={action}
      onSubmit={(event) => {
        const chosen = new FormData(event.currentTarget).get("lang");
        if (typeof chosen === "string" && (LOCALES as readonly string[]).includes(chosen))
          document.cookie = `${LOCALE_COOKIE}=${chosen}; path=/; max-age=31536000; samesite=lax`;
      }}
    >
      <label htmlFor={id}>{t.language}</label>
      {/* Keyed by the language: a client navigation that keeps this form mounted (the policy page's English-version link)
          gets a fresh list showing the new language, since defaultValue only applies on mount. */}
      <select key={locale} id={id} name="lang" defaultValue={locale} autoComplete="off">
        {LOCALES.map((option) => (
          <option key={option} value={option} lang={langTag(option)}>
            {AUTONYMS[option]}
          </option>
        ))}
      </select>
      <button type="submit">{t.apply}</button>
    </form>
  );
}
