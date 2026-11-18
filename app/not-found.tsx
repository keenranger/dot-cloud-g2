import Link from "next/link";
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
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
        <VStack gap={5} hAlign="start">
          <Heading level={1} type="display-3">
            {t.notFound.title}
          </Heading>
          <Text as="p" type="large" color="secondary">
            {t.notFound.body}
          </Text>
          {/* Rendered through the app's LinkProvider, so it stays a client-side Next link. */}
          <Button href={localePath(locale)} variant="primary" label={t.notFound.home} />
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
