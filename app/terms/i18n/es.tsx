import Link from "next/link";
import { CONTACT_EMAIL, RELAY_ORIGIN } from "../../components/policy-page";
import { copy, policyPath } from "../../i18n/dashboard";

// Spanish translation of the English Terms of Use in ../page.tsx; same sections, lists and facts.
const privacy = copy.es.page.privacy;

export const description = "Qué ofrece Lens MCP for G2, qué necesita de ti y cuáles son sus límites.";

export default function Body() {
  return (
    <>
      <p>
        Estas condiciones se aplican a la app complementaria Lens MCP for G2 y al sitio web del relé en{" "}
        <a href={RELAY_ORIGIN}>{RELAY_ORIGIN}</a>, publicados por <strong>keenranger</strong>. Léelas junto con el{" "}
        <Link href={policyPath("privacy", "es")}>{privacy}</Link>.
      </p>

      <section aria-labelledby="service">
        <h2 id="service">1. El servicio</h2>
        <p>
          Lens MCP for G2 conecta tus gafas Even Realities G2 con tu propio ChatGPT Dot mediante MCP: transmite a tu Dot
          lo que dices o escribes y muestra sus respuestas en las gafas. No es un cliente MCP de uso general y no
          promete funcionar con todos los servidores o agentes MCP.
        </p>
      </section>

      <section aria-labelledby="needs">
        <h2 id="needs">2. Qué necesitas</h2>
        <ul>
          <li>Gafas G2 y un teléfono con una app Even compatible (versión 2.2.10 o posterior).</li>
          <li>Acceso a la red y una cuenta de ChatGPT con un Dot conectado al relé.</li>
          <li>Para la entrada de voz, tu propia cuenta de Soniox y tu propia clave API.</li>
        </ul>
      </section>

      <section aria-labelledby="accounts">
        <h2 id="accounts">3. Tus cuentas, claves y cargos</h2>
        <p>
          Tú controlas las cuentas y claves que usas con el servicio y debes tener derecho a usarlas. Los servicios de
          ChatGPT, Soniox y Even Realities se prestan según sus propias condiciones, y cualquier cargo que generen, como
          el uso de Soniox para la transcripción, corre de tu cuenta. La app no incluye crédito de transcripción de pago
          y no crea cuentas de proveedores por ti.
        </p>
        <p>
          Trata tu clave de conexión como una contraseña. Cualquiera que la tenga puede vincular un dispositivo nuevo a
          tu cuenta hasta que crees una clave nueva o la revoques. Puedes desconectar todos tus dispositivos desde el
          sitio web del relé.
        </p>
      </section>

      <section aria-labelledby="limits">
        <h2 id="limits">4. Limitaciones y uso seguro</h2>
        <ul>
          <li>
            Las transcripciones pueden contener errores y las respuestas de Dot pueden ser incorrectas. Compruébalas
            antes de confiar en ellas.
          </li>
          <li>
            No uses el servicio para emergencias ni como sustituto de asesoramiento profesional médico, jurídico o
            financiero.
          </li>
          <li>Mira tus gafas o interactúa con ellas solo cuando sea seguro hacerlo.</li>
          <li>
            El funcionamiento con el teléfono bloqueado o en segundo plano depende de la app Even y del sistema
            operativo de tu teléfono y no está garantizado.
          </li>
          <li>Este es un proyecto independiente. Puede cambiar, interrumpirse o dejar de ofrecerse.</li>
        </ul>
      </section>

      <section aria-labelledby="use">
        <h2 id="use">5. Uso aceptable</h2>
        <p>
          No uses el servicio para infringir la ley, para acceder a los registros o dispositivos de otra persona ni para
          perturbar el relé o los servicios a los que se conecta.
        </p>
      </section>

      <section aria-labelledby="exit">
        <h2 id="exit">6. Dejar de usar el servicio</h2>
        <p>
          Puedes desactivar «Hey dots», detener una grabación, borrar tu clave de Soniox, desconectar la app
          complementaria, revocar tu clave de conexión, desconectar todos tus dispositivos y borrar tus conversaciones
          en cualquier momento, tal como se describe en el <Link href={policyPath("privacy", "es")}>{privacy}</Link>.
          Los datos que conservan otros proveedores siguen sujetos a sus propios controles.
        </p>
      </section>

      <section aria-labelledby="independence">
        <h2 id="independence">7. Independencia</h2>
        <p>
          Este proyecto no está afiliado a Even Realities, OpenAI ni Soniox, ni cuenta con su respaldo. Sus nombres se
          usan solo para describir la compatibilidad con sus productos y servicios.
        </p>
      </section>

      <section aria-labelledby="contact">
        <h2 id="contact">8. Cambios y contacto</h2>
        <p>
          Si estas condiciones cambian, la versión actualizada y su fecha de entrada en vigor se publicarán en esta
          página. Preguntas: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </section>
    </>
  );
}
