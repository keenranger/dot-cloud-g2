import Link from "next/link";
import { CONTACT_EMAIL, RELAY_ORIGIN } from "../../components/policy-page";
import { copy, policyPath } from "../../i18n/dashboard";

// French translation of the English Privacy Notice in ../page.tsx; same sections, lists and facts.
const d = copy.fr.dashboard;
// The companion's disconnect button (even-app/src/messages/fr.ts).
const companionDisconnect = "Se déconnecter et oublier cette connexion";

export const description =
  "Ce que Lens MCP for G2 traite, où cela va, combien de temps le relais le conserve et comment l’effacer.";

export default function Body() {
  return (
    <>
      <section aria-labelledby="who">
        <h2 id="who">Qui nous sommes</h2>
        <p>
          Lens MCP for G2 est un projet indépendant publié par <strong>keenranger</strong>. Il se compose d’une
          application compagnon pour les lunettes Even Realities G2, distribuée via Even Hub, et d’un site relais à
          l’adresse <a href={RELAY_ORIGIN}>{RELAY_ORIGIN}</a>. Ensemble, ils connectent vos G2 à votre propre ChatGPT
          Dot. Ce n’est pas un produit officiel d’Even Realities, d’OpenAI ou de Soniox.
        </p>
        <p>
          Questions et demandes relatives à la confidentialité : <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          .
        </p>
      </section>

      <section aria-labelledby="audio">
        <h2 id="audio">Audio du microphone</h2>
        <ul>
          <li>
            L’application compagnon utilise uniquement le microphone des G2. Un enregistrement manuel dure au plus 30
            secondes.
          </li>
          <li>
            L’écoute de « Hey dots » est activée par défaut dès que l’application compagnon est associée et dispose
            d’une clé vocale. Vous pouvez la désactiver dans l’application compagnon, et votre choix est mémorisé sur le
            téléphone. Tant qu’elle est activée et que l’application compagnon fonctionne, le microphone des G2 reste
            ouvert pour que le mot d’activation puisse être détecté.
          </li>
          <li>
            La détection du mot d’activation s’effectue sur votre téléphone. L’audio entendu avant le mot d’activation
            n’est conservé que dans de courtes mémoires tampons limitées sur le téléphone et n’est envoyé nulle part.
          </li>
          <li>
            La parole qui suit le mot d’activation, ou un enregistrement manuel, est transmise en continu de votre
            téléphone directement à Soniox pour être transcrite, avec votre propre clé API Soniox. Soniox traite cet
            audio dans le cadre de votre accord avec Soniox.
          </li>
          <li>
            Notre relais ne reçoit jamais d’audio brut. Son point de transcription côté serveur est désactivé et rejette
            les requêtes avant de lire le moindre audio.
          </li>
        </ul>
      </section>

      <section aria-labelledby="soniox-key">
        <h2 id="soniox-key">Votre clé API Soniox</h2>
        <p>
          Vous saisissez votre propre clé Soniox sur votre téléphone. Par défaut, elle n’est conservée qu’en mémoire
          pour la session en cours de l’application. Si vous choisissez de la mémoriser, elle est enregistrée dans le
          stockage de l’application Even Hub sur ce téléphone. Vous pouvez l’effacer ou la remplacer à tout moment. La
          clé n’est envoyée qu’à Soniox, jamais à notre relais. L’application compagnon n’ajoute pas son propre
          chiffrement à une clé mémorisée ; celle-ci est aussi sûre que votre téléphone et l’application Even.
        </p>
      </section>

      <section aria-labelledby="text">
        <h2 id="text">Messages, transcriptions et réponses</h2>
        <p>
          Les messages tapés, les transcriptions finales, les réponses de Dot et les messages que votre Dot envoie de
          lui-même sont stockés sur le relais afin de pouvoir être transmis entre vos G2 et ChatGPT. Avec eux, le relais
          stocke l’identifiant de votre compte, les identifiants des messages et des appareils, des horodatages et
          l’état de remise. Les messages que votre Dot envoie de lui-même sont remis à chaque appareil associé à votre
          compte. Ces messages peuvent contenir toute information personnelle que vous choisissez de dire ou de taper.
        </p>
        <p>
          L’application compagnon conserve jusqu’à 100 réponses récentes en mémoire sur le téléphone, et mémorise vos
          choix pour « Hey dots » et l’envoi automatique vocal dans le stockage de l’application Even Hub.
        </p>
      </section>

      <section aria-labelledby="account">
        <h2 id="account">Connexion, clé de connexion et appareils</h2>
        <ul>
          <li>
            Vous vous connectez au site relais avec ChatGPT. La plateforme d’hébergement fournit au relais un
            identifiant pour votre compte, qui sépare vos données de celles des autres utilisateurs. Votre session
            ChatGPT n’est pas copiée dans l’application compagnon.
          </li>
          <li>
            Chaque compte dispose d’au plus une clé de connexion. Elle n’expire pas et peut associer plusieurs
            appareils. Le relais stocke une empreinte SHA-256 de la clé pour la retrouver, ainsi que la clé elle-même
            chiffrée avec AES-256-GCM sous un secret du serveur, afin que vous puissiez, une fois connecté, la revoir
            plus tard. Ce chiffrement protège contre l’exposition de la seule base de données, pas contre une
            compromission du serveur ou de son secret.
          </li>
          <li>
            Le tableau de bord affiche la clé masquée par défaut. Elle n’apparaît qu’après que vous avez choisi «{" "}
            {d.showKey} », ne peut être copiée que pendant qu’elle est affichée, et n’est conservée que dans la mémoire
            de la page, jamais dans le stockage du navigateur.
          </li>
          <li>
            Créer une nouvelle clé (« {d.createNewKey} ») remplace immédiatement l’ancienne ; la révoquer («{" "}
            {d.revokeKey} ») la supprime. Les appareils déjà associés le restent dans les deux cas. « {d.revokeAll} »
            supprime la clé et déconnecte tous vos appareils.
          </li>
          <li>
            Les appareils associés avant l’introduction des clés de connexion restent associés. Les codes d’association
            de courte durée utilisés auparavant ne pouvaient pas être affichés à nouveau et ont depuis expiré.
          </li>
          <li>
            L’association d’un appareil crée un enregistrement d’appareil et un jeton d’appareil. Le relais ne stocke le
            jeton que sous forme d’empreinte. L’application compagnon enregistre le jeton et l’adresse du relais dans le
            stockage de l’application Even Hub sur le téléphone.
          </li>
          <li>
            Lorsque votre Dot s’abonne à des événements, le relais stocke l’abonnement, son adresse de rappel et son
            secret de signature. Un abonnement dure une heure par défaut (entre une minute et un jour) et peut être
            annulé.
          </li>
          <li>Le relais conserve des compteurs de requêtes de courte durée pour limiter les abus.</li>
        </ul>
      </section>

      <section aria-labelledby="recipients">
        <h2 id="recipients">Où vont les informations</h2>
        <ul>
          <li>
            <strong>Notre relais</strong>, hébergé sur la plateforme Sites utilisée par ce projet : le texte, les
            identifiants et les données de connexion décrits ci-dessus. Jamais l’audio ni votre clé Soniox.
          </li>
          <li>
            <strong>Soniox</strong> (<code>stt-rt.soniox.com</code>) : l’audio que vous soumettez pour transcription et
            votre clé.
          </li>
          <li>
            <strong>ChatGPT (votre Dot)</strong> et le rappel MCP qu’il enregistre : vos messages et transcriptions, et
            les réponses qu’il renvoie.
          </li>
          <li>
            <strong>Even Realities</strong> (application) et le système d’exploitation de votre téléphone : ils
            hébergent l’application compagnon, relient le microphone et l’affichage des lunettes, et contiennent le
            stockage de l’application Even Hub.
          </li>
        </ul>
        <p>
          Chaque fournisseur traite les données selon ses propres conditions et politiques. L’application compagnon et
          le code du relais de ce projet n’incluent aucun outil d’analyse ou de publicité. Nous n’avons pas vérifié où
          les fournisseurs stockent les données, leurs journaux ou leurs sauvegardes.
        </p>
      </section>

      <section aria-labelledby="retention">
        <h2 id="retention">Combien de temps le relais conserve les conversations</h2>
        <ul>
          <li>
            <strong>Limite de 30 jours.</strong> 30 jours après la création d’un message, d’une transcription ou d’une
            réponse (UTC), le relais ne l’affiche plus, ne la remet plus, ne la retente plus et n’y répond plus, qu’elle
            ait déjà été physiquement supprimée ou non.
          </li>
          <li>
            <strong>Effacer maintenant.</strong> Connecté au site relais, vous pouvez effacer toutes vos conversations
            en une fois avec « {d.deleteForever} ». Le contenu est supprimé immédiatement. Le relais ne garde qu’un
            court marqueur sans contenu pour chaque élément effacé, afin qu’une nouvelle tentative tardive ne puisse pas
            le stocker à nouveau, et l’application compagnon vide son historique à l’écran la prochaine fois qu’elle
            vérifie les réponses. Vos appareils, votre clé de connexion et l’abonnement de Dot ne sont pas affectés.
          </li>
          <li>
            <strong>Suppression physique.</strong> Un nettoyage quotidien est programmé à 03:00, heure de Corée
            (Asia/Seoul). Chaque exécution supprime définitivement jusqu’à 20 000 enregistrements ayant dépassé la
            limite de 30 jours ; le reste attend une exécution ultérieure. La suppression peut donc avoir lieu jusqu’à
            environ un jour après la limite, et plus tard si une exécution échoue ou si un retard s’accumule. Le
            nettoyage programmé n’a pas encore été observé s’exécutant de lui-même ; nous ne promettons donc pas de
            suppression à une date précise. Certains enregistrements expirés peuvent aussi être supprimés plus tôt
            lorsque de nouveaux messages sont soumis.
          </li>
          <li>
            Les marqueurs sans contenu laissés par un effacement ou un nettoyage sont conservés 30 jours, puis supprimés
            par le même nettoyage.
          </li>
          <li>
            La clé de connexion est conservée jusqu’à ce que vous la remplaciez ou la révoquiez, ou que vous
            déconnectiez tous les appareils. Les codes, abonnements et compteurs de requêtes expirés cessent de
            fonctionner à leur expiration mais ne sont pas supprimés selon un calendrier.
          </li>
        </ul>
        <p>
          Déconnecter tous les appareils supprime leur accès mais ne supprime pas les conversations ; utilisez «{" "}
          {d.deleteForever} » pour cela. « {companionDisconnect} » dans l’application compagnon efface uniquement le
          jeton enregistré sur ce téléphone.
        </p>
        <p>
          Le relais ne peut pas supprimer ce qui a déjà été envoyé à ChatGPT ou à Soniox, ni ce qui a déjà été affiché
          sur votre téléphone ou vos lunettes. Les copies détenues par les fournisseurs, ainsi que les journaux et
          sauvegardes de l’hébergement et des fournisseurs, ne relèvent pas de ces engagements.
        </p>
      </section>

      <section aria-labelledby="background">
        <h2 id="background">Téléphone verrouillé et utilisation en arrière-plan</h2>
        <p>
          Tant que la session des lunettes reste active, l’application compagnon est conçue pour continuer à écouter «
          Hey dots », à enregistrer et à afficher les réponses même lorsque le téléphone est verrouillé ou que
          l’application Even est en arrière-plan. Qu’elle continue alors de fonctionner dépend de l’application Even et
          du système d’exploitation de votre téléphone. Fermer l’application compagnon, la déconnecter ou désactiver «
          Hey dots » arrête l’écoute.
        </p>
      </section>

      <section aria-labelledby="security">
        <h2 id="security">Sécurité</h2>
        <p>
          L’application compagnon communique avec le relais et Soniox uniquement via HTTPS et des WebSockets sécurisés.
          L’accès des appareils utilise des jetons propres à chaque appareil ; les actions sur le compte exigent votre
          connexion ChatGPT et sont limitées à vos propres données ; et les requêtes de clé et d’association sont
          limitées en fréquence. Aucun système n’est parfaitement sûr, et nous ne pouvons pas garantir que ces mesures
          empêchent tout abus.
        </p>
      </section>

      <section aria-labelledby="changes">
        <h2 id="changes">Modifications et contact</h2>
        <p>
          Si cet avis change, la version mise à jour et sa date d’entrée en vigueur seront publiées sur cette page. Pour
          toute question ou demande concernant vos informations, écrivez à{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Voir aussi les{" "}
          <Link href={policyPath("terms", "fr")}>{copy.fr.page.terms}</Link>.
        </p>
      </section>
    </>
  );
}
