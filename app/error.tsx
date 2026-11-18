"use client";

import { useEffect, useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
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
        <VStack gap={5}>
          <Heading level={1} type="display-3">
            {t.error.title}
          </Heading>
          <Text as="p" type="large" color="secondary">
            {t.error.body}
          </Text>
          <HStack gap={3} wrap="wrap">
            <Button type="button" variant="primary" label={t.error.retry} onClick={reset} />
            <Button as="a" href={localePath(locale)} variant="secondary" label={t.error.home} />
          </HStack>
        </VStack>
      </main>
      <footer className="site-footer">
        <Text type="supporting" color="secondary">
          {PRODUCT_NAME}
        </Text>
        <PolicyLinks locale={locale} />
        <SupportLinks t={t.page} />
      </footer>
    </div>
  );
}
