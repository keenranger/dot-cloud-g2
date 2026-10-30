import type { Metadata } from "next";
import Link from "next/link";
import PolicyPage, { CONTACT_EMAIL, RELAY_ORIGIN } from "../components/policy-page";
import { PRODUCT_NAME } from "../i18n/dashboard";

export const metadata: Metadata = {
  title: `Terms of Use — ${PRODUCT_NAME}`,
  description: "What Lens MCP for G2 provides, what it needs from you and its limits.",
};

export default function Terms() {
  return (
    <PolicyPage title="Terms of Use">
      <p>
        These terms apply to the Lens MCP for G2 companion app and the relay website at{" "}
        <a href={RELAY_ORIGIN}>{RELAY_ORIGIN}</a>, published by <strong>keenranger</strong>. Please read them together
        with the <Link href="/privacy">Privacy Notice</Link>.
      </p>

      <section aria-labelledby="service">
        <h2 id="service">1. The service</h2>
        <p>
          Lens MCP for G2 connects your Even Realities G2 glasses to your own ChatGPT Dot through MCP: it passes what
          you say or type to your Dot and shows its replies on the glasses. It is not a general-purpose MCP client and
          does not promise to work with every MCP server or agent.
        </p>
      </section>

      <section aria-labelledby="needs">
        <h2 id="needs">2. What you need</h2>
        <ul>
          <li>G2 glasses and a phone with a compatible Even app (version 2.2.10 or later).</li>
          <li>Network access, and a ChatGPT account with a Dot connected to the relay.</li>
          <li>For voice input, your own Soniox account and API key.</li>
        </ul>
      </section>

      <section aria-labelledby="accounts">
        <h2 id="accounts">3. Your accounts, keys and charges</h2>
        <p>
          You control the accounts and keys you use with the service and must be entitled to use them. ChatGPT, Soniox
          and Even Realities services are provided under their own terms, and any charges from them, such as Soniox
          usage for transcription, are yours. The app includes no paid transcription credit and does not create provider
          accounts for you.
        </p>
        <p>
          Treat your connection key like a password. Anyone who has it can pair a new device to your account until you
          create a new key or withdraw it. You can disconnect all of your devices from the relay website.
        </p>
      </section>

      <section aria-labelledby="limits">
        <h2 id="limits">4. Limitations and safe use</h2>
        <ul>
          <li>Transcriptions can contain mistakes, and Dot replies can be wrong. Check them before relying on them.</li>
          <li>
            Do not use the service for emergencies or in place of professional medical, legal or financial advice.
          </li>
          <li>Look at or interact with your glasses only when it is safe to do so.</li>
          <li>
            Operation with a locked phone or in the background depends on the Even app and your phone’s operating system
            and is not guaranteed.
          </li>
          <li>This is an independent project. It may change, be interrupted or be discontinued.</li>
        </ul>
      </section>

      <section aria-labelledby="use">
        <h2 id="use">5. Acceptable use</h2>
        <p>
          Do not use the service to break the law, to access another person’s records or devices, or to disrupt the
          relay or the services it connects to.
        </p>
      </section>

      <section aria-labelledby="exit">
        <h2 id="exit">6. Stopping use</h2>
        <p>
          You can switch off “Hey dots”, stop a recording, clear your Soniox key, disconnect the companion, withdraw
          your connection key, disconnect all devices and erase your conversations at any time, as described in the{" "}
          <Link href="/privacy">Privacy Notice</Link>. Data held by other providers stays subject to their own controls.
        </p>
      </section>

      <section aria-labelledby="independence">
        <h2 id="independence">7. Independence</h2>
        <p>
          This project is not affiliated with or endorsed by Even Realities, OpenAI or Soniox. Their names are used only
          to describe compatibility with their products and services.
        </p>
      </section>

      <section aria-labelledby="contact">
        <h2 id="contact">8. Changes and contact</h2>
        <p>
          If these terms change, the updated version and its effective date will be posted on this page. Questions:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </section>
    </PolicyPage>
  );
}
