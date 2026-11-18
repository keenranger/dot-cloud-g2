import Link from "next/link";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { PRODUCT_NAME } from "../i18n/dashboard";

export const EFFECTIVE_DATE = "2026-10-26";
export const CONTACT_EMAIL = "kghnkl0103@gmail.com";
export const RELAY_ORIGIN = "https://hey-dots-g2.keenranger.chatgpt.site";

// Shared frame for the public policy pages: plain text, English, no account state.
export default function PolicyPage({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <div className="shell">
      <header className="site-header">
        <Link className="brand" href="/?lang=en" aria-label={`${PRODUCT_NAME} home`}>
          <span className="brand-mark" aria-hidden="true">
            g2
          </span>{" "}
          {PRODUCT_NAME}
        </Link>
      </header>
      <main id="main" className="policy" lang="en">
        <Heading level={1} type="display-3">
          {title}
        </Heading>
        <Text as="p" type="supporting" color="secondary" className="policy-meta">
          {PRODUCT_NAME} (formerly Lens MCP for G2) · Effective <time dateTime={EFFECTIVE_DATE}>October 26, 2026</time>
        </Text>
        {children}
      </main>
      <footer className="site-footer">
        <Text type="supporting" color="secondary">
          {PRODUCT_NAME}
        </Text>
        <PolicyLinks />
      </footer>
    </div>
  );
}

// The policies are English only; the labels follow the page that links to them.
export function PolicyLinks({ label = "Policies", privacy = "Privacy Notice", terms = "Terms of Use" }) {
  return (
    <nav className="policy-links" aria-label={label}>
      <Link href="/privacy" hrefLang="en">
        {privacy}
      </Link>
      <Link href="/terms" hrefLang="en">
        {terms}
      </Link>
    </nav>
  );
}
