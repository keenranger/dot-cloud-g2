import type { Copy } from "../dashboard";
import { PRODUCT_NAME } from "../product";

export const it: Copy = {
  dateLocale: "it-IT",
  languageName: "Italiano",
  page: {
    home: `Home di ${PRODUCT_NAME}`,
    headerNote: "PER EVEN G2 × CHATGPT DOT",
    language: "Lingua",
    signOut: "Esci",
    eyebrow: "CHIEDI SENZA PRENDERE IL TELEFONO",
    titleLines: ["Chiedi dagli occhiali.", "Leggi lì la risposta di Dot."],
    intro: "Parla con il tuo ChatGPT Dot da Even G2 e leggi la risposta sulle lenti.",
    needs:
      "Ti servono i G2 collegati all’app Even Hub sul telefono, ChatGPT nel browser di un computer per una configurazione una tantum e un account Soniox se vuoi fare domande a voce.",
    flowLabel: "Come funziona",
    flow: ["Parli sui G2", "Dot risponde", "Leggi sui G2"],
    signInEyebrow: "INIZIA",
    signInTitle: "Accedi per configurare i tuoi occhiali",
    signInBody:
      "Accedi con il tuo account ChatGPT per associare i tuoi G2 e collegare il tuo Dot. Non devi installare nulla sul computer.",
    signIn: "Accedi con ChatGPT",
    previewTitle: "Anteprima",
    previewBody:
      "Le risposte di Dot sui tuoi occhiali sono ancora in prova su dispositivi reali, quindi alcune risposte potrebbero non arrivare ancora.",
    footer: "I tuoi occhiali e il tuo Dot, collegati.",
    policies: "Informative",
    privacy: "Informativa sulla privacy",
    terms: "Condizioni d’uso",
    apply: "Applica",
    support: "Aiuto e feedback",
    supportGuide: "Guida all’uso e codice sorgente su GitHub",
    supportIssues: "Domande e richieste di funzionalità su GitHub Issues",
    newTab: "(si apre in una nuova scheda)",
    metaTitle: "ChatGPT Dot sui tuoi occhiali G2",
    metaDescription: "Parla con il tuo ChatGPT Dot da Even G2 e leggi le risposte sui tuoi occhiali.",
  },
  policy: {
    formerly: "in precedenza Lens MCP for G2",
    effective: "In vigore dal",
    englishVersion: "Versione inglese",
  },
  notFound: {
    title: "Pagina non trovata",
    body: "Questa pagina non esiste o è stata spostata.",
    home: "Vai alla home",
  },
  error: {
    title: "Si è verificato un problema",
    body: "Non è stato possibile mostrare questa pagina. Riprova o torna alla home. Se il problema continua, segnalacelo su GitHub Issues.",
    retry: "Riprova",
    home: "Vai alla home",
  },
  dashboard: {
    eyebrow: "LA TUA CONNESSIONE",
    title: "La tua configurazione",
    refresh: "Aggiorna stato",
    checking: "Verifica in corso…",
    statusLabel: "Stato della connessione",
    statusChecking: "Verifica in corso",
    statusUnavailable: "Non disponibile",
    devices: "Occhiali associati",
    deviceCount: (n) => `${n}`,
    dot: "Dot",
    dotSubscribed: "In ascolto",
    dotWaiting: "Non ancora collegato",
    pending: "Domande in attesa di Dot",
    pendingCount: (n) => `${n}`,
    speech: "Input vocale",
    speechValue: "Controlla nell’app del telefono",
    delivery: {
      accepted: "Dot l’ha ricevuta",
      http_4xx: "Dot l’ha rifiutata",
      http_5xx: "Dot ha avuto un problema",
      http_other: "Risposta inattesa",
      timeout: "Dot ha impiegato troppo tempo",
      network: "Problema di rete",
      invalid_response: "Risposta illeggibile",
    },
    lastDelivery: (label, at, awaiting, retrying, stopped) =>
      `Ultima domanda inviata a Dot: ${label}, ${at}. In attesa di risposta: ${awaiting}. Nuovo tentativo previsto: ${retrying}. Tentativi interrotti: ${stopped}. «Ricevuta» significa che Dot ha ricevuto la domanda, non che abbia risposto né che la risposta sia sui tuoi occhiali.`,

    pairTitle: "Passaggio 1: associa i tuoi occhiali",
    pairBody: `Sul telefono, apri ${PRODUCT_NAME} nell’app Even Hub e inserisci l’indirizzo del server e la chiave di connessione qui sotto. Tieni i G2 collegati al telefono. Questo è separato dal tuo accesso a ChatGPT.`,
    serverAddress: "Indirizzo del server",
    addressPending: "Recupero dell’indirizzo…",
    keyHelp:
      "La tua chiave di connessione non scade mai e funziona con tutti i tuoi occhiali. Resta nascosta finché non scegli «Mostra chiave». Se crei una nuova chiave o revochi questa, la vecchia chiave non può più associare nuovi occhiali; gli occhiali già associati continuano a funzionare.",
    keyLabel: "Chiave di connessione",
    keyHidden: "Nascosta. Scegli «Mostra chiave».",
    showKey: "Mostra chiave",
    hideKey: "Nascondi chiave",
    copy: "Copia",
    copyLabel: (label) => `Copia ${label.charAt(0).toLowerCase()}${label.slice(1)}`,
    keyCreated: (at) => `Creata il ${at} · non scade mai`,
    legacyCode: (expires) =>
      `È ancora attivo un vecchio codice di associazione da 10 minuti${expires ? ` (scade il ${expires})` : ""}. Non può essere mostrato di nuovo, quindi crea una chiave di connessione, una sola volta. La nuova chiave non scade mai.`,
    keyUnavailable:
      "Non siamo riusciti a verificare la tua chiave di connessione. Scegli «Aggiorna stato» per riprovare; potrai creare una chiave quando la verifica riesce.",
    createKey: "Crea chiave di connessione",
    createNewKey: "Crea nuova chiave",
    creatingKey: "Creazione della chiave…",
    revokeKey: "Revoca chiave",
    revokingKey: "Revoca in corso…",
    confirmRotate:
      "Dopo aver creato una nuova chiave, la chiave attuale non potrà più associare nuovi occhiali. Gli occhiali già associati continuano a funzionare. Creare una nuova chiave?",
    confirmRevoke:
      "Dopo aver revocato la chiave, nessun paio di occhiali potrà essere associato finché non ne crei una nuova. Gli occhiali già associati continuano a funzionare. Revocare la chiave?",
    cancel: "Annulla",

    dotTitle: "Passaggio 2: collega ChatGPT Dot",
    dotBody:
      "Così il tuo Dot può sentire le tue domande e rispondere sui tuoi occhiali. Per questo passaggio non ti serve la chiave di connessione.",
    dotSteps: [
      "Su un computer, apri ChatGPT in un browser web, aggiungi l’indirizzo qui sotto come connettore personalizzato e installalo. Salta questo passaggio se l’hai già aggiunto.",
      "Invia al tuo Dot il messaggio di configurazione qui sotto. Dopo potrai continuare a parlare con lo stesso Dot nell’app mobile di ChatGPT.",
    ],
    mcpAddress: "Indirizzo del connettore (MCP)",
    promptLabel: "Messaggio di configurazione per Dot",
    copyPrompt: "Copia il messaggio di configurazione",
    dotPrompt: (connector) =>
      `Iscriviti all’evento "utterance.created" del connettore all’indirizzo ${connector || "/mcp di questo sito"} con la session "g2". Quando arriva una nuova domanda vocale, rispondi nella lingua in cui è stata posta, poi chiama reply_to_g2 con lo stesso utterance_id ricevuto e la tua risposta come text. Prima di un lavoro lento come una ricerca o l’uso di strumenti, chiama prima acknowledge_g2_utterance con lo stesso utterance_id e una breve nota, con parole tue, su cosa farai; non inviare un messaggio di rito tipo «ricevuto». Non dirmi che sei collegato finché non è arrivato davvero un evento.`,

    speechTitle: "Passaggio 3: attiva le domande vocali",
    speechBody:
      "Per fare domande a voce, aggiungi la tua chiave API Soniox nell’app del telefono. Puoi saltare questo passaggio se scrivi soltanto le domande. Non inserire mai la chiave su questo sito.",
    speechSteps: [
      "Nel tuo account Soniox, crea una chiave API che consenta la trascrizione in tempo reale (real-time transcription).",
      `Nell’app Even Hub sul telefono, apri le impostazioni di ${PRODUCT_NAME} e incolla la chiave.`,
      "La chiave viene conservata solo finché l’app è aperta. Scegli «Ricorda» per tenerla sul telefono; puoi cancellarla o sostituirla in qualsiasi momento nelle stesse impostazioni.",
    ],
    sonioxGuide: "Come impostare le autorizzazioni della chiave Soniox (si apre in una nuova scheda)",
    speechPrivacy:
      "La tua voce va dal telefono direttamente a Soniox, che la trasforma in testo; solo quel testo arriva a questo servizio e al tuo Dot. Soniox addebita i costi al tuo account. Una chiave ricordata è sicura quanto il tuo telefono e l’app Even Hub; non viene cifrata separatamente.",

    revokeAllBody:
      "Scollega tutti gli occhiali del tuo account e revoca la chiave di connessione. Per usarli di nuovo, associali con una nuova chiave.",
    revokeAll: "Scollega tutti gli occhiali",
    revokingAll: "Scollegamento…",
    deleteBody:
      "Elimina subito da questo servizio la cronologia delle conversazioni (le tue domande, le risposte di Dot e le notifiche). Gli occhiali associati e il collegamento con Dot restano invariati.",
    deleteConfirm:
      "L’operazione non può essere annullata. Ciò che è già stato inviato a ChatGPT (Dot) o a Soniox, o già mostrato sul telefono, non può essere cancellato da qui. Eliminare la cronologia?",
    deleteForever: "Elimina definitivamente la cronologia",
    deleting: "Eliminazione…",
    deleteStart: "Elimina la cronologia delle conversazioni",

    askTitle: "Passaggio 4: chiedi dai G2",
    askBody:
      "Dopo i passaggi 1 e 2, scrivi una domanda nell’app del telefono, oppure parla una volta completato il passaggio 3. La risposta di Dot compare sui tuoi occhiali.",

    copied: "Copiato.",
    copyUnavailable: "Impossibile copiare automaticamente. Seleziona il testo e copialo tu.",
    keyShown: "Chiave di connessione mostrata.",
    keyCreatedNotice:
      "Nuova chiave di connessione creata. Scegli «Mostra chiave» e inseriscila nell’app Even Hub. La vecchia chiave non può più associare nuovi occhiali; gli occhiali già associati continuano a funzionare.",
    keyRevokedNotice:
      "Chiave di connessione revocata. Nessun nuovo paio di occhiali può essere associato finché non crei una chiave; gli occhiali già associati continuano a funzionare.",
    sessionExpired: "Il tuo accesso è scaduto. Accedi di nuovo.",
    rateLimited: "Troppi tentativi. Attendi un minuto e riprova.",
    keyServiceUnavailable:
      "Al momento non è possibile creare o mostrare chiavi di connessione. La chiave attuale e gli occhiali associati continuano a funzionare.",
    keyNotRevealable:
      "Questa chiave non può essere mostrata di nuovo. Gli occhiali associati continuano a funzionare; crea una nuova chiave se ti serve.",
    keyFailed: {
      create: "Impossibile creare la chiave di connessione. Riprova tra poco.",
      reveal: "Impossibile mostrare la chiave di connessione. Riprova tra poco.",
      withdraw: "Impossibile revocare la chiave di connessione. Riprova tra poco.",
    },
    keyUnconfirmed:
      "Non siamo riusciti a confermare la nuova chiave per l’account ora connesso. Scegli «Aggiorna stato» per vedere la chiave attuale.",
    keyMismatch:
      "La tua chiave è cambiata da quando questa pagina è stata caricata, quindi non è stata mostrata. Abbiamo verificato di nuovo; scegli ancora «Mostra chiave».",
    statusFailed: "Impossibile caricare lo stato della connessione. Riprova.",
    statusUnknown: "Impossibile verificare lo stato della connessione.",
    revokeAllFailed: "Impossibile scollegare i tuoi occhiali. Riprova.",
    revokedAll:
      "Tutti i tuoi occhiali sono scollegati e la chiave di connessione è revocata. Crea una nuova chiave per associarli di nuovo.",
    deleteFailed: "Impossibile eliminare la cronologia delle conversazioni. Riprova tra poco.",
    deleted: (n) =>
      `${n === 1 ? "Eliminato 1 elemento" : `Eliminati ${n} elementi`} dalla cronologia delle conversazioni. Gli occhiali associati e il collegamento con Dot sono invariati.`,
  },
};
