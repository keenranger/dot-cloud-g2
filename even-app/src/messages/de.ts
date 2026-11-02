import type { Messages } from "./en.ts";

/** German. */
export const de: Messages = {
  languageShown: "Die App wird auf Deutsch angezeigt.",

  idle(state, app) {
    if (!state.restored) return `${app} · Gespeicherte Verbindung wird geprüft.`;
    if (!state.connected)
      return `${app} · Verbinden Sie sich in der Telefon-App mit Serveradresse und Verbindungsschlüssel.`;
    if (!state.transcriber)
      return `${app} · Für Sprachfragen fügen Sie in der Telefon-App Ihren Soniox-Schlüssel hinzu. Sie können auch tippen und senden.`;
    return `${app} · Gedrückt halten, Frage stellen, dann loslassen.`;
  },
  edge(count, delta) {
    if (!count) return "Noch keine Antworten";
    return delta < 0 ? "Erste Antwort" : "Letzte Antwort";
  },
  splitMarkers: { continues: "\n(weiter)", continued: "(Fortsetzung)\n" },
  captionLive: "Live-Transkript (vorläufig)",
  captionFinishing: "Transkript wird abgeschlossen · vorläufig · noch nicht gesendet",
  wakeBlocked: {
    settings: "Hey dots · Einstellungen werden geladen",
    enabled: "Hey dots aus · Mikrofon aus",
    active: "Hey dots pausiert · App auf G2 öffnen",
    ready: "Hey dots · Warten auf G2",
    connected: "Hey dots · In der Telefon-App verbinden",
    transcriber: "Hey dots · Soniox-Schlüssel am Telefon eingeben",
    manual: "Hey dots pausiert · Manuelle Aufnahme",
    busy: "Hey dots pausiert · Anfrage wird abgeschlossen",
    draft: "Hey dots pausiert · Entwurf senden oder löschen",
  },
  g2Mic: {
    micOff: "Mikrofon aus",
    micTurningOff: "Mikrofon wird ausgeschaltet",
    micStopUnconfirmed: "Mikrofon evtl. noch an",
    wakeOffMicOff: "Hey dots aus · Mikrofon aus",
    wakeNoKeyMicOff: "Kein Soniox-Schlüssel · Mikrofon aus",
    wakePausedMicOff: "Hey dots pausiert · Mikrofon aus",
    wakePreparing: "Hey dots wird vorbereitet",
    wakeHeardNow: "Mikrofon an · Hey dots erkannt",
    wakeStopped: "Hey dots gestoppt",
    wakeMicStarting: "Mikrofon startet",
    manualMicStarting: "Mikrofon startet",
    micOffProcessing: "Mikrofon aus · wird verarbeitet",
    micOnWake: "Mikrofon an · wartet auf Hey dots",
    micOnRecording: "Mikrofon an · Aufnahme",
    recordingNoSound: "Mikrofon an · Aufnahme · noch kein Ton",
    wakeListeningNoSound: "Mikrofon an · Hey dots · noch kein Ton",
  },
  g2MicCore: { on: "Mikrofon an", off: "Mikrofon aus", unsure: "Mikrofon an?" },

  requestFailure(kind, submission) {
    const cause = {
      timeout:
        "Der Server hat nicht innerhalb von 45 Sekunden geantwortet, daher wurde die Anfrage abgebrochen. Prüfen Sie Ihr Netzwerk.",
      cancelled: "Die App wurde auf der Brille geschlossen oder gewechselt, daher wurde die Serveranfrage abgebrochen.",
      network: "Der Server ist nicht erreichbar. Prüfen Sie Ihre Netzwerkverbindung.",
    }[kind];
    return submission
      ? `${cause} Ob der Server die Nachricht gespeichert hat, ist nicht bekannt. Falls ja, wird die Antwort nicht abgebrochen und erscheint hier, sobald sie eintrifft.`
      : cause;
  },
  stt(error) {
    switch (error.kind) {
      case "credential":
        return "Dieser Soniox-Schlüssel kann nicht verwendet werden. Geben Sie Ihren Schlüssel in den Einstellungen erneut ein.";
      case "provider":
        return error.status === 401 || error.status === 403
          ? "Soniox hat den Schlüssel nicht akzeptiert. Prüfen Sie den Schlüssel in der Soniox Console oder ersetzen Sie ihn durch einen neuen."
          : `Soniox konnte dies nicht transkribieren${error.status === undefined ? "" : ` (Code ${error.status})`}. Bitte versuchen Sie es erneut.`;
      case "timeout":
        return "Soniox hat zu lange für die Antwort gebraucht. Bitte versuchen Sie es erneut.";
      case "connection":
        return "Soniox ist nicht erreichbar. Prüfen Sie Ihr Netzwerk und versuchen Sie es erneut.";
      case "invalid-audio":
        return "Die Aufnahme konnte nicht gelesen werden.";
      case "no-audio":
        return "Vom G2-Mikrofon kam kein Ton, daher wurde nichts transkribiert. Halten Sie erneut gedrückt und sprechen Sie.";
      case "protocol":
        return "Soniox hat eine unlesbare Antwort gesendet. Bitte versuchen Sie es erneut.";
      case "aborted":
        return "Die Transkription wurde abgebrochen.";
      case "overflow":
        return "Die Übertragung an Soniox kam der Aufnahme nicht hinterher und wurde gestoppt. Prüfen Sie Ihr Netzwerk und versuchen Sie es erneut.";
    }
  },
  thrown: {
    relayOrigin: "Geben Sie nur die HTTPS-Adresse des Servers ein, ohne etwas dahinter.",
    pairCode:
      "Fügen Sie den vollständigen 64-stelligen Verbindungsschlüssel (0-9, a-f) aus Ihrem Server-Dashboard ein.",
    emptyRecording: "Die Aufnahme ist leer oder konnte nicht gelesen werden.",
    invalidRecording: "Die Aufnahme konnte nicht gelesen werden.",
    noSpeech: "Es wurde keine Sprache erkannt. Bitte sagen Sie es noch einmal.",
    sonioxKey:
      "Das sieht nicht wie ein Soniox-Schlüssel aus. Fügen Sie den vollständigen Schlüssel aus der Soniox Console ein.",
  },

  page: {
    lede: "Fragen Sie Dot per Sprache und lesen Sie die Antworten auf Ihrer Brille.",
    "language-label": "Sprache · Language",
    "pair-legend": "Mit Ihrem Server verbinden",
    "origin-label": "Serveradresse (HTTPS)",
    "origin-hint": "Hängen Sie kein /mcp an. /mcp dient nur zum Verbinden von ChatGPT.",
    "dashboard-link-text": "Verbindungsschlüssel im Dashboard erstellen",
    "dashboard-link-note": "(öffnet sich im Browser)",
    "copy-dashboard": "Dashboard-Adresse kopieren",
    "dashboard-steps":
      "Melden Sie sich im Dashboard an, erstellen Sie einen Verbindungsschlüssel (oder lassen Sie Ihren Schlüssel anzeigen) und kopieren Sie ihn. Kommen Sie dann hierher zurück, fügen Sie ihn ein und tippen Sie auf Verbinden.",
    "dashboard-fallback":
      "Falls sich der Link nicht öffnet, kopieren Sie die Adresse unten und öffnen Sie sie im Browser Ihres Telefons. Um zurückzukehren, öffnen Sie diese Ansicht erneut in der Even-App.",
    "dashboard-address-label": "Dashboard-Adresse (zum Kopieren gedrückt halten)",
    "code-label": "Verbindungsschlüssel",
    "code-hint":
      "Fügen Sie den 64-stelligen Verbindungsschlüssel ein, den Sie in Ihrem Server-Dashboard erstellt haben.",
    "pair-submit": "Verbinden",
    disconnect: "Trennen und diese Verbindung vergessen",
    "soniox-legend": "Sprachtranskription (Ihr Soniox-Schlüssel)",
    "soniox-get-intro":
      "Für Sprachfragen benötigen Sie einen eigenen Soniox-API-Schlüssel. Registrieren oder melden Sie sich in der Soniox Console an, erstellen Sie einen API-Schlüssel und fügen Sie ihn unten ein.",
    "soniox-console-text": "Soniox-API-Schlüssel holen",
    "soniox-console-note": "(öffnet die Soniox Console im Browser)",
    "soniox-privacy":
      "Ihre Stimme geht direkt von diesem Telefon an Soniox und wird dort zu Text; nur dieser Text wird an Ihren Server gesendet. Ihr Schlüssel und Ihre Audiodaten erreichen den Server nie. Erstellen Sie zur Sicherheit in der Soniox Console einen eigenen Schlüssel nur für diese App.",
    "soniox-key-label": "Soniox-API-Schlüssel",
    "soniox-remember-text": "Schlüssel auf diesem Telefon merken",
    "soniox-remember-hint":
      "Ausgeschaltet bleibt der Schlüssel nur, bis Sie die App schließen. Eine Änderung bei gesetztem Schlüssel speichert oder entfernt ihn sofort. Der Schlüssel liegt im Speicher der Even-App, der möglicherweise nicht verschlüsselt ist.",
    "soniox-apply": "Diesen Schlüssel verwenden",
    "soniox-clear": "Schlüssel entfernen",
    voice: "Dot fragen",
    "voice-note":
      "Halten Sie auf der G2 gedrückt, sprechen Sie und lassen Sie dann los. Das Gesagte wird in Text umgewandelt und automatisch an Dot gesendet. Bis zu 30 Sekunden; erfordert einen Soniox-Schlüssel.",
    "auto-send-text": "Nach der Transkription automatisch senden (ausschalten, um vor dem Senden zu prüfen)",
    "wake-text":
      "Hey dots freihändig (standardmäßig an; nutzt das G2-Mikrofon, solange die App auf der G2 geöffnet ist)",
    "wake-hint":
      "Das G2-Mikrofon öffnet sich nur, wenn die G2 bereit ist, Sie verbunden sind und ein Soniox-Schlüssel gesetzt ist. Dieses Telefon erkennt das Aktivierungswort selbst, solange die App auf der G2 geöffnet ist, und hört weiter zu und prüft auf Antworten, auch wenn der Bildschirm ausgeht oder gesperrt wird; die Even-App und die Hintergrundbeschränkungen Ihres Telefons können das beeinflussen. Das Mikrofon des Telefons wird nicht verwendet. Sagen Sie Hey dots (englische Aussprache) und dann Ihre Frage: Nur die Frage danach wird von Soniox transkribiert und als Text an Ihren Server gesendet. Wenn es nicht reagiert, halten Sie stattdessen gedrückt und sprechen Sie. Ausschalten beendet das Zuhören sofort.",
    record: "Aufnahme starten",
    stop: "Stoppen und transkribieren",
    "text-label": "Nachricht (Sie können auch tippen statt sprechen)",
    send: "An Dot senden",
    "reply-title": "Antworten von Dot",
    "prev-message": "Vorherige Nachricht",
    "next-message": "Nächste Nachricht",
    prev: "Vorheriger Teil auf der G2",
    next: "Nächster Teil auf der G2",
    "help-title": "Hilfe und Feedback",
    "help-note":
      "Auf der GitHub-Seite des Projekts finden Sie die Anleitung und den Quellcode. Fragen und Funktionswünsche stellen Sie in GitHub Issues.",
    "guide-link-text": "Anleitung und Quellcode",
    "guide-link-note": "(öffnet GitHub im Browser)",
    "help-link-text": "Fragen und Funktionswünsche",
    "help-link-note": "(öffnet GitHub im Browser)",
  },
  placeholders: {
    status: "Verbindung zur Even-App wird geprüft",
    reply: "Warten auf eine Antwort.",
    display: "Noch nicht auf der G2 angezeigt",
  },

  afterConnecting: "Nach dem Verbinden gedrückt halten und sprechen.",
  micStopUnconfirmed:
    "Das Mikrofon ist möglicherweise noch an. Halten Sie gedrückt, um es erneut zu versuchen, oder schließen Sie die App in der Even-App.",
  settingsUnread:
    "Ihre gespeicherten Spracheinstellungen konnten nicht geladen werden, daher sind Hey dots und automatisches Senden aus. Schalten Sie sie bei Bedarf wieder ein.",
  micOff: "Mikrofon aus",
  draftPausesRecording:
    "Sie haben eine ungesendete Nachricht, daher ist die Aufnahme pausiert. Senden oder löschen Sie sie zuerst.",
  noSonioxKey:
    "Fügen Sie in den Einstellungen Ihren Soniox-Schlüssel hinzu, um per Sprache zu fragen. Sie können Ihre Nachricht auch tippen und senden.",
  keyRemovalUnconfirmed:
    "Der Schlüssel ist hier gelöscht, aber das Entfernen aus dem Speicher der Even-App wurde nicht bestätigt. Tippen Sie erneut auf Schlüssel entfernen.",
  keySessionOnlyOldMayRemain:
    "Der Schlüssel gilt nur für diese Sitzung. Ein früher gemerkter Schlüssel ist eventuell noch gespeichert, weil die Änderung im Speicher der Even-App nicht bestätigt wurde.",
  keyRemembered:
    "Soniox-Schlüssel gesetzt · auf diesem Telefon im Speicher der Even-App gemerkt, bis Sie ihn entfernen.",
  keySessionOnly: "Soniox-Schlüssel gesetzt · nur gespeichert, bis Sie die App schließen.",
  recordingNoSound: "Aufnahme läuft · noch kein Ton von der G2 · sprechen Sie weiter, es wird aufgenommen.",
  wakeListeningNoSound: "Hey dots hört zu · noch kein Ton von der G2 · bei Stille kann das normal sein.",
  micTurningOff: "Mikrofon wird ausgeschaltet",
  wakeOffMicOff: "Hey dots aus · Mikrofon aus",
  wakeNoKeyMicOff: "Hey dots nicht verfügbar · kein Soniox-Schlüssel · Mikrofon aus",
  wakePausedMicOff: "Hey dots pausiert · Mikrofon aus",
  wakePreparing: "Hey dots wird auf diesem Telefon vorbereitet",
  wakeHeardNow: "Hey dots erkannt · stellen Sie jetzt Ihre Frage.",
  wakeHeard: "Hey dots erkannt · stellen Sie Ihre Frage.",
  readyForQuestion: "Bereit für Ihre Frage. Sagen Sie Hey dots oder halten Sie gedrückt und sprechen Sie.",
  wakeStopped: "Hey dots hört nicht mehr zu. Halten Sie gedrückt und sprechen Sie, oder tippen Sie Ihre Nachricht.",
  micStartFailed: "Das G2-Mikrofon konnte nicht eingeschaltet werden.",
  wakeMicStarting: "G2-Mikrofon wird eingeschaltet · warten auf Ton",
  historyDeleted:
    "Ihr Gesprächsverlauf wurde gelöscht, daher sind seine Antworten auch von diesem Telefon entfernt. Was Sie gerade tippen, bleibt erhalten, und Sie können eine neue Frage stellen.",
  historyExpired: "Antworten, die älter als die Aufbewahrungsfrist sind, wurden auch von diesem Telefon entfernt.",
  ackPending: "endgültige Antwort folgt",
  ackLabel: "Zwischenantwort",
  finalLabel: "Endgültige Antwort",
  somethingWrong: "Etwas ist schiefgelaufen.",
  waitingEvenApp: "Warten auf die Even-App.",
  preparingG2: "Der G2-Bildschirm wird vorbereitet.",
  loadingSettings: "Ihre gespeicherten Spracheinstellungen werden geladen.",
  connectToRecord: "Verbinden Sie sich mit Ihrem Server, um aufzunehmen.",
  sonioxToRecord:
    "Fügen Sie einen Soniox-Schlüssel hinzu, um aufzunehmen. Sie können Ihre Nachricht weiterhin unten tippen und senden.",
  finishingPrevious: "Die vorherige Anfrage wird abgeschlossen.",
  messagePosition: (index, count, stage) => `Nachricht ${index} von ${count}${stage ? ` · ${stage}` : ""}`,
  noMessages: "Noch keine Nachrichten.",
  connectFirst: "Verbinden Sie sich zuerst mit Ihrem Server.",
  connectionExpired:
    "Diese Verbindung ist abgelaufen. Trennen Sie sie und verbinden Sie sich mit einem neuen Verbindungsschlüssel erneut.",
  questionRejected:
    "Der Server hat diese Frage nicht angenommen, weil das Gespräch gelöscht wurde oder seine Aufbewahrungsfrist abgelaufen ist. Sie wird nicht automatisch erneut gesendet; erneutes Senden schickt sie als neue Frage.",
  serverFailed: (status) => `Serveranfrage fehlgeschlagen (${status})`,
  g2NotConnected: "G2 noch nicht verbunden · Sie können hier auf dem Telefon lesen.",
  showingOnG2: "Wird auf der G2 angezeigt…",
  g2UpdateFailed: "G2 konnte nicht aktualisiert werden · lesen Sie die Antwort hier auf dem Telefon.",
  showingLiveCaption: "Live-Transkript (vorläufig) wird auf der G2 angezeigt",
  shownOnG2: "Auf der G2 angezeigt.",
  g2Unconfirmed: "Die Aktualisierung der G2 konnte nicht bestätigt werden.",
  replyPosition: (index, count) => `${index}/${count}`,
  voiceStopped: "Spracheingabe gestoppt · nichts wurde gesendet.",
  replyBackToReading:
    "Dot hat geantwortet · zurück zur Nachricht, die Sie gelesen haben. Gehen Sie zur nächsten Nachricht, um die neue Antwort zu sehen.",
  replyShowingLatest: "Dot hat geantwortet · die neueste Antwort wird auf der G2 angezeigt.",
  exitFailed: "Nicht beendet · doppeltippen",
  exitRequestFailed:
    "Die G2 konnte nicht zum Schließen der App aufgefordert werden. Tippen Sie erneut doppelt oder schließen Sie sie in der Even-App.",
  staleResponse: "Eine veraltete Serverantwort, älter als das bereits angezeigte Gespräch, wurde übersprungen.",
  unversionedResponse:
    "Eine Serverantwort ohne Gesprächsversion wurde übersprungen, da sie gelöschte Antworten enthalten könnte.",
  erasedReplyAfterVoice: (erased) =>
    `${erased} Die neue Antwort erscheint auf der G2, nachdem Ihre Spracheingabe gesendet wurde.`,
  replyAfterVoice: "Dot hat geantwortet · sie erscheint auf der G2, nachdem Ihre Spracheingabe gesendet wurde.",
  erasedShowingNew: (erased) => `${erased} Die neue Antwort wird angezeigt.`,
  ackReceived: "Zwischenantwort von Dot erhalten · endgültige Antwort folgt · wird auf der G2 angezeigt.",
  finalReceived:
    "Endgültige Antwort von Dot erhalten · wird auf der G2 angezeigt. Die Zwischenantwort bleibt in der vorherigen Nachricht.",
  replyShowing: "Dot hat geantwortet · wird auf der G2 angezeigt.",
  finishingTranscriptWaiting: "Ihr Transkript wird abgeschlossen · warten auf den endgültigen Text",
  finishingTranscript: "Ihr Transkript wird abgeschlossen · noch nicht gesendet",
  transcriptReady: "Transkript fertig · prüfen Sie es und senden Sie es dann.",
  transcriptAppended:
    "Transkript fertig · hinter Ihrem getippten Text eingefügt. Prüfen Sie es und senden Sie es dann.",
  transcriptReadyPhone: "Transkript fertig · prüfen Sie es auf dem Telefon und senden Sie es dann.",
  sendUnconfirmed: "Es konnte nicht bestätigt werden, ob die Nachricht gesendet wurde.",
  sendFailed: "Senden fehlgeschlagen.",
  transcriptKept: (reason) =>
    `${reason} Ihr Transkript bleibt im Nachrichtenfeld. Prüfen Sie es und senden Sie es erneut.`,
  manualMicStarting: "G2-Mikrofon wird eingeschaltet · warten auf Ihre Stimme",
  recordingLive:
    "Aufnahme läuft · Ihre Stimme wird beim Sprechen in Text umgewandelt · stoppen, um den endgültigen Text zu senden.",
  recordingHold: "Aufnahme läuft · loslassen zum Transkribieren und Senden.",
  micOffProcessing: "Mikrofon aus · Ihre Stimme wird verarbeitet",
  settingsSaveFailed:
    "Ihre Einstellungen konnten nicht gespeichert werden. Sie gelten jetzt, aber beim nächsten Start werden eventuell die vorherigen verwendet.",
  sending: "Wird an Ihren Server gesendet · noch nicht bestätigt",
  delivered: "Gespeichert und an Dot zugestellt · warten auf eine Antwort.",
  savedNotDelivered: "Auf Ihrem Server gespeichert · Dot hat noch nicht bestätigt oder geantwortet.",
  savedThenDeleted:
    "Ihr Server hat die Frage erhalten, aber das Gespräch wurde inzwischen gelöscht, daher ist diese Frage möglicherweise auch weg.",
  replyReady: "Eine Antwort ist bereit · wird geladen.",
  messageKept: (reason) => `${reason} Ihre Nachricht ist noch im Nachrichtenfeld.`,
  dashboardNeedsOrigin:
    "Um das Dashboard zu öffnen, geben Sie die HTTPS-Adresse Ihres Servers ohne etwas dahinter ein.",
  dashboardCopied: "Dashboard-Adresse kopiert. Öffnen Sie sie im Browser Ihres Telefons.",
  dashboardCopyFailed: "Kopieren fehlgeschlagen. Halten Sie die Dashboard-Adresse oben gedrückt, um sie zu kopieren.",
  languageSaveFailed:
    "Ihre Sprachwahl konnte nicht gespeichert werden. Sie gilt jetzt, aber beim nächsten Start wird eventuell eine andere Sprache angezeigt.",
  originInvalid: "Diese Serveradresse ist ungültig. Geben Sie eine Adresse ein, die mit https:// beginnt.",
  connecting: "Verbindung zu Ihrem Server wird hergestellt",
  connectTimeout:
    "Der Server hat nicht innerhalb von 15 Sekunden geantwortet. Prüfen Sie die Adresse und Ihr Netzwerk.",
  connectNetwork: "Der Server ist nicht erreichbar. Prüfen Sie die Adresse und Ihr Netzwerk.",
  keyRejected: (status) =>
    `Dieser Verbindungsschlüssel ist falsch oder abgelaufen (${status}). Holen Sie einen neuen Schlüssel und geben Sie ihn erneut ein.`,
  connectFailed: (status) =>
    `Verbindung zum Server fehlgeschlagen (${status}) · bitte versuchen Sie es gleich noch einmal.`,
  connectIncomplete: "Der Server hat die Verbindung nicht abgeschlossen.",
  connectSaveFailed:
    "Die Verbindung konnte nicht gespeichert werden. Verbinden Sie sich mit einem neuen Verbindungsschlüssel erneut.",
  connected: "Mit Ihrem Server verbunden · schließen Sie Verbindung und Abonnement auch in Dot ab.",
  connectFailedGeneric: "Verbindung fehlgeschlagen.",
  previousConnectionKept: (message) => `${message} Ihre bisherige Verbindung bleibt bestehen.`,
  keyFailed: "Dieser Schlüssel konnte nicht verwendet werden.",
  waitForEvenApp: "Warten Sie, bis die Even-App verbunden ist, und geben Sie dann Ihren Schlüssel ein.",
  keySaving: "Ihr Schlüssel wird gespeichert",
  keyUpdating: "Speicherort Ihres Schlüssels wird geändert",
  keyRemoving: "Ihr Schlüssel wird entfernt",
  disconnected: "Getrennt.",
  connectionForgotten:
    "Dieses Telefon hat die Verbindung vergessen. Entfernen Sie das Gerät auch auf Ihrem Server, um den Zugriff vollständig zu widerrufen.",
  forgetUnconfirmed:
    "Es konnte nicht bestätigt werden, dass die gespeicherte Verbindung entfernt wurde. Prüfen Sie die gespeicherten Daten der Even-App.",
  voiceStoppedAppSwitch:
    "Die Spracheingabe wurde gestoppt, weil Sie auf der G2 die App gewechselt haben. Sagen Sie Hey dots oder halten Sie gedrückt, um erneut zu sprechen.",
  pageHidden:
    "Die Seite wurde geschlossen oder ausgeblendet, daher wurden Zuhören, Aufnahme und Antwortprüfung gestoppt. Sie laufen weiter, sobald die Seite zurück ist.",
  pageBack: "Die Seite ist zurück · Zuhören und Antwortprüfung laufen weiter.",
  evenAppMissing: (app) => `Die Even-App wurde nicht gefunden. Öffnen Sie ${app} über die Even-App.`,
  g2StartFailed: "Der G2-Bildschirm konnte nicht gestartet werden. Öffnen Sie die App erneut über die Even-App.",
  micOnWake: "Mikrofon an · dieses Telefon wartet auf Hey dots · vorher wird nichts gesendet.",
  micOnRecording: "Mikrofon an · Aufnahme läuft",
  badAudioFrame: "Es kam Ton an, der nicht gelesen werden konnte.",
  abnormalExit:
    "Die App wurde auf der G2 unerwartet beendet, daher wurden Zuhören, Aufnahme und Antwortprüfung gestoppt. Öffnen Sie sie erneut über die Even-App.",
  systemExit:
    "Die App wurde auf der G2 geschlossen, daher wurden Zuhören, Aufnahme und Antwortprüfung gestoppt. Öffnen Sie sie auf der G2, um sie wieder zu nutzen.",
  foregroundExit:
    "Sie haben auf der G2 die App gewechselt, daher wurden Zuhören, Aufnahme und Antwortprüfung gestoppt. Sie laufen weiter, wenn Sie die App auf der G2 wieder öffnen.",
  foregroundBack: "Zurück auf der G2 · Zuhören und Antwortprüfung starten erneut.",
  keyLoadFailed:
    "Ihr gespeicherter Soniox-Schlüssel konnte nicht geladen werden. Geben Sie ihn erneut ein oder tippen Sie auf Schlüssel entfernen.",
  savedConnectionUnreadable:
    "Ihre gespeicherte Verbindung konnte nicht gelesen werden. Verbinden Sie sich mit einem neuen Verbindungsschlüssel.",
  usingSavedConnection: "Ihre gespeicherte Serververbindung wird verwendet.",
  g2ReadyEnterConnection: "G2 bereit · geben Sie Serveradresse und Verbindungsschlüssel ein.",
};
