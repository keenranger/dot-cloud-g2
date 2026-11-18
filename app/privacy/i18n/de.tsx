import Link from "next/link";
import { CONTACT_EMAIL, RELAY_ORIGIN } from "../../components/policy-page";
import { copy, policyPath } from "../../i18n/dashboard";

// German translation of the English Privacy Notice in ../page.tsx; same sections, lists and facts.
const d = copy.de.dashboard;
// The companion's disconnect button (even-app/src/messages/de.ts).
const companionDisconnect = "Trennen und diese Verbindung vergessen";

export const description =
  "Was Lens MCP for G2 verarbeitet, wohin es geht, wie lange das Relay es aufbewahrt und wie du es löschen kannst.";

export default function Body() {
  return (
    <>
      <section aria-labelledby="who">
        <h2 id="who">Wer wir sind</h2>
        <p>
          Lens MCP for G2 ist ein unabhängiges Projekt, veröffentlicht von <strong>keenranger</strong>. Es besteht aus
          einer Companion-App für die Brille Even Realities G2, die über Even Hub verteilt wird, und einer Relay-Website
          unter <a href={RELAY_ORIGIN}>{RELAY_ORIGIN}</a>. Zusammen verbinden sie deine G2 mit deinem eigenen ChatGPT
          Dot. Es ist kein offizielles Produkt von Even Realities, OpenAI oder Soniox.
        </p>
        <p>
          Fragen und Datenschutzanfragen: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </section>

      <section aria-labelledby="audio">
        <h2 id="audio">Mikrofon-Audio</h2>
        <ul>
          <li>Die Companion-App nutzt nur das Mikrofon der G2. Eine manuelle Aufnahme dauert höchstens 30 Sekunden.</li>
          <li>
            Das Zuhören auf „Hey dots“ ist standardmäßig eingeschaltet, sobald die Companion-App gekoppelt ist und einen
            Sprachschlüssel hat. Du kannst es in der Companion-App ausschalten; deine Wahl wird auf dem Handy
            gespeichert. Solange es eingeschaltet ist und die Companion-App läuft, bleibt das G2-Mikrofon geöffnet,
            damit das Signalwort erkannt werden kann.
          </li>
          <li>
            Die Erkennung des Signalworts läuft auf deinem Handy. Audio, das vor dem Signalwort gehört wird, wird nur in
            kurzen, begrenzten Puffern auf dem Handy gehalten und nirgendwohin gesendet.
          </li>
          <li>
            Sprache nach dem Signalwort oder eine manuelle Aufnahme wird von deinem Handy direkt an Soniox gestreamt und
            dort mit deinem eigenen Soniox-API-Schlüssel transkribiert. Soniox verarbeitet dieses Audio im Rahmen deiner
            Vereinbarung mit Soniox.
          </li>
          <li>
            Unser Relay empfängt niemals Roh-Audio. Sein serverseitiger Transkriptionsendpunkt ist deaktiviert und lehnt
            Anfragen ab, bevor er Audio liest.
          </li>
        </ul>
      </section>

      <section aria-labelledby="soniox-key">
        <h2 id="soniox-key">Dein Soniox-API-Schlüssel</h2>
        <p>
          Du gibst deinen eigenen Soniox-Schlüssel auf deinem Handy ein. Standardmäßig wird er nur für die aktuelle
          App-Sitzung im Arbeitsspeicher gehalten. Wenn du ihn merken lässt, wird er im Speicher der Even Hub App auf
          diesem Handy gesichert. Du kannst ihn jederzeit löschen oder ersetzen. Der Schlüssel wird nur an Soniox
          gesendet, niemals an unser Relay. Die Companion-App verschlüsselt einen gemerkten Schlüssel nicht zusätzlich;
          er ist so sicher wie dein Handy und die Even App.
        </p>
      </section>

      <section aria-labelledby="text">
        <h2 id="text">Nachrichten, Transkripte und Antworten</h2>
        <p>
          Getippte Nachrichten, endgültige Transkripte, Antworten von Dot und Nachrichten, die dein Dot von sich aus
          sendet, werden auf dem Relay gespeichert, damit sie zwischen deiner G2 und ChatGPT zugestellt werden können.
          Dazu speichert das Relay deine Kontokennung, Nachrichten- und Gerätekennungen, Zeitstempel und den
          Zustellstatus. Nachrichten, die dein Dot von sich aus sendet, werden an jedes mit deinem Konto gekoppelte
          Gerät zugestellt. Diese Nachrichten können alle personenbezogenen Daten enthalten, die du sagst oder tippst.
        </p>
        <p>
          Die Companion-App hält bis zu 100 aktuelle Antworten im Arbeitsspeicher des Handys und merkt sich deine
          Einstellungen für „Hey dots“ und das automatische Senden per Sprache im Speicher der Even Hub App.
        </p>
      </section>

      <section aria-labelledby="account">
        <h2 id="account">Anmeldung, Verbindungsschlüssel und Geräte</h2>
        <ul>
          <li>
            Du meldest dich auf der Relay-Website mit ChatGPT an. Die Hosting-Plattform gibt dem Relay eine Kennung für
            dein Konto, die deine Daten von denen anderer Nutzer trennt. Deine ChatGPT-Sitzung wird nicht in die
            Companion-App kopiert.
          </li>
          <li>
            Jedes Konto hat höchstens einen Verbindungsschlüssel. Er läuft nicht ab und kann mehr als ein Gerät koppeln.
            Das Relay speichert einen SHA-256-Hash des Schlüssels, um ihn nachzuschlagen, und den Schlüssel selbst mit
            AES-256-GCM unter einem Servergeheimnis verschlüsselt, damit du ihn angemeldet später erneut sehen kannst.
            Diese Verschlüsselung schützt davor, dass nur die Datenbank offengelegt wird, nicht vor einer
            Kompromittierung des Servers oder seines Geheimnisses.
          </li>
          <li>
            Das Dashboard zeigt den Schlüssel standardmäßig maskiert. Er erscheint erst, nachdem du „{d.showKey}“
            wählst, kann nur kopiert werden, solange er angezeigt wird, und wird nur im Arbeitsspeicher der Seite
            gehalten, niemals im Browserspeicher.
          </li>
          <li>
            Ein neuer Schlüssel („{d.createNewKey}“) ersetzt den alten sofort; das Widerrufen („{d.revokeKey}“) entfernt
            ihn. Bereits gekoppelte Geräte bleiben in beiden Fällen gekoppelt. „{d.revokeAll}“ entfernt den Schlüssel
            und trennt alle deine Geräte.
          </li>
          <li>
            Geräte, die vor der Einführung der Verbindungsschlüssel gekoppelt wurden, bleiben gekoppelt. Die kurzlebigen
            Kopplungscodes von damals konnten nicht erneut angezeigt werden und sind inzwischen abgelaufen.
          </li>
          <li>
            Beim Koppeln eines Geräts werden ein Geräteeintrag und ein Geräte-Token erstellt. Das Relay speichert das
            Token nur als Hash. Die Companion-App speichert das Token und die Relay-Adresse im Speicher der Even Hub App
            auf dem Handy.
          </li>
          <li>
            Wenn dein Dot Ereignisse abonniert, speichert das Relay das Abonnement, seine Callback-Adresse und sein
            Signaturgeheimnis. Ein Abonnement gilt standardmäßig eine Stunde (zwischen einer Minute und einem Tag) und
            kann gekündigt werden.
          </li>
          <li>Das Relay führt kurzlebige Anfragezähler, um Missbrauch zu begrenzen.</li>
        </ul>
      </section>

      <section aria-labelledby="recipients">
        <h2 id="recipients">Wohin Informationen gehen</h2>
        <ul>
          <li>
            <strong>Unser Relay</strong>, gehostet auf der von diesem Projekt genutzten Sites-Plattform: Text, Kennungen
            und die oben beschriebenen Verbindungsdaten. Niemals Audio oder dein Soniox-Schlüssel.
          </li>
          <li>
            <strong>Soniox</strong> (<code>stt-rt.soniox.com</code>): Audio, das du zur Transkription übermittelst, und
            dein Schlüssel.
          </li>
          <li>
            <strong>ChatGPT (dein Dot)</strong> und der von ihm registrierte MCP-Callback: deine Nachrichten und
            Transkripte sowie die Antworten, die er zurückgibt.
          </li>
          <li>
            <strong>Even Realities</strong> App und das Betriebssystem deines Handys: Sie hosten die Companion-App,
            verbinden Mikrofon und Anzeige der Brille und halten den Speicher der Even Hub App.
          </li>
        </ul>
        <p>
          Jeder Anbieter verarbeitet Daten nach seinen eigenen Bedingungen und Richtlinien. Die Companion-App und der
          Relay-Code dieses Projekts enthalten keine Analyse- oder Werbewerkzeuge. Wir haben nicht geprüft, wo Anbieter
          Daten, ihre Protokolle oder ihre Sicherungen speichern.
        </p>
      </section>

      <section aria-labelledby="retention">
        <h2 id="retention">Wie lange das Relay Gespräche aufbewahrt</h2>
        <ul>
          <li>
            <strong>30-Tage-Grenze.</strong> 30 Tage nachdem eine Nachricht, ein Transkript oder eine Antwort erstellt
            wurde (UTC), zeigt, liefert, wiederholt oder beantwortet das Relay sie nicht mehr, unabhängig davon, ob sie
            bereits physisch gelöscht wurde.
          </li>
          <li>
            <strong>Jetzt löschen.</strong> Angemeldet auf der Relay-Website kannst du alle deine Gespräche auf einmal
            mit „{d.deleteForever}“ löschen. Der Inhalt wird sofort gelöscht. Das Relay behält für jeden gelöschten
            Eintrag nur eine kurze, inhaltsfreie Markierung, damit ein verspäteter Wiederholungsversuch ihn nicht erneut
            speichern kann, und die Companion-App leert ihren angezeigten Verlauf, wenn sie das nächste Mal nach
            Antworten sucht. Deine Geräte, dein Verbindungsschlüssel und das Dot-Abonnement sind nicht betroffen.
          </li>
          <li>
            <strong>Physische Löschung.</strong> Eine tägliche Bereinigung ist für 03:00 Uhr koreanischer Zeit
            (Asia/Seoul) geplant. Jeder Lauf löscht dauerhaft bis zu 20.000 Datensätze, die die 30-Tage-Grenze
            überschritten haben; alles darüber hinaus wartet auf einen späteren Lauf. Die Löschung kann daher bis zu
            etwa einen Tag nach der Grenze erfolgen, und später, wenn ein Lauf fehlschlägt oder sich ein Rückstand
            aufbaut. Die geplante Bereinigung wurde noch nicht dabei beobachtet, wie sie von selbst läuft; daher
            versprechen wir keine Löschung an einem bestimmten Tag. Manche abgelaufenen Datensätze können auch früher
            gelöscht werden, wenn neue Nachrichten übermittelt werden.
          </li>
          <li>
            Inhaltsfreie Markierungen, die nach einer Löschung oder Bereinigung bleiben, werden 30 Tage aufbewahrt und
            dann von derselben Bereinigung entfernt.
          </li>
          <li>
            Der Verbindungsschlüssel wird aufbewahrt, bis du ihn ersetzt oder widerrufst oder alle Geräte trennst.
            Abgelaufene Codes, Abonnements und Anfragezähler funktionieren nach Ablauf nicht mehr, werden aber nicht
            planmäßig gelöscht.
          </li>
        </ul>
        <p>
          Das Trennen aller Geräte entzieht ihnen den Zugriff, löscht aber keine Gespräche; nutze dafür „
          {d.deleteForever}“. „{companionDisconnect}“ in der Companion-App löscht nur das auf diesem Handy gespeicherte
          Token.
        </p>
        <p>
          Das Relay kann nicht löschen, was bereits an ChatGPT oder Soniox gesendet oder bereits auf deinem Handy oder
          deiner Brille angezeigt wurde. Kopien bei Anbietern sowie Hosting- und Anbieterprotokolle und -sicherungen
          fallen nicht unter diese Zusagen.
        </p>
      </section>

      <section aria-labelledby="background">
        <h2 id="background">Gesperrtes Handy und Nutzung im Hintergrund</h2>
        <p>
          Solange die Brillensitzung aktiv bleibt, ist die Companion-App darauf ausgelegt, weiter auf „Hey dots“ zu
          hören, aufzunehmen und Antworten anzuzeigen, auch wenn das Handy gesperrt ist oder die Even App im Hintergrund
          läuft. Ob sie dann weiterläuft, hängt von der Even App und dem Betriebssystem deines Handys ab. Das Schließen
          oder Trennen der Companion-App oder das Ausschalten von „Hey dots“ beendet das Zuhören.
        </p>
      </section>

      <section aria-labelledby="security">
        <h2 id="security">Sicherheit</h2>
        <p>
          Die Companion-App kommuniziert mit dem Relay und Soniox nur über HTTPS und sichere WebSockets. Der
          Gerätezugriff nutzt gerätebezogene Tokens; Kontoaktionen erfordern deine ChatGPT-Anmeldung und sind auf deine
          eigenen Daten beschränkt; Schlüssel- und Kopplungsanfragen sind in ihrer Häufigkeit begrenzt. Kein System ist
          vollkommen sicher, und wir können nicht garantieren, dass diese Maßnahmen jeden Missbrauch verhindern.
        </p>
      </section>

      <section aria-labelledby="changes">
        <h2 id="changes">Änderungen und Kontakt</h2>
        <p>
          Wenn sich dieser Hinweis ändert, werden die aktualisierte Fassung und ihr Gültigkeitsdatum auf dieser Seite
          veröffentlicht. Bei Fragen oder Anliegen zu deinen Daten schreibe an{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Siehe auch die{" "}
          <Link href={policyPath("terms", "de")}>{copy.de.page.terms}</Link>.
        </p>
      </section>
    </>
  );
}
