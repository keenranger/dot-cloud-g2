"use client";

import { useEffect } from "react";
import { LOCALE_COOKIE, type Locale, copy, localePath, locales } from "@/app/i18n/dashboard";

// Plain links so switching works before hydration; the saved choice keeps the language on later visits.
export default function LanguageSwitch({ locale }: { locale: Locale }) {
  useEffect(() => {
    // The root layout renders one default language; screen readers need the page's actual language.
    document.documentElement.lang = locale;
  }, [locale]);
  return (
    <nav className="language-switch" aria-label={copy[locale].page.language}>
      {locales.map((option) => (
        <a
          key={option}
          href={localePath(option)}
          lang={option}
          hrefLang={option}
          aria-current={option === locale ? "true" : undefined}
          onClick={() => {
            document.cookie = `${LOCALE_COOKIE}=${option}; path=/; max-age=31536000; samesite=lax`;
          }}
        >
          {copy[option].languageName}
        </a>
      ))}
    </nav>
  );
}
