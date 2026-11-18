import type { Copy } from "../dashboard";
import { PRODUCT_NAME } from "../product";

export const de: Copy = {
  dateLocale: "de-DE",
  languageName: "Deutsch",
  page: {
    home: `${PRODUCT_NAME} Startseite`,
    headerNote: "FÜR EVEN G2 × CHATGPT DOT",
    language: "Sprache",
    signOut: "Abmelden",
    eyebrow: "FRAGEN, OHNE ZUM HANDY ZU GREIFEN",
    titleLines: ["Frag über deine Brille.", "Lies Dots Antwort direkt dort."],
    intro: "Sprich über Even G2 mit deinem ChatGPT Dot und lies die Antwort auf deinen Gläsern.",
    needs:
      "Du brauchst deine G2, verbunden mit der Even Hub App auf deinem Handy, ChatGPT in einem Browser auf dem Computer für die einmalige Einrichtung und ein Soniox-Konto, wenn du per Sprache fragen möchtest.",
    flowLabel: "So funktioniert es",
    flow: ["Du sprichst auf der G2", "Dot antwortet", "Du liest es auf der G2"],
    signInEyebrow: "LOS GEHT'S",
    signInTitle: "Anmelden, um deine Brille einzurichten",
    signInBody:
      "Melde dich mit deinem ChatGPT-Konto an, um deine G2 zu koppeln und deinen Dot zu verbinden. Auf deinem Computer musst du nichts installieren.",
    signIn: "Mit ChatGPT anmelden",
    previewTitle: "Frühe Vorschau",
    previewBody:
      "Dots Antworten an deine Brille werden noch auf echten Geräten getestet, daher kommen manche Antworten möglicherweise noch nicht an.",
    footer: "Deine Brille und dein Dot, verbunden.",
    policies: "Richtlinien",
    privacy: "Datenschutzhinweis",
    terms: "Nutzungsbedingungen",
    apply: "Übernehmen",
    support: "Hilfe und Feedback",
    supportGuide: "Anleitung und Quellcode auf GitHub",
    supportIssues: "Fragen und Funktionswünsche auf GitHub Issues",
    newTab: "(öffnet in einem neuen Tab)",
    metaTitle: "ChatGPT Dot auf deiner G2-Brille",
    metaDescription: "Sprich über Even G2 mit deinem ChatGPT Dot und lies die Antworten auf deiner Brille.",
  },
  policy: {
    formerly: "früher Lens MCP for G2",
    effective: "Gültig ab",
    englishVersion: "Englische Fassung",
  },
  notFound: {
    title: "Seite nicht gefunden",
    body: "Diese Seite gibt es nicht oder sie wurde verschoben.",
    home: "Zur Startseite",
  },
  error: {
    title: "Etwas ist schiefgelaufen",
    body: "Diese Seite konnte nicht angezeigt werden. Versuche es erneut oder gehe zur Startseite. Wenn das Problem bleibt, melde es uns über GitHub Issues.",
    retry: "Erneut versuchen",
    home: "Zur Startseite",
  },
  dashboard: {
    eyebrow: "DEINE VERBINDUNG",
    title: "Deine Einrichtung",
    refresh: "Status aktualisieren",
    checking: "Wird geprüft…",
    statusLabel: "Verbindungsstatus",
    statusChecking: "Wird geprüft",
    statusUnavailable: "Nicht verfügbar",
    devices: "Gekoppelte Brillen",
    deviceCount: (n) => `${n}`,
    dot: "Dot",
    dotSubscribed: "Hört zu",
    dotWaiting: "Noch nicht verbunden",
    pending: "Fragen, die auf Dot warten",
    pendingCount: (n) => `${n}`,
    speech: "Spracheingabe",
    speechValue: "In der Handy-App prüfen",
    delivery: {
      accepted: "Dot hat sie erhalten",
      http_4xx: "Dot hat sie abgelehnt",
      http_5xx: "Dot hatte ein Problem",
      http_other: "Unerwartete Antwort",
      timeout: "Dot hat zu lange gebraucht",
      network: "Netzwerkproblem",
      invalid_response: "Unlesbare Antwort",
    },
    lastDelivery: (label, at, awaiting, retrying, stopped) =>
      `Letzte an Dot gesendete Frage: ${label}, ${at}. Warten auf Antwort: ${awaiting}. Neuer Versuch geplant: ${retrying}. Keine weiteren Versuche: ${stopped}. „Erhalten“ heißt, dass Dot die Frage bekommen hat – nicht, dass Dot geantwortet hat oder die Antwort auf deiner Brille ist.`,

    pairTitle: "Schritt 1: Brille koppeln",
    pairBody: `Öffne auf deinem Handy ${PRODUCT_NAME} in der Even Hub App und gib die Serveradresse und den Verbindungsschlüssel unten ein. Lass deine G2 mit dem Handy verbunden. Das ist unabhängig von deiner ChatGPT-Anmeldung.`,
    serverAddress: "Serveradresse",
    addressPending: "Adresse wird ermittelt…",
    keyHelp:
      "Dein Verbindungsschlüssel läuft nie ab und funktioniert für alle deine Brillen. Er bleibt verborgen, bis du „Schlüssel anzeigen“ wählst. Wenn du einen neuen Schlüssel erstellst oder diesen widerrufst, kann der alte Schlüssel keine neuen Brillen mehr koppeln; bereits gekoppelte Brillen funktionieren weiter.",
    keyLabel: "Verbindungsschlüssel",
    keyHidden: "Verborgen. Wähle „Schlüssel anzeigen“.",
    showKey: "Schlüssel anzeigen",
    hideKey: "Schlüssel verbergen",
    copy: "Kopieren",
    copyLabel: (label) => `${label} kopieren`,
    keyCreated: (at) => `Erstellt ${at} · läuft nie ab`,
    legacyCode: (expires) =>
      `Ein älterer 10-Minuten-Kopplungscode ist noch aktiv${expires ? ` (läuft ab ${expires})` : ""}. Er kann nicht erneut angezeigt werden, also erstelle einmalig einen Verbindungsschlüssel. Der neue Schlüssel läuft nie ab.`,
    keyUnavailable:
      "Wir konnten deinen Verbindungsschlüssel nicht prüfen. Wähle „Status aktualisieren“, um es erneut zu versuchen; sobald die Prüfung gelingt, kannst du einen Schlüssel erstellen.",
    createKey: "Verbindungsschlüssel erstellen",
    createNewKey: "Neuen Schlüssel erstellen",
    creatingKey: "Schlüssel wird erstellt…",
    revokeKey: "Schlüssel widerrufen",
    revokingKey: "Wird widerrufen…",
    confirmRotate:
      "Nachdem du einen neuen Schlüssel erstellt hast, kann der aktuelle Schlüssel keine neuen Brillen mehr koppeln. Bereits gekoppelte Brillen funktionieren weiter. Neuen Schlüssel erstellen?",
    confirmRevoke:
      "Nachdem du den Schlüssel widerrufen hast, können keine Brillen neu gekoppelt werden, bis du einen neuen erstellst. Bereits gekoppelte Brillen funktionieren weiter. Schlüssel widerrufen?",
    cancel: "Abbrechen",

    dotTitle: "Schritt 2: ChatGPT Dot verbinden",
    dotBody:
      "So hört dein Dot deine Fragen und antwortet auf deiner Brille. Für diesen Schritt brauchst du den Verbindungsschlüssel nicht.",
    dotSteps: [
      "Öffne ChatGPT auf einem Computer im Webbrowser, füge die Adresse unten als benutzerdefinierten Connector hinzu und installiere ihn. Überspringe das, wenn du ihn schon hinzugefügt hast.",
      "Sende deinem Dot die Einrichtungsnachricht unten. Danach kannst du mit demselben Dot in der ChatGPT-App auf dem Handy weitersprechen.",
    ],
    mcpAddress: "Connector-Adresse (MCP)",
    promptLabel: "Einrichtungsnachricht für Dot",
    copyPrompt: "Einrichtungsnachricht kopieren",
    dotPrompt: (connector) =>
      `Abonniere das Ereignis "utterance.created" vom Connector unter ${connector || "der /mcp-Adresse dieser Website"} mit der session "g2". Wenn eine neue Sprachfrage eintrifft, beantworte sie in der Sprache, in der sie gestellt wurde, und rufe dann reply_to_g2 mit derselben utterance_id, die du erhalten hast, und deiner Antwort als text auf. Rufe vor langsamer Arbeit wie Suchen oder Werkzeugnutzung zuerst acknowledge_g2_utterance mit derselben utterance_id und einer kurzen, eigenen Notiz dazu auf, was du tun wirst; sende keine formelhafte „Erhalten“-Meldung. Sag mir erst, dass du verbunden bist, wenn tatsächlich ein Ereignis angekommen ist.`,

    speechTitle: "Schritt 3: Sprachfragen einschalten",
    speechBody:
      "Um per Sprache zu fragen, füge in der Handy-App deinen eigenen Soniox-API-Schlüssel hinzu. Wenn du deine Fragen nur tippst, kannst du diesen Schritt überspringen. Gib den Schlüssel niemals auf dieser Website ein.",
    speechSteps: [
      "Erstelle in deinem Soniox-Konto einen API-Schlüssel, der Echtzeit-Transkription (real-time transcription) erlaubt.",
      `Öffne in der Even Hub App auf deinem Handy die Einstellungen von ${PRODUCT_NAME} und füge den Schlüssel ein.`,
      "Der Schlüssel wird nur aufbewahrt, solange die App geöffnet ist. Wähle „Merken“, um ihn auf deinem Handy zu behalten; du kannst ihn jederzeit in denselben Einstellungen löschen oder ersetzen.",
    ],
    sonioxGuide: "So legst du die Berechtigungen des Soniox-Schlüssels fest (öffnet in einem neuen Tab)",
    speechPrivacy:
      "Deine Stimme geht von deinem Handy direkt an Soniox, das sie in Text umwandelt; nur dieser Text erreicht diesen Dienst und deinen Dot. Soniox rechnet über dein eigenes Konto ab. Ein gemerkter Schlüssel ist nur so sicher wie dein Handy und die Even Hub App; er wird nicht zusätzlich verschlüsselt.",

    revokeAllBody:
      "Trenne alle Brillen in deinem Konto und widerrufe deinen Verbindungsschlüssel. Um sie wieder zu nutzen, kopple sie mit einem neuen Schlüssel.",
    revokeAll: "Alle Brillen trennen",
    revokingAll: "Wird getrennt…",
    deleteBody:
      "Lösche deinen Gesprächsverlauf (deine Fragen, Dots Antworten und Benachrichtigungen) jetzt aus diesem Dienst. Deine gekoppelten Brillen und die Dot-Verbindung bleiben, wie sie sind.",
    deleteConfirm:
      "Das kann nicht rückgängig gemacht werden. Was bereits an ChatGPT (Dot) oder Soniox gesendet oder schon auf deinem Handy angezeigt wurde, kann von hier aus nicht gelöscht werden. Verlauf löschen?",
    deleteForever: "Verlauf endgültig löschen",
    deleting: "Wird gelöscht…",
    deleteStart: "Gesprächsverlauf löschen",

    askTitle: "Schritt 4: Über die G2 fragen",
    askBody:
      "Nach Schritt 1 und 2 tippst du eine Frage in der Handy-App ein; nach Schritt 3 kannst du auch sprechen. Dots Antwort erscheint auf deiner Brille.",

    copied: "Kopiert.",
    copyUnavailable: "Automatisches Kopieren war nicht möglich. Markiere den Text und kopiere ihn selbst.",
    keyShown: "Verbindungsschlüssel angezeigt.",
    keyCreatedNotice:
      "Neuer Verbindungsschlüssel erstellt. Wähle „Schlüssel anzeigen“ und gib ihn in der Even Hub App ein. Der alte Schlüssel kann keine neuen Brillen mehr koppeln; bereits gekoppelte Brillen funktionieren weiter.",
    keyRevokedNotice:
      "Verbindungsschlüssel widerrufen. Bis du einen Schlüssel erstellst, können keine neuen Brillen gekoppelt werden; bereits gekoppelte Brillen funktionieren weiter.",
    sessionExpired: "Deine Anmeldung ist abgelaufen. Bitte melde dich erneut an.",
    rateLimited: "Zu viele Versuche. Bitte warte eine Minute und versuche es erneut.",
    keyServiceUnavailable:
      "Verbindungsschlüssel können gerade nicht erstellt oder angezeigt werden. Dein aktueller Schlüssel und deine gekoppelten Brillen funktionieren weiter.",
    keyNotRevealable:
      "Dieser Schlüssel kann nicht erneut angezeigt werden. Deine gekoppelten Brillen funktionieren weiter; erstelle einen neuen Schlüssel, wenn du einen brauchst.",
    keyFailed: {
      create: "Der Verbindungsschlüssel konnte nicht erstellt werden. Bitte versuche es gleich noch einmal.",
      reveal: "Der Verbindungsschlüssel konnte nicht angezeigt werden. Bitte versuche es gleich noch einmal.",
      withdraw: "Der Verbindungsschlüssel konnte nicht widerrufen werden. Bitte versuche es gleich noch einmal.",
    },
    keyUnconfirmed:
      "Wir konnten den neuen Schlüssel für das jetzt angemeldete Konto nicht bestätigen. Wähle „Status aktualisieren“, um deinen aktuellen Schlüssel zu sehen.",
    keyMismatch:
      "Dein Schlüssel hat sich geändert, seit diese Seite geladen wurde, daher wurde er nicht angezeigt. Wir haben erneut geprüft; wähle noch einmal „Schlüssel anzeigen“.",
    statusFailed: "Dein Verbindungsstatus konnte nicht geladen werden. Bitte versuche es erneut.",
    statusUnknown: "Dein Verbindungsstatus konnte nicht geprüft werden.",
    revokeAllFailed: "Deine Brillen konnten nicht getrennt werden. Bitte versuche es erneut.",
    revokedAll:
      "Alle deine Brillen sind getrennt und dein Verbindungsschlüssel ist widerrufen. Erstelle einen neuen Schlüssel, um erneut zu koppeln.",
    deleteFailed: "Dein Gesprächsverlauf konnte nicht gelöscht werden. Bitte versuche es gleich noch einmal.",
    deleted: (n) =>
      `${n} ${n === 1 ? "Eintrag" : "Einträge"} aus deinem Gesprächsverlauf gelöscht. Deine gekoppelten Brillen und die Dot-Verbindung sind unverändert.`,
  },
};
