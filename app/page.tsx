import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Link as TextLink } from "@astryxdesign/core/Link";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser } from "./chatgpt-auth";
import Dashboard from "./components/dashboard";
import LanguageSwitch from "./components/language-switch";
import { PolicyLinks } from "./components/policy-page";
import SupportLinks from "./components/support-links";
import { PRODUCT_NAME, copy, localePath } from "./i18n/dashboard";
import { requestLocale } from "./i18n/request-locale";
import { langTag } from "@/lib/locale";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[]>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const t = copy[await requestLocale(searchParams)].page;
  return { title: `${PRODUCT_NAME} — ${t.metaTitle}`, description: t.metaDescription };
}

export default async function Home({ searchParams }: Props) {
  // An explicit ?lang= wins, then the saved choice, then the browser's languages, then English.
  const locale = await requestLocale(searchParams);
  const t = copy[locale].page;
  const user = await getChatGPTUser();
  return (
    <div className="shell" lang={langTag(locale)}>
      <header className="site-header">
        <Link className="brand" href={localePath(locale)} aria-label={t.home}>
          <span className="brand-mark" aria-hidden="true">
            g2
          </span>{" "}
          {PRODUCT_NAME}
        </Link>
        <Text type="label" color="secondary" className="header-note">
          {t.headerNote}
        </Text>
        <LanguageSwitch locale={locale} action="/" />
        {user && (
          // A plain anchor: the sign-out route leaves the app, so it must not go through client navigation.
          <TextLink as="a" href={chatGPTSignOutPath(localePath(locale))} target="_top" size="sm" hasUnderline>
            {t.signOut}
          </TextLink>
        )}
      </header>
      <main id="main">
        <section className="intro">
          <VStack gap={5}>
            <Text as="p" type="label" color="secondary" className="eyebrow">
              {t.eyebrow}
            </Text>
            <Heading level={1} type="display-1" className="hero-title">
              {t.titleLines[0]}
              <br />
              <span>{t.titleLines[1]}</span>
            </Heading>
            <Text as="p" type="large" color="secondary" className="intro-copy">
              {t.intro}
            </Text>
            <ol className="flow" aria-label={t.flowLabel}>
              {t.flow.map((step) => (
                <li key={step}>
                  <Badge variant="green" label={step} />
                </li>
              ))}
            </ol>
            <Text as="p" type="supporting" color="secondary" className="intro-needs">
              {t.needs}
            </Text>
          </VStack>
        </section>
        {user ? (
          <Dashboard displayName={user.displayName} locale={locale} />
        ) : (
          <Card role="region" aria-labelledby="signin-title" padding={8} elevation="low">
            <HStack gap={6} vAlign="center" hAlign="between" wrap="wrap">
              <VStack gap={2} className="signin-copy">
                <Text as="p" type="label" color="secondary" className="eyebrow">
                  {t.signInEyebrow}
                </Text>
                <Heading level={2} id="signin-title">
                  {t.signInTitle}
                </Heading>
                <Text as="p" color="secondary">
                  {t.signInBody}
                </Text>
              </VStack>
              <Button
                as="a"
                href={chatGPTSignInPath(localePath(locale))}
                target="_top"
                variant="primary"
                size="lg"
                label={t.signIn}
                endContent={<span aria-hidden="true">↗</span>}
              />
            </HStack>
          </Card>
        )}
        <aside className="verification-note" aria-labelledby="preview-title">
          <span aria-hidden="true">
            <StatusDot variant="warning" label={t.previewTitle} />
          </span>
          <Text as="p" type="supporting" color="secondary">
            <strong id="preview-title">{t.previewTitle}</strong> · {t.previewBody}
          </Text>
        </aside>
      </main>
      <footer className="site-footer">
        <Text type="supporting" color="secondary">
          {PRODUCT_NAME}
        </Text>
        <Text type="supporting" color="secondary">
          {t.footer}
        </Text>
        <PolicyLinks locale={locale} />
        <SupportLinks t={t} />
      </footer>
    </div>
  );
}
