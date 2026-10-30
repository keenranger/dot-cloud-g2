import { cookies } from "next/headers";
import Link from "next/link";
import { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser } from "./chatgpt-auth";
import Dashboard from "./components/dashboard";
import LanguageSwitch from "./components/language-switch";
import { PolicyLinks } from "./components/policy-page";
import { LOCALE_COOKIE, PRODUCT_NAME, copy, localePath, resolveLocale } from "./i18n/dashboard";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  // An explicit ?lang= wins, then the saved choice, then English.
  const locale = resolveLocale((await searchParams).lang, (await cookies()).get(LOCALE_COOKIE)?.value);
  const t = copy[locale].page;
  const user = await getChatGPTUser();
  return (
    <div className="shell" lang={locale}>
      <header className="site-header">
        <Link className="brand" href={localePath(locale)} aria-label={t.home}>
          <span className="brand-mark" aria-hidden="true">
            g2
          </span>{" "}
          {PRODUCT_NAME}
        </Link>
        <span className="header-note">{t.headerNote}</span>
        <LanguageSwitch locale={locale} />
        {user && (
          <a className="text-link" href={chatGPTSignOutPath(localePath(locale))} target="_top">
            {t.signOut}
          </a>
        )}
      </header>
      <main id="main">
        <section className="intro">
          <p className="eyebrow">{t.eyebrow}</p>
          <h1>
            {t.titleLines[0]}
            <br />
            <span>{t.titleLines[1]}</span>
          </h1>
          <p className="intro-copy">{t.intro}</p>
          <ol className="flow" aria-label={t.flowLabel}>
            {t.flow.map((step) => (
              <li key={step}>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <p className="intro-needs">{t.needs}</p>
        </section>
        {user ? (
          <Dashboard displayName={user.displayName} locale={locale} />
        ) : (
          <section className="signin-panel" aria-labelledby="signin-title">
            <div>
              <p className="eyebrow">{t.signInEyebrow}</p>
              <h2 id="signin-title">{t.signInTitle}</h2>
              <p>{t.signInBody}</p>
            </div>
            <a className="button primary" href={chatGPTSignInPath(localePath(locale))} target="_top">
              {t.signIn} <span aria-hidden="true">↗</span>
            </a>
          </section>
        )}
        <aside className="verification-note" aria-labelledby="preview-title">
          <span className="status-dot" aria-hidden="true" />
          <p>
            <strong id="preview-title">{t.previewTitle}</strong> · {t.previewBody}
          </p>
        </aside>
      </main>
      <footer>
        <span>{PRODUCT_NAME}</span>
        <span>{t.footer}</span>
        <PolicyLinks label={t.policies} privacy={t.privacy} terms={t.terms} />
      </footer>
    </div>
  );
}
