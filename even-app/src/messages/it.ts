import type { Messages } from "./en.ts";

/** Italian. */
export const it: Messages = {
  languageShown: "L'app viene mostrata in italiano.",

  idle(state, app) {
    if (!state.restored) return `${app} · Verifica della connessione salvata.`;
    if (!state.connected)
      return `${app} · Connettiti nell'app del telefono con l'indirizzo del server e la chiave di connessione.`;
    if (!state.transcriber)
      return `${app} · Per fare domande a voce, aggiungi la tua chiave Soniox nell'app del telefono. Puoi anche scrivere e inviare.`;
    return `${app} · Tieni premuto, fai la tua domanda, poi rilascia.`;
  },
  edge(count, delta) {
    if (!count) return "Nessuna risposta";
    return delta < 0 ? "Prima risposta" : "Ultima risposta";
  },
  splitMarkers: { continues: "\n(continua)", continued: "(seguito)\n" },
  captionLive: "Trascrizione in diretta (provvisoria)",
  captionFinishing: "Trascrizione in chiusura · provvisoria · non ancora inviata",
  wakeBlocked: {
    settings: "Hey dots · Caricamento impostazioni",
    enabled: "Hey dots disattivato · Microfono spento",
    active: "Hey dots in pausa · Apri l'app su G2",
    ready: "Hey dots · In attesa di G2",
    connected: "Hey dots · Connettiti nell'app",
    transcriber: "Hey dots · Aggiungi la chiave Soniox",
    manual: "Hey dots in pausa · Registrazione manuale",
    busy: "Hey dots in pausa · Richiesta in corso",
    draft: "Hey dots in pausa · Invia o cancella la bozza",
  },
  g2Mic: {
    micOff: "Microfono spento",
    micTurningOff: "Spegnimento del microfono",
    micStopUnconfirmed: "Microfono forse ancora acceso",
    wakeOffMicOff: "Hey dots disattivato · Microfono spento",
    wakeNoKeyMicOff: "Nessuna chiave Soniox · Microfono spento",
    wakePausedMicOff: "Hey dots in pausa · Microfono spento",
    wakePreparing: "Preparazione di Hey dots",
    wakeHeardNow: "Microfono acceso · Hey dots rilevato",
    wakeStopped: "Hey dots interrotto",
    wakeMicStarting: "Accensione microfono",
    manualMicStarting: "Accensione microfono",
    micOffProcessing: "Microfono spento · elaborazione",
    micOnWake: "Microfono acceso · attende Hey dots",
    micOnRecording: "Microfono acceso · registrazione",
    recordingNoSound: "Microfono acceso · registra · nessun suono",
    wakeListeningNoSound: "Microfono acceso · Hey dots · nessun suono",
  },
  g2MicCore: { on: "Microfono acceso", off: "Microfono spento", unsure: "Microfono acceso?" },

  requestFailure(kind, submission) {
    const cause = {
      timeout: "Il server non ha risposto entro 45 secondi, quindi la richiesta è stata annullata. Controlla la rete.",
      cancelled: "L'app è stata chiusa o cambiata sugli occhiali, quindi la richiesta al server è stata annullata.",
      network: "Impossibile raggiungere il server. Controlla la connessione di rete.",
    }[kind];
    return submission
      ? `${cause} Non si sa se il server l'abbia salvata. Se è stata salvata, la risposta non viene annullata e comparirà qui quando arriva.`
      : cause;
  },
  stt(error) {
    switch (error.kind) {
      case "credential":
        return "Questa chiave Soniox non può essere usata. Inserisci di nuovo la chiave nelle impostazioni.";
      case "provider":
        return error.status === 401 || error.status === 403
          ? "Soniox non ha accettato la chiave. Controllala nella Soniox Console o sostituiscila con una nuova."
          : `Soniox non è riuscito a trascrivere${error.status === undefined ? "" : ` (codice ${error.status})`}. Riprova.`;
      case "timeout":
        return "Soniox ha impiegato troppo a rispondere. Riprova.";
      case "connection":
        return "Impossibile raggiungere Soniox. Controlla la rete e riprova.";
      case "invalid-audio":
        return "Impossibile leggere la registrazione.";
      case "no-audio":
        return "Dal microfono di G2 non è arrivato alcun suono, quindi non è stato trascritto nulla. Tieni premuto per parlare di nuovo.";
      case "protocol":
        return "Soniox ha inviato una risposta illeggibile. Riprova.";
      case "aborted":
        return "La trascrizione è stata annullata.";
      case "overflow":
        return "L'invio a Soniox è rimasto indietro rispetto alla registrazione e si è interrotto. Controlla la rete e riprova.";
    }
  },
  thrown: {
    relayOrigin: "Inserisci solo l'indirizzo HTTPS del server, senza nient'altro dopo.",
    pairCode:
      "Incolla l'intera chiave di connessione di 64 caratteri (0-9, a-f) mostrata nella dashboard del tuo server.",
    emptyRecording: "La registrazione è vuota o non può essere letta.",
    invalidRecording: "Impossibile leggere la registrazione.",
    noSpeech: "Nessuna voce riconosciuta. Ripeti, per favore.",
    sonioxKey: "Non sembra una chiave Soniox. Incolla l'intera chiave copiata dalla Soniox Console.",
  },

  page: {
    lede: "Fai domande a Dot con la voce e leggi le risposte sui tuoi occhiali.",
    "language-label": "Lingua · Language",
    "pair-legend": "Connettiti al tuo server",
    "origin-label": "Indirizzo del server (HTTPS)",
    "origin-hint": "Non aggiungere /mcp alla fine. /mcp serve solo per connettere ChatGPT.",
    "dashboard-link-text": "Ottieni una chiave di connessione dalla dashboard",
    "dashboard-link-note": "(si apre nel browser)",
    "copy-dashboard": "Copia l'indirizzo della dashboard",
    "dashboard-steps":
      "Nella dashboard, accedi, crea una chiave di connessione (o visualizza la tua chiave) e copiala. Poi torna qui, incollala e tocca Connetti.",
    "dashboard-fallback":
      "Se il link non si apre, copia l'indirizzo qui sotto e aprilo nel browser del telefono. Per tornare, riapri questa schermata dall'app Even.",
    "dashboard-address-label": "Indirizzo della dashboard (tieni premuto per copiarlo)",
    "code-label": "Chiave di connessione",
    "code-hint": "Incolla la chiave di connessione di 64 caratteri che hai creato nella dashboard del server.",
    "pair-submit": "Connetti",
    disconnect: "Disconnetti e dimentica questa connessione",
    "soniox-legend": "Trascrizione vocale (la tua chiave Soniox)",
    "soniox-get-intro":
      "Per fare domande a voce ti serve una tua chiave API Soniox. Registrati o accedi alla Soniox Console, crea una chiave API e incollala qui sotto.",
    "soniox-console-text": "Ottieni una chiave API Soniox",
    "soniox-console-note": "(apre la Soniox Console nel browser)",
    "soniox-privacy":
      "La tua voce va direttamente da questo telefono a Soniox per diventare testo, e solo quel testo viene inviato al tuo server. La chiave e l'audio non raggiungono mai il server. Per sicurezza, crea nella Soniox Console una chiave separata solo per questa app.",
    "soniox-key-label": "Chiave API Soniox",
    "soniox-remember-text": "Ricorda la chiave su questo telefono",
    "soniox-remember-hint":
      "Se disattivato, la chiave resta solo finché non chiudi l'app. Cambiarlo con una chiave impostata la salva o la rimuove subito. La chiave è conservata nello spazio di archiviazione dell'app Even, che potrebbe non essere cifrato.",
    "soniox-apply": "Usa questa chiave",
    "soniox-clear": "Rimuovi chiave",
    voice: "Chiedi a Dot",
    "voice-note":
      "Su G2, tieni premuto, parla e poi rilascia. Ciò che dici viene trasformato in testo e inviato automaticamente a Dot. Fino a 30 secondi; serve una chiave Soniox.",
    "auto-send-text": "Invia automaticamente dopo la trascrizione (disattiva per controllare prima di inviare)",
    "wake-text":
      "Hey dots a mani libere (attivo per impostazione predefinita; usa il microfono di G2 mentre l'app è aperta su G2)",
    "wake-hint":
      "Il microfono di G2 si apre solo quando G2 è pronto, sei connesso e una chiave Soniox è impostata. Questo telefono rileva da solo la parola di attivazione mentre l'app è aperta su G2, e continua ad ascoltare e a controllare le risposte anche se lo schermo si spegne o si blocca; l'app Even e i limiti in background del telefono possono influire. Il microfono del telefono non viene usato. Di' Hey dots (pronuncia inglese), poi la tua domanda: solo la domanda che segue viene trascritta da Soniox e inviata al server come testo. Se non risponde, tieni premuto per parlare. Disattivandolo, l'ascolto si interrompe subito.",
    record: "Avvia registrazione",
    stop: "Interrompi e trascrivi",
    "text-label": "Messaggio (puoi scrivere invece di parlare)",
    send: "Invia a Dot",
    "reply-title": "Risposte di Dot",
    "prev-message": "Messaggio precedente",
    "next-message": "Messaggio successivo",
    prev: "Parte precedente su G2",
    next: "Parte successiva su G2",
    "help-title": "Aiuto e feedback",
    "help-note":
      "La pagina GitHub del progetto contiene la guida all'uso e il codice sorgente. Fai domande o chiedi nuove funzioni in GitHub Issues.",
    "guide-link-text": "Guida all'uso e codice sorgente",
    "guide-link-note": "(apre GitHub nel browser)",
    "help-link-text": "Domande e richieste di funzioni",
    "help-link-note": "(apre GitHub nel browser)",
  },
  placeholders: {
    status: "Verifica della connessione all'app Even",
    reply: "In attesa di una risposta.",
    display: "Non ancora mostrato su G2",
  },

  afterConnecting: "Dopo la connessione, tieni premuto e parla.",
  micStopUnconfirmed:
    "Il microfono potrebbe essere ancora acceso. Tieni premuto per riprovare, o chiudi l'app dall'app Even.",
  settingsUnread:
    "Impossibile caricare le impostazioni vocali salvate, quindi Hey dots e l'invio automatico sono disattivati. Riattivali se vuoi.",
  micOff: "Microfono spento",
  draftPausesRecording: "Hai un messaggio non inviato, quindi la registrazione è in pausa. Prima invialo o cancellalo.",
  noSonioxKey:
    "Aggiungi la tua chiave Soniox nelle impostazioni per fare domande a voce. Puoi anche scrivere il messaggio e inviarlo.",
  keyRemovalUnconfirmed:
    "La chiave è stata cancellata qui, ma la rimozione dallo spazio di archiviazione dell'app Even non è stata confermata. Tocca di nuovo Rimuovi chiave.",
  keySessionOnlyOldMayRemain:
    "La chiave vale solo per questa sessione. Una chiave ricordata in precedenza potrebbe essere ancora salvata, perché la modifica nello spazio di archiviazione dell'app Even non è stata confermata.",
  keyRemembered:
    "Chiave Soniox impostata · salvata su questo telefono nello spazio di archiviazione dell'app Even finché non la rimuovi.",
  keySessionOnly: "Chiave Soniox impostata · conservata solo finché non chiudi l'app.",
  recordingNoSound: "Registrazione in corso · ancora nessun suono da G2 · continua a parlare e verrà acquisito.",
  wakeListeningNoSound: "Hey dots in ascolto · ancora nessun suono da G2 · può essere normale se c'è silenzio.",
  micTurningOff: "Spegnimento del microfono",
  wakeOffMicOff: "Hey dots disattivato · microfono spento",
  wakeNoKeyMicOff: "Hey dots non disponibile · nessuna chiave Soniox · microfono spento",
  wakePausedMicOff: "Hey dots in pausa · microfono spento",
  wakePreparing: "Preparazione di Hey dots su questo telefono",
  wakeHeardNow: "Hey dots rilevato · fai ora la tua domanda.",
  wakeHeard: "Hey dots rilevato · fai la tua domanda.",
  readyForQuestion: "Pronto per la tua domanda. Di' Hey dots o tieni premuto per parlare.",
  wakeStopped: "Hey dots ha smesso di ascoltare. Tieni premuto per parlare o scrivi il messaggio.",
  micStartFailed: "Impossibile accendere il microfono di G2.",
  wakeMicStarting: "Accensione del microfono di G2 · in attesa di suono",
  historyDeleted:
    "La cronologia della conversazione è stata eliminata, quindi le sue risposte sono sparite anche da questo telefono. Ciò che stavi scrivendo resta, e puoi fare una nuova domanda.",
  historyExpired: "Le risposte più vecchie del periodo di conservazione sono state rimosse anche da questo telefono.",
  ackPending: "risposta finale in arrivo",
  ackLabel: "Risposta intermedia",
  finalLabel: "Risposta finale",
  somethingWrong: "Qualcosa è andato storto.",
  waitingEvenApp: "In attesa dell'app Even.",
  preparingG2: "Preparazione dello schermo di G2.",
  loadingSettings: "Caricamento delle impostazioni vocali salvate.",
  connectToRecord: "Connettiti al tuo server per registrare.",
  sonioxToRecord:
    "Aggiungi una chiave Soniox per registrare. Puoi comunque scrivere il messaggio qui sotto e inviarlo.",
  finishingPrevious: "Completamento della richiesta precedente.",
  messagePosition: (index, count, stage) => `Messaggio ${index} di ${count}${stage ? ` · ${stage}` : ""}`,
  noMessages: "Ancora nessun messaggio.",
  connectFirst: "Prima connettiti al tuo server.",
  connectionExpired:
    "Questa connessione è scaduta. Disconnettiti, poi connettiti di nuovo con una nuova chiave di connessione.",
  questionRejected:
    "Il server non ha accettato questa domanda perché la conversazione è stata eliminata o ha superato il periodo di conservazione. Non verrà reinviata automaticamente; inviandola di nuovo verrà mandata come nuova domanda.",
  serverFailed: (status) => `Richiesta al server non riuscita (${status})`,
  g2NotConnected: "G2 non ancora connesso · puoi leggere qui sul telefono.",
  showingOnG2: "Visualizzazione su G2…",
  g2UpdateFailed: "Impossibile aggiornare G2 · leggi la risposta qui sul telefono.",
  showingLiveCaption: "Trascrizione in diretta (provvisoria) in visualizzazione su G2",
  shownOnG2: "Mostrato su G2.",
  g2Unconfirmed: "Impossibile confermare l'aggiornamento di G2.",
  replyPosition: (index, count) => `${index}/${count}`,
  voiceStopped: "Input vocale interrotto · non è stato inviato nulla.",
  replyBackToReading:
    "Dot ha risposto · si torna al messaggio che stavi leggendo. Passa al messaggio successivo per vedere la nuova risposta.",
  replyShowingLatest: "Dot ha risposto · visualizzo l'ultima risposta su G2.",
  exitFailed: "Non chiusa · 2 tocchi",
  exitRequestFailed: "Impossibile chiedere a G2 di chiudere l'app. Tocca di nuovo due volte o chiudila dall'app Even.",
  staleResponse: "Ignorata una risposta del server obsoleta, più vecchia della conversazione già mostrata.",
  unversionedResponse:
    "Ignorata una risposta del server senza versione della conversazione, perché potrebbe includere risposte eliminate.",
  erasedReplyAfterVoice: (erased) => `${erased} La nuova risposta comparirà su G2 dopo l'invio del tuo input vocale.`,
  replyAfterVoice: "Dot ha risposto · comparirà su G2 dopo l'invio del tuo input vocale.",
  erasedShowingNew: (erased) => `${erased} Visualizzazione della nuova risposta.`,
  ackReceived: "Risposta intermedia di Dot ricevuta · risposta finale in arrivo · in visualizzazione su G2.",
  finalReceived:
    "Risposta finale di Dot ricevuta · in visualizzazione su G2. La risposta intermedia resta nel messaggio precedente.",
  replyShowing: "Dot ha risposto · in visualizzazione su G2.",
  finishingTranscriptWaiting: "Completamento della trascrizione · in attesa del testo finale",
  finishingTranscript: "Completamento della trascrizione · non ancora inviata",
  transcriptReady: "Trascrizione pronta · controllala, poi inviala.",
  transcriptAppended: "Trascrizione pronta · aggiunta dopo ciò che stavi scrivendo. Controllala, poi inviala.",
  transcriptReadyPhone: "Trascrizione pronta · controllala sul telefono, poi inviala.",
  sendUnconfirmed: "Impossibile confermare se è stato inviato.",
  sendFailed: "Invio non riuscito.",
  transcriptKept: (reason) =>
    `${reason} La trascrizione resta nella casella del messaggio. Controllala e inviala di nuovo.`,
  manualMicStarting: "Accensione del microfono di G2 · in attesa della tua voce",
  recordingLive:
    "Registrazione in corso · la tua voce diventa testo mentre parli · interrompi per inviare il testo finale.",
  recordingHold: "Registrazione in corso · rilascia per trascrivere e inviare.",
  micOffProcessing: "Microfono spento · elaborazione della voce",
  settingsSaveFailed:
    "Impossibile salvare le impostazioni. Valgono ora, ma al prossimo avvio potrebbero essere usate quelle precedenti.",
  sending: "Invio al server · non ancora confermato",
  delivered: "Salvato e consegnato a Dot · in attesa di una risposta.",
  savedNotDelivered: "Salvato sul server · Dot non ha ancora confermato né risposto.",
  savedThenDeleted:
    "Il server ha ricevuto la domanda, ma nel frattempo la conversazione è stata eliminata, quindi anche questa domanda potrebbe essere sparita.",
  replyReady: "Una risposta è pronta · caricamento.",
  messageKept: (reason) => `${reason} Il messaggio è ancora nella casella del messaggio.`,
  dashboardNeedsOrigin: "Per aprire la dashboard, inserisci l'indirizzo HTTPS del server senza nient'altro dopo.",
  dashboardCopied: "Indirizzo della dashboard copiato. Aprilo nel browser del telefono.",
  dashboardCopyFailed: "Copia non riuscita. Tieni premuto l'indirizzo della dashboard qui sopra per copiarlo.",
  languageSaveFailed:
    "Impossibile salvare la scelta della lingua. Vale ora, ma al prossimo avvio potrebbe comparire un'altra lingua.",
  originInvalid: "Questo indirizzo del server non è valido. Inserisci un indirizzo che inizia con https://.",
  connecting: "Connessione al server in corso",
  connectTimeout: "Il server non ha risposto entro 15 secondi. Controlla l'indirizzo e la rete.",
  connectNetwork: "Impossibile raggiungere il server. Controlla l'indirizzo e la rete.",
  keyRejected: (status) =>
    `Questa chiave di connessione è errata o scaduta (${status}). Ottieni una nuova chiave e inseriscila di nuovo.`,
  connectFailed: (status) => `Impossibile connettersi al server (${status}) · riprova tra poco.`,
  connectIncomplete: "Il server non ha completato la connessione.",
  connectSaveFailed: "Impossibile salvare la connessione. Connettiti di nuovo con una nuova chiave di connessione.",
  connected: "Connesso al server · completa anche la connessione e l'iscrizione in Dot.",
  connectFailedGeneric: "Connessione non riuscita.",
  previousConnectionKept: (message) => `${message} La connessione precedente resta attiva.`,
  keyFailed: "Impossibile usare questa chiave.",
  waitForEvenApp: "Attendi che l'app Even sia connessa, poi inserisci la chiave.",
  keySaving: "Salvataggio della chiave",
  keyUpdating: "Modifica di dove è conservata la chiave",
  keyRemoving: "Rimozione della chiave",
  disconnected: "Disconnesso.",
  connectionForgotten:
    "Questo telefono ha dimenticato la connessione. Rimuovi il dispositivo anche sul server per revocarla del tutto.",
  forgetUnconfirmed:
    "Impossibile confermare la rimozione della connessione salvata. Controlla i dati memorizzati dall'app Even.",
  voiceStoppedAppSwitch:
    "Input vocale interrotto perché hai cambiato app su G2. Di' Hey dots o tieni premuto per parlare di nuovo.",
  pageHidden:
    "La pagina è stata chiusa o nascosta, quindi ascolto, registrazione e controllo delle risposte si sono fermati. Riprenderanno quando la pagina tornerà.",
  pageBack: "La pagina è tornata · ascolto e controllo delle risposte riprendono.",
  evenAppMissing: (app) => `App Even non trovata. Apri ${app} dall'app Even.`,
  g2StartFailed: "Impossibile avviare lo schermo di G2. Riapri l'app dall'app Even.",
  micOnWake: "Microfono acceso · questo telefono attende Hey dots · nulla viene inviato prima che tu lo dica.",
  micOnRecording: "Microfono acceso · registrazione in corso",
  badAudioFrame: "Ricevuto un suono che non è stato possibile leggere.",
  abnormalExit:
    "L'app si è chiusa in modo imprevisto su G2, quindi ascolto, registrazione e controllo delle risposte si sono fermati. Riaprila dall'app Even.",
  systemExit:
    "L'app è stata chiusa su G2, quindi ascolto, registrazione e controllo delle risposte si sono fermati. Aprila su G2 per usarla di nuovo.",
  foregroundExit:
    "Hai cambiato app su G2, quindi ascolto, registrazione e controllo delle risposte si sono fermati. Riprenderanno quando la riaprirai su G2.",
  foregroundBack: "Di nuovo su G2 · ascolto e controllo delle risposte ripartono.",
  keyLoadFailed: "Impossibile caricare la chiave Soniox salvata. Inseriscila di nuovo o tocca Rimuovi chiave.",
  savedConnectionUnreadable:
    "Impossibile leggere la connessione salvata. Connettiti con una nuova chiave di connessione.",
  usingSavedConnection: "Viene usata la connessione al server salvata.",
  g2ReadyEnterConnection: "G2 pronto · inserisci l'indirizzo del server e la chiave di connessione.",
};
