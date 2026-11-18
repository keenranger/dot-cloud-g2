import Link from "next/link";
import { CONTACT_EMAIL, RELAY_ORIGIN } from "../../components/policy-page";
import { copy, policyPath } from "../../i18n/dashboard";

// Italian translation of the English Terms of Use in ../page.tsx; same sections, lists and facts.
const privacy = copy.it.page.privacy;

export const description = "Che cosa offre Lens MCP for G2, che cosa richiede da te e quali sono i suoi limiti.";

export default function Body() {
  return (
    <>
      <p>
        Queste condizioni si applicano all’app companion Lens MCP for G2 e al sito relay all’indirizzo{" "}
        <a href={RELAY_ORIGIN}>{RELAY_ORIGIN}</a>, pubblicati da <strong>keenranger</strong>. Leggile insieme all’
        <Link href={policyPath("privacy", "it")}>{privacy}</Link>.
      </p>

      <section aria-labelledby="service">
        <h2 id="service">1. Il servizio</h2>
        <p>
          Lens MCP for G2 collega i tuoi occhiali Even Realities G2 al tuo ChatGPT Dot tramite MCP: trasmette al tuo Dot
          ciò che dici o scrivi e mostra le sue risposte sugli occhiali. Non è un client MCP generico e non promette di
          funzionare con ogni server o agente MCP.
        </p>
      </section>

      <section aria-labelledby="needs">
        <h2 id="needs">2. Che cosa ti serve</h2>
        <ul>
          <li>Occhiali G2 e un telefono con un’app Even compatibile (versione 2.2.10 o successiva).</li>
          <li>Accesso alla rete e un account ChatGPT con un Dot collegato al relay.</li>
          <li>Per l’input vocale, un tuo account Soniox e una tua chiave API.</li>
        </ul>
      </section>

      <section aria-labelledby="accounts">
        <h2 id="accounts">3. I tuoi account, le chiavi e i costi</h2>
        <p>
          Controlli tu gli account e le chiavi che usi con il servizio e devi avere il diritto di usarli. I servizi di
          ChatGPT, Soniox ed Even Realities sono forniti secondo i loro termini, e gli eventuali costi, come l’uso di
          Soniox per la trascrizione, sono a tuo carico. L’app non include credito di trascrizione a pagamento e non
          crea account presso i fornitori per te.
        </p>
        <p>
          Tratta la tua chiave di connessione come una password. Chiunque la possieda può associare un nuovo dispositivo
          al tuo account finché non crei una nuova chiave o la revochi. Puoi scollegare tutti i tuoi dispositivi dal
          sito relay.
        </p>
      </section>

      <section aria-labelledby="limits">
        <h2 id="limits">4. Limitazioni e uso sicuro</h2>
        <ul>
          <li>
            Le trascrizioni possono contenere errori e le risposte di Dot possono essere sbagliate. Controllale prima di
            farvi affidamento.
          </li>
          <li>
            Non usare il servizio per le emergenze né al posto di una consulenza professionale medica, legale o
            finanziaria.
          </li>
          <li>Guarda gli occhiali o interagisci con essi solo quando è sicuro farlo.</li>
          <li>
            Il funzionamento con il telefono bloccato o in background dipende dall’app Even e dal sistema operativo del
            telefono e non è garantito.
          </li>
          <li>Questo è un progetto indipendente. Può cambiare, essere interrotto o essere chiuso.</li>
        </ul>
      </section>

      <section aria-labelledby="use">
        <h2 id="use">5. Uso consentito</h2>
        <p>
          Non usare il servizio per violare la legge, per accedere ai dati o ai dispositivi di un’altra persona o per
          disturbare il relay o i servizi a cui si collega.
        </p>
      </section>

      <section aria-labelledby="exit">
        <h2 id="exit">6. Smettere di usare il servizio</h2>
        <p>
          Puoi in qualsiasi momento disattivare «Hey dots», interrompere una registrazione, cancellare la tua chiave
          Soniox, scollegare l’app companion, revocare la chiave di connessione, scollegare tutti i dispositivi e
          cancellare le conversazioni, come descritto nell’<Link href={policyPath("privacy", "it")}>{privacy}</Link>. I
          dati conservati da altri fornitori restano soggetti ai loro controlli.
        </p>
      </section>

      <section aria-labelledby="independence">
        <h2 id="independence">7. Indipendenza</h2>
        <p>
          Questo progetto non è affiliato a Even Realities, OpenAI o Soniox né approvato da essi. I loro nomi sono usati
          solo per descrivere la compatibilità con i loro prodotti e servizi.
        </p>
      </section>

      <section aria-labelledby="contact">
        <h2 id="contact">8. Modifiche e contatti</h2>
        <p>
          Se queste condizioni cambiano, la versione aggiornata e la sua data di entrata in vigore saranno pubblicate su
          questa pagina. Domande: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </section>
    </>
  );
}
