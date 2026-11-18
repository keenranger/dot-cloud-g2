import Link from "next/link";
import { CONTACT_EMAIL, RELAY_ORIGIN } from "../../components/policy-page";
import { copy, policyPath } from "../../i18n/dashboard";

// French translation of the English Terms of Use in ../page.tsx; same sections, lists and facts.
const privacy = copy.fr.page.privacy;

export const description = "Ce que fournit Lens MCP for G2, ce dont il a besoin de votre part et ses limites.";

export default function Body() {
  return (
    <>
      <p>
        Ces conditions s’appliquent à l’application compagnon Lens MCP for G2 et au site relais à l’adresse{" "}
        <a href={RELAY_ORIGIN}>{RELAY_ORIGIN}</a>, publiés par <strong>keenranger</strong>. Veuillez les lire avec l’
        <Link href={policyPath("privacy", "fr")}>{privacy}</Link>.
      </p>

      <section aria-labelledby="service">
        <h2 id="service">1. Le service</h2>
        <p>
          Lens MCP for G2 connecte vos lunettes Even Realities G2 à votre propre ChatGPT Dot via MCP : il transmet ce
          que vous dites ou tapez à votre Dot et affiche ses réponses sur les lunettes. Ce n’est pas un client MCP
          généraliste, et il ne promet pas de fonctionner avec tous les serveurs ou agents MCP.
        </p>
      </section>

      <section aria-labelledby="needs">
        <h2 id="needs">2. Ce qu’il vous faut</h2>
        <ul>
          <li>Des lunettes G2 et un téléphone avec une application Even compatible (version 2.2.10 ou ultérieure).</li>
          <li>Un accès réseau, et un compte ChatGPT avec un Dot connecté au relais.</li>
          <li>Pour la saisie vocale, votre propre compte Soniox et votre propre clé API.</li>
        </ul>
      </section>

      <section aria-labelledby="accounts">
        <h2 id="accounts">3. Vos comptes, clés et frais</h2>
        <p>
          Vous contrôlez les comptes et les clés que vous utilisez avec le service et devez avoir le droit de les
          utiliser. Les services ChatGPT, Soniox et Even Realities sont fournis selon leurs propres conditions, et les
          frais qu’ils facturent, comme l’utilisation de Soniox pour la transcription, sont à votre charge.
          L’application n’inclut aucun crédit de transcription payant et ne crée pas de comptes chez les fournisseurs
          pour vous.
        </p>
        <p>
          Traitez votre clé de connexion comme un mot de passe. Toute personne qui la possède peut associer un nouvel
          appareil à votre compte jusqu’à ce que vous créiez une nouvelle clé ou la révoquiez. Vous pouvez déconnecter
          tous vos appareils depuis le site relais.
        </p>
      </section>

      <section aria-labelledby="limits">
        <h2 id="limits">4. Limites et utilisation sûre</h2>
        <ul>
          <li>
            Les transcriptions peuvent contenir des erreurs, et les réponses de Dot peuvent être fausses. Vérifiez-les
            avant de vous y fier.
          </li>
          <li>
            N’utilisez pas le service en cas d’urgence ni à la place d’un avis professionnel médical, juridique ou
            financier.
          </li>
          <li>
            Ne regardez vos lunettes ou n’interagissez avec elles que lorsque vous pouvez le faire en toute sécurité.
          </li>
          <li>
            Le fonctionnement avec un téléphone verrouillé ou en arrière-plan dépend de l’application Even et du système
            d’exploitation de votre téléphone et n’est pas garanti.
          </li>
          <li>Il s’agit d’un projet indépendant. Il peut changer, être interrompu ou être arrêté.</li>
        </ul>
      </section>

      <section aria-labelledby="use">
        <h2 id="use">5. Utilisation acceptable</h2>
        <p>
          N’utilisez pas le service pour enfreindre la loi, pour accéder aux données ou aux appareils d’une autre
          personne, ni pour perturber le relais ou les services auxquels il se connecte.
        </p>
      </section>

      <section aria-labelledby="exit">
        <h2 id="exit">6. Arrêter l’utilisation</h2>
        <p>
          Vous pouvez à tout moment désactiver « Hey dots », arrêter un enregistrement, effacer votre clé Soniox,
          déconnecter l’application compagnon, révoquer votre clé de connexion, déconnecter tous vos appareils et
          effacer vos conversations, comme décrit dans l’<Link href={policyPath("privacy", "fr")}>{privacy}</Link>. Les
          données détenues par d’autres fournisseurs restent soumises à leurs propres contrôles.
        </p>
      </section>

      <section aria-labelledby="independence">
        <h2 id="independence">7. Indépendance</h2>
        <p>
          Ce projet n’est ni affilié à Even Realities, OpenAI ou Soniox, ni approuvé par eux. Leurs noms sont utilisés
          uniquement pour décrire la compatibilité avec leurs produits et services.
        </p>
      </section>

      <section aria-labelledby="contact">
        <h2 id="contact">8. Modifications et contact</h2>
        <p>
          Si ces conditions changent, la version mise à jour et sa date d’entrée en vigueur seront publiées sur cette
          page. Questions : <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </section>
    </>
  );
}
