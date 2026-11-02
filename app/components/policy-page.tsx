import Link from "next/link";
import { type Locale, formatDay, langTag } from "@/lib/locale";
import { PRODUCT_NAME, copy, localePath, policyPath } from "../i18n/dashboard";
import LanguageSwitch from "./language-switch";
import SupportLinks from "./support-links";

export const EFFECTIVE_DATE = "2026-10-26";
export const CONTACT_EMAIL = "kghnkl0103@gmail.com";
export const RELAY_ORIGIN = "https://hey-dots-g2.keenranger.chatgpt.site";

// Shared frame for the public policy pages: plain text in the visitor's language, no account state. The English text
// stays available from the language list and the English-version link.
export default function PolicyPage({
  locale,
  page,
  title,
  children,
}: Readonly<{ locale: Locale; page: "privacy" | "terms"; title: string; children: React.ReactNode }>) {
  const t = copy[locale];
  const effective = formatDay(EFFECTIVE_DATE, t.dateLocale);
  return (
    <div className="shell" lang={langTag(locale)}>
      <header className="site-header">
        <Link className="brand" href={localePath(locale)} aria-label={t.page.home}>
          <span className="brand-mark" aria-hidden="true">
            g2
          </span>{" "}
          {PRODUCT_NAME}
        </Link>
        <LanguageSwitch locale={locale} action={`/${page}`} />
      </header>
      <main id="main" className="policy">
        <h1>{title}</h1>
        <p className="policy-meta">
          {PRODUCT_NAME} ({t.policy.formerly}) · {t.policy.effective} <time dateTime={EFFECTIVE_DATE}>{effective}</time>
          {locale !== "en" && (
            <>
              {" · "}
              <Link href={policyPath(page, "en")} hrefLang="en">
                {t.policy.englishVersion}
              </Link>
            </>
          )}
        </p>
        {children}
      </main>
      <footer>
        <span>{PRODUCT_NAME}</span>
        <PolicyLinks locale={locale} />
        <SupportLinks t={t.page} />
      </footer>
    </div>
  );
}

// The policies in the language of the page that links to them.
export function PolicyLinks({ locale }: { locale: Locale }) {
  const t = copy[locale].page;
  return (
    <nav className="policy-links" aria-label={t.policies}>
      <Link href={policyPath("privacy", locale)}>{t.privacy}</Link>
      <Link href={policyPath("terms", locale)}>{t.terms}</Link>
    </nav>
  );
}
