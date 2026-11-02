import Link from "next/link";
import { CONTACT_EMAIL, RELAY_ORIGIN } from "../../components/policy-page";
import { copy, policyPath } from "../../i18n/dashboard";

// Italian translation of the English Privacy Notice in ../page.tsx; same sections, lists and facts.
const d = copy.it.dashboard;
// The companion's disconnect button (even-app/src/messages/it.ts).
const companionDisconnect = "Disconnetti e dimentica questa connessione";

export const description =
  "Che cosa tratta Lens MCP for G2, dove finisce, per quanto tempo il relay lo conserva e come cancellarlo.";

export default function Body() {
  return (
    <>
      <section aria-labelledby="who">
        <h2 id="who">Chi siamo</h2>
        <p>
          Lens MCP for G2 è un progetto indipendente pubblicato da <strong>keenranger</strong>. È composto da un’app
          companion per gli occhiali Even Realities G2, distribuita tramite Even Hub, e da un sito relay all’indirizzo{" "}
          <a href={RELAY_ORIGIN}>{RELAY_ORIGIN}</a>. Insieme collegano i tuoi G2 al tuo ChatGPT Dot. Non è un prodotto
          ufficiale di Even Realities, OpenAI o Soniox.
        </p>
        <p>
          Domande e richieste sulla privacy: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </section>

      <section aria-labelledby="audio">
        <h2 id="audio">Audio del microfono</h2>
        <ul>
          <li>L’app companion usa solo il microfono dei G2. Una registrazione manuale dura al massimo 30 secondi.</li>
          <li>
            L’ascolto di «Hey dots» è attivo per impostazione predefinita non appena l’app companion è associata e ha
            una chiave vocale. Puoi disattivarlo nell’app companion e la tua scelta viene ricordata sul telefono. Finché
            è attivo e l’app companion è in esecuzione, il microfono dei G2 resta aperto per poter rilevare la parola di
            attivazione.
          </li>
          <li>
            Il rilevamento della parola di attivazione avviene sul tuo telefono. L’audio sentito prima della parola di
            attivazione è conservato solo in buffer brevi e limitati sul telefono e non viene inviato da nessuna parte.
          </li>
          <li>
            Il parlato dopo la parola di attivazione, o una registrazione manuale, viene trasmesso dal telefono
            direttamente a Soniox per la trascrizione, usando la tua chiave API Soniox. Soniox tratta quell’audio
            secondo il tuo accordo con Soniox.
          </li>
          <li>
            Il nostro relay non riceve mai audio grezzo. Il suo endpoint di trascrizione lato server è disattivato e
            rifiuta le richieste prima di leggere qualsiasi audio.
          </li>
        </ul>
      </section>

      <section aria-labelledby="soniox-key">
        <h2 id="soniox-key">La tua chiave API Soniox</h2>
        <p>
          Inserisci la tua chiave Soniox sul telefono. Per impostazione predefinita è conservata solo in memoria per la
          sessione corrente dell’app. Se scegli di ricordarla, viene salvata nello spazio di archiviazione dell’app Even
          Hub su quel telefono. Puoi cancellarla o sostituirla in qualsiasi momento. La chiave viene inviata solo a
          Soniox, mai al nostro relay. L’app companion non aggiunge una propria cifratura a una chiave ricordata; è
          sicura quanto il tuo telefono e l’app Even.
        </p>
      </section>

      <section aria-labelledby="text">
        <h2 id="text">Messaggi, trascrizioni e risposte</h2>
        <p>
          I messaggi scritti, le trascrizioni finali, le risposte di Dot e i messaggi che il tuo Dot invia di sua
          iniziativa vengono conservati sul relay per poter essere recapitati tra i tuoi G2 e ChatGPT. Insieme a questi
          il relay conserva l’identificativo del tuo account, gli identificativi di messaggi e dispositivi, gli orari e
          lo stato di consegna. I messaggi che il tuo Dot invia di sua iniziativa vengono recapitati a ogni dispositivo
          associato al tuo account. Questi messaggi possono contenere qualsiasi informazione personale tu scelga di dire
          o scrivere.
        </p>
        <p>
          L’app companion conserva in memoria sul telefono fino a 100 risposte recenti e ricorda le tue scelte per «Hey
          dots» e per l’invio automatico vocale nello spazio di archiviazione dell’app Even Hub.
        </p>
      </section>

      <section aria-labelledby="account">
        <h2 id="account">Accesso, chiave di connessione e dispositivi</h2>
        <ul>
          <li>
            Accedi al sito relay con ChatGPT. La piattaforma di hosting fornisce al relay un identificativo per il tuo
            account, che mantiene i tuoi dati separati da quelli degli altri utenti. La tua sessione ChatGPT non viene
            copiata nell’app companion.
          </li>
          <li>
            Ogni account ha al massimo una chiave di connessione. Non scade e può associare più di un dispositivo. Il
            relay conserva un hash SHA-256 della chiave per trovarla e la chiave stessa cifrata con AES-256-GCM tramite
            un segreto del server, così che tu, dopo l’accesso, possa vederla di nuovo in seguito. Questa cifratura
            protegge dall’esposizione del solo database, non da una compromissione del server o del suo segreto.
          </li>
          <li>
            La dashboard mostra la chiave mascherata per impostazione predefinita. Compare solo dopo che scegli «
            {d.showKey}», può essere copiata solo mentre è mostrata ed è conservata solo nella memoria della pagina, mai
            nello spazio di archiviazione del browser.
          </li>
          <li>
            Creare una nuova chiave («{d.createNewKey}») sostituisce subito la vecchia; revocarla («{d.revokeKey}») la
            rimuove. I dispositivi già associati restano associati in entrambi i casi. «{d.revokeAll}» rimuove la chiave
            e scollega tutti i tuoi dispositivi.
          </li>
          <li>
            I dispositivi associati prima dell’introduzione delle chiavi di connessione restano associati. I codici di
            associazione di breve durata usati in precedenza non potevano essere mostrati di nuovo e ora sono scaduti.
          </li>
          <li>
            L’associazione di un dispositivo crea un record del dispositivo e un token del dispositivo. Il relay
            conserva il token solo come hash. L’app companion salva il token e l’indirizzo del relay nello spazio di
            archiviazione dell’app Even Hub sul telefono.
          </li>
          <li>
            Quando il tuo Dot si iscrive agli eventi, il relay conserva l’iscrizione, il suo indirizzo di callback e il
            suo segreto di firma. Un’iscrizione dura un’ora per impostazione predefinita (tra un minuto e un giorno) e
            può essere annullata.
          </li>
          <li>Il relay mantiene contatori di richieste di breve durata per limitare gli abusi.</li>
        </ul>
      </section>

      <section aria-labelledby="recipients">
        <h2 id="recipients">Dove vanno le informazioni</h2>
        <ul>
          <li>
            <strong>Il nostro relay</strong>, ospitato sulla piattaforma Sites usata da questo progetto: testo,
            identificativi e dati di connessione descritti sopra. Mai audio né la tua chiave Soniox.
          </li>
          <li>
            <strong>Soniox</strong> (<code>stt-rt.soniox.com</code>): l’audio che invii per la trascrizione e la tua
            chiave.
          </li>
          <li>
            <strong>ChatGPT (il tuo Dot)</strong> e il callback MCP che registra: i tuoi messaggi e le trascrizioni, e
            le risposte che restituisce.
          </li>
          <li>
            <strong>Even Realities</strong> (app) e il sistema operativo del telefono: ospitano l’app companion,
            collegano il microfono e il display degli occhiali e contengono lo spazio di archiviazione dell’app Even
            Hub.
          </li>
        </ul>
        <p>
          Ogni fornitore tratta i dati secondo i propri termini e le proprie politiche. L’app companion e il codice del
          relay di questo progetto non includono strumenti di analisi o pubblicità. Non abbiamo verificato dove i
          fornitori conservano i dati, i loro log o i loro backup.
        </p>
      </section>

      <section aria-labelledby="retention">
        <h2 id="retention">Per quanto tempo il relay conserva le conversazioni</h2>
        <ul>
          <li>
            <strong>Limite di 30 giorni.</strong> 30 giorni dopo la creazione di un messaggio, una trascrizione o una
            risposta (UTC), il relay non lo mostra, non lo recapita, non lo ritenta e non vi risponde più, che sia già
            stato eliminato fisicamente o no.
          </li>
          <li>
            <strong>Cancella ora.</strong> Dopo l’accesso al sito relay, puoi cancellare tutte le tue conversazioni in
            una volta con «{d.deleteForever}». Il contenuto viene eliminato subito. Il relay conserva solo un breve
            indicatore senza contenuto per ogni elemento cancellato, così che un nuovo tentativo tardivo non possa
            salvarlo di nuovo, e l’app companion svuota la cronologia sullo schermo la prossima volta che controlla le
            risposte. I tuoi dispositivi, la chiave di connessione e l’iscrizione di Dot non sono interessati.
          </li>
          <li>
            <strong>Eliminazione fisica.</strong> Una pulizia giornaliera è programmata alle 03:00 ora coreana
            (Asia/Seoul). Ogni esecuzione elimina definitivamente fino a 20.000 record che hanno superato il limite di
            30 giorni; il resto attende un’esecuzione successiva. L’eliminazione può quindi avvenire fino a circa un
            giorno dopo il limite, e più tardi se un’esecuzione non riesce o si accumula un arretrato. Non abbiamo
            ancora osservato la pulizia programmata avviarsi da sola, quindi non promettiamo l’eliminazione in un giorno
            preciso. Alcuni record scaduti possono anche essere eliminati prima, quando vengono inviati nuovi messaggi.
          </li>
          <li>
            Gli indicatori senza contenuto lasciati da una cancellazione o da una pulizia vengono conservati 30 giorni e
            poi rimossi dalla stessa pulizia.
          </li>
          <li>
            La chiave di connessione viene conservata finché non la sostituisci o la revochi, o non scolleghi tutti i
            dispositivi. Codici, iscrizioni e contatori di richieste scaduti smettono di funzionare alla scadenza, ma
            non vengono eliminati secondo una pianificazione.
          </li>
        </ul>
        <p>
          Scollegare tutti i dispositivi ne rimuove l’accesso ma non elimina le conversazioni; per questo usa «
          {d.deleteForever}». «{companionDisconnect}» nell’app companion cancella solo il token salvato su quel
          telefono.
        </p>
        <p>
          Il relay non può eliminare ciò che è già stato inviato a ChatGPT o a Soniox, né ciò che è già stato mostrato
          sul telefono o sugli occhiali. Le copie conservate dai fornitori, nonché i log e i backup dell’hosting e dei
          fornitori, sono esclusi da questi impegni.
        </p>
      </section>

      <section aria-labelledby="background">
        <h2 id="background">Telefono bloccato e uso in background</h2>
        <p>
          Finché la sessione degli occhiali resta attiva, l’app companion è progettata per continuare ad ascoltare «Hey
          dots», a registrare e a mostrare risposte anche quando il telefono è bloccato o l’app Even è in background. Se
          continua a funzionare in quel caso dipende dall’app Even e dal sistema operativo del telefono. Chiudere l’app
          companion, scollegarla o disattivare «Hey dots» interrompe l’ascolto.
        </p>
      </section>

      <section aria-labelledby="security">
        <h2 id="security">Sicurezza</h2>
        <p>
          L’app companion comunica con il relay e con Soniox solo tramite HTTPS e WebSocket sicuri. L’accesso dei
          dispositivi usa token per singolo dispositivo; le azioni sull’account richiedono l’accesso con ChatGPT e sono
          limitate ai tuoi dati; e le richieste di chiave e di associazione hanno un limite di frequenza. Nessun sistema
          è perfettamente sicuro e non possiamo garantire che queste misure impediscano ogni uso improprio.
        </p>
      </section>

      <section aria-labelledby="changes">
        <h2 id="changes">Modifiche e contatti</h2>
        <p>
          Se questa informativa cambia, la versione aggiornata e la sua data di entrata in vigore saranno pubblicate su
          questa pagina. Per domande o richieste sulle tue informazioni, scrivi a{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Vedi anche le{" "}
          <Link href={policyPath("terms", "it")}>{copy.it.page.terms}</Link>.
        </p>
      </section>
    </>
  );
}
