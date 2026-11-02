"use client";

import { useEffect, useState } from "react";
import { type Locale, langTag, resolveLocale } from "@/lib/locale";
import { PolicyLinks } from "./components/policy-page";
import SupportLinks from "./components/support-links";
import { LOCALE_COOKIE, PRODUCT_NAME, copy, localePath } from "./i18n/dashboard";

// Shown when a page fails to render. The failure itself is never shown: it can carry internal details. The language is
// read in the browser in the same order as the server (address, saved choice, browser languages) after mount, so the
// first render matches the server's English fallback.
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => {
    const cookie = document.cookie
      .split(";")
      .map((part) => part.trim().split("="))
      .find(([name]) => name === LOCALE_COOKIE)?.[1];
    const chosen = resolveLocale({
      query: new URLSearchParams(window.location.search).get("lang"),
      cookie,
      acceptLanguage: navigator.languages?.length ? navigator.languages.join(",") : navigator.language,
    });
    setLocale(chosen);
    document.documentElement.lang = langTag(chosen);
  }, []);
  const t = copy[locale];
  return (
    <div className="shell" lang={langTag(locale)}>
      <header className="site-header">
        <a className="brand" href={localePath(locale)} aria-label={t.page.home}>
          <span className="brand-mark" aria-hidden="true">
            g2
          </span>{" "}
          {PRODUCT_NAME}
        </a>
      </header>
      <main id="main" className="notice-page">
        <h1>{t.error.title}</h1>
        <p>{t.error.body}</p>
        <p className="notice-actions">
          <button type="button" className="button primary" onClick={reset}>
            {t.error.retry}
          </button>
          <a className="button secondary" href={localePath(locale)}>
            {t.error.home}
          </a>
        </p>
      </main>
      <footer>
        <span>{PRODUCT_NAME}</span>
        <PolicyLinks locale={locale} />
        <SupportLinks t={t.page} />
      </footer>
    </div>
  );
}
