import Link from "next/link";

export const EFFECTIVE_DATE = "2026-10-26";
export const CONTACT_EMAIL = "kghnkl0103@gmail.com";
export const RELAY_ORIGIN = "https://hey-dots-g2.keenranger.chatgpt.site";

// Shared frame for the public policy pages: plain text, English, no account state.
export default function PolicyPage({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <div className="shell">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="G2 Bridge 홈">
          <span className="brand-mark" aria-hidden="true">
            g2
          </span>{" "}
          G2 Bridge
        </Link>
      </header>
      <main id="main" className="policy" lang="en">
        <h1>{title}</h1>
        <p className="policy-meta">
          Lens MCP for G2 · Effective <time dateTime={EFFECTIVE_DATE}>October 26, 2026</time>
        </p>
        {children}
      </main>
      <footer>
        <span>G2 Bridge</span>
        <PolicyLinks />
      </footer>
    </div>
  );
}

export function PolicyLinks() {
  return (
    <nav className="policy-links" aria-label="정책">
      <Link href="/privacy" hrefLang="en">
        개인정보 처리방침 (Privacy)
      </Link>
      <Link href="/terms" hrefLang="en">
        이용약관 (Terms)
      </Link>
    </nav>
  );
}
