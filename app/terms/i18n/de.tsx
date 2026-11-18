import Link from "next/link";
import { CONTACT_EMAIL, RELAY_ORIGIN } from "../../components/policy-page";
import { copy, policyPath } from "../../i18n/dashboard";

// German translation of the English Terms of Use in ../page.tsx; same sections, lists and facts.
const privacy = copy.de.page.privacy;

export const description = "Was Lens MCP for G2 bietet, was es von dir braucht und wo seine Grenzen liegen.";

export default function Body() {
  return (
    <>
      <p>
        Diese Bedingungen gelten für die Companion-App Lens MCP for G2 und die Relay-Website unter{" "}
        <a href={RELAY_ORIGIN}>{RELAY_ORIGIN}</a>, veröffentlicht von <strong>keenranger</strong>. Bitte lies sie
        zusammen mit dem <Link href={policyPath("privacy", "de")}>{privacy}</Link>.
      </p>

      <section aria-labelledby="service">
        <h2 id="service">1. Der Dienst</h2>
        <p>
          Lens MCP for G2 verbindet deine Brille Even Realities G2 über MCP mit deinem eigenen ChatGPT Dot: Es gibt
          weiter, was du sagst oder tippst, an deinen Dot und zeigt seine Antworten auf der Brille an. Es ist kein
          universeller MCP-Client und verspricht nicht, mit jedem MCP-Server oder Agenten zu funktionieren.
        </p>
      </section>

      <section aria-labelledby="needs">
        <h2 id="needs">2. Was du brauchst</h2>
        <ul>
          <li>Eine G2-Brille und ein Handy mit einer kompatiblen Even App (Version 2.2.10 oder neuer).</li>
          <li>Netzwerkzugang und ein ChatGPT-Konto mit einem Dot, der mit dem Relay verbunden ist.</li>
          <li>Für die Spracheingabe ein eigenes Soniox-Konto und einen eigenen API-Schlüssel.</li>
        </ul>
      </section>

      <section aria-labelledby="accounts">
        <h2 id="accounts">3. Deine Konten, Schlüssel und Kosten</h2>
        <p>
          Du verwaltest die Konten und Schlüssel, die du mit dem Dienst nutzt, und musst berechtigt sein, sie zu
          verwenden. Dienste von ChatGPT, Soniox und Even Realities werden nach ihren eigenen Bedingungen
          bereitgestellt, und alle Kosten dafür, etwa die Soniox-Nutzung für die Transkription, trägst du. Die App
          enthält kein bezahltes Transkriptionsguthaben und legt keine Anbieterkonten für dich an.
        </p>
        <p>
          Behandle deinen Verbindungsschlüssel wie ein Passwort. Wer ihn hat, kann ein neues Gerät mit deinem Konto
          koppeln, bis du einen neuen Schlüssel erstellst oder ihn widerrufst. Du kannst alle deine Geräte über die
          Relay-Website trennen.
        </p>
      </section>

      <section aria-labelledby="limits">
        <h2 id="limits">4. Einschränkungen und sichere Nutzung</h2>
        <ul>
          <li>
            Transkriptionen können Fehler enthalten, und Antworten von Dot können falsch sein. Prüfe sie, bevor du dich
            darauf verlässt.
          </li>
          <li>
            Nutze den Dienst nicht für Notfälle oder als Ersatz für professionelle medizinische, rechtliche oder
            finanzielle Beratung.
          </li>
          <li>Schau nur auf deine Brille oder bediene sie nur, wenn es sicher ist.</li>
          <li>
            Der Betrieb bei gesperrtem Handy oder im Hintergrund hängt von der Even App und dem Betriebssystem deines
            Handys ab und ist nicht garantiert.
          </li>
          <li>Dies ist ein unabhängiges Projekt. Es kann sich ändern, unterbrochen oder eingestellt werden.</li>
        </ul>
      </section>

      <section aria-labelledby="use">
        <h2 id="use">5. Zulässige Nutzung</h2>
        <p>
          Nutze den Dienst nicht, um gegen Gesetze zu verstoßen, auf Daten oder Geräte anderer Personen zuzugreifen oder
          das Relay oder die damit verbundenen Dienste zu stören.
        </p>
      </section>

      <section aria-labelledby="exit">
        <h2 id="exit">6. Nutzung beenden</h2>
        <p>
          Du kannst jederzeit „Hey dots“ ausschalten, eine Aufnahme stoppen, deinen Soniox-Schlüssel löschen, die
          Companion-App trennen, deinen Verbindungsschlüssel widerrufen, alle Geräte trennen und deine Gespräche
          löschen, wie im <Link href={policyPath("privacy", "de")}>{privacy}</Link> beschrieben. Daten bei anderen
          Anbietern unterliegen weiterhin deren eigenen Einstellungen.
        </p>
      </section>

      <section aria-labelledby="independence">
        <h2 id="independence">7. Unabhängigkeit</h2>
        <p>
          Dieses Projekt ist nicht mit Even Realities, OpenAI oder Soniox verbunden und wird nicht von ihnen
          unterstützt. Ihre Namen werden nur verwendet, um die Kompatibilität mit ihren Produkten und Diensten zu
          beschreiben.
        </p>
      </section>

      <section aria-labelledby="contact">
        <h2 id="contact">8. Änderungen und Kontakt</h2>
        <p>
          Wenn sich diese Bedingungen ändern, werden die aktualisierte Fassung und ihr Gültigkeitsdatum auf dieser Seite
          veröffentlicht. Fragen: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </section>
    </>
  );
}
