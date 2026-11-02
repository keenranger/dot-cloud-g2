import Link from "next/link";
import { langTag } from "@/lib/locale";
import { PolicyLinks } from "./components/policy-page";
import SupportLinks from "./components/support-links";
import { PRODUCT_NAME, copy, localePath } from "./i18n/dashboard";
import { requestLocale } from "./i18n/request-locale";

// Any address the site does not have. Not-found pages receive no search parameters, so the language comes from the
// saved choice, then the browser's languages.
export default async function NotFound() {
  const locale = await requestLocale();
  const t = copy[locale];
  return (
    <div className="shell" lang={langTag(locale)}>
      <header className="site-header">
        <Link className="brand" href={localePath(locale)} aria-label={t.page.home}>
          <span className="brand-mark" aria-hidden="true">
            g2
          </span>{" "}
          {PRODUCT_NAME}
        </Link>
      </header>
      <main id="main" className="notice-page">
        <h1>{t.notFound.title}</h1>
        <p>{t.notFound.body}</p>
        <p>
          <Link className="button primary" href={localePath(locale)}>
            {t.notFound.home}
          </Link>
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
