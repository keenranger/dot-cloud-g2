import Link from "next/link";
import { CONTACT_EMAIL, RELAY_ORIGIN } from "../../components/policy-page";
import { copy, policyPath } from "../../i18n/dashboard";

// Spanish translation of the English Privacy Notice in ../page.tsx; same sections, lists and facts.
const d = copy.es.dashboard;
// The companion's disconnect button (even-app/src/messages/es.ts).
const companionDisconnect = "Desconectar y olvidar esta conexión";

export const description = "Qué procesa Lens MCP for G2, adónde va, cuánto tiempo lo conserva el relé y cómo borrarlo.";

export default function Body() {
  return (
    <>
      <section aria-labelledby="who">
        <h2 id="who">Quiénes somos</h2>
        <p>
          Lens MCP for G2 es un proyecto independiente publicado por <strong>keenranger</strong>. Consta de una app
          complementaria para las gafas Even Realities G2, distribuida a través de Even Hub, y de un sitio web de relé
          en <a href={RELAY_ORIGIN}>{RELAY_ORIGIN}</a>. Juntos conectan tus G2 con tu propio ChatGPT Dot. No es un
          producto oficial de Even Realities, OpenAI ni Soniox.
        </p>
        <p>
          Preguntas y solicitudes de privacidad: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </section>

      <section aria-labelledby="audio">
        <h2 id="audio">Audio del micrófono</h2>
        <ul>
          <li>
            La app complementaria solo usa el micrófono de las G2. Una grabación manual dura como máximo 30 segundos.
          </li>
          <li>
            La escucha de «Hey dots» está activada de forma predeterminada en cuanto la app complementaria está
            vinculada y tiene una clave de voz. Puedes desactivarla en la app complementaria, y tu elección se recuerda
            en el teléfono. Mientras está activada y la app complementaria se está ejecutando, el micrófono de las G2
            permanece abierto para poder detectar la palabra de activación.
          </li>
          <li>
            La detección de la palabra de activación se realiza en tu teléfono. El audio oído antes de la palabra de
            activación solo se guarda en búferes cortos y limitados del teléfono y no se envía a ningún sitio.
          </li>
          <li>
            Lo que dices después de la palabra de activación, o una grabación manual, se transmite desde tu teléfono
            directamente a Soniox para su transcripción, usando tu propia clave API de Soniox. Soniox trata ese audio
            según tu acuerdo con Soniox.
          </li>
          <li>
            Nuestro relé nunca recibe audio sin procesar. Su punto de transcripción en el servidor está desactivado y
            rechaza las solicitudes antes de leer ningún audio.
          </li>
        </ul>
      </section>

      <section aria-labelledby="soniox-key">
        <h2 id="soniox-key">Tu clave API de Soniox</h2>
        <p>
          Introduces tu propia clave de Soniox en tu teléfono. De forma predeterminada solo se guarda en memoria durante
          la sesión actual de la app. Si eliges recordarla, se guarda en el almacenamiento de la app Even Hub de ese
          teléfono. Puedes borrarla o sustituirla en cualquier momento. La clave solo se envía a Soniox, nunca a nuestro
          relé. La app complementaria no añade su propio cifrado a una clave recordada; es tan segura como tu teléfono y
          la app Even.
        </p>
      </section>

      <section aria-labelledby="text">
        <h2 id="text">Mensajes, transcripciones y respuestas</h2>
        <p>
          Los mensajes escritos, las transcripciones finales, las respuestas de Dot y los mensajes que tu Dot envía por
          su cuenta se guardan en el relé para poder entregarse entre tus G2 y ChatGPT. Junto con ellos, el relé guarda
          el identificador de tu cuenta, los identificadores de mensajes y dispositivos, marcas de tiempo y el estado de
          entrega. Los mensajes que tu Dot envía por su cuenta se entregan a todos los dispositivos vinculados a tu
          cuenta. Estos mensajes pueden contener cualquier información personal que decidas decir o escribir.
        </p>
        <p>
          La app complementaria guarda en la memoria del teléfono hasta 100 respuestas recientes, y recuerda tus
          elecciones de «Hey dots» y del envío automático por voz en el almacenamiento de la app Even Hub.
        </p>
      </section>

      <section aria-labelledby="account">
        <h2 id="account">Inicio de sesión, clave de conexión y dispositivos</h2>
        <ul>
          <li>
            Inicias sesión en el sitio web del relé con ChatGPT. La plataforma de alojamiento proporciona al relé un
            identificador de tu cuenta, que mantiene tus registros separados de los de otros usuarios. Tu sesión de
            ChatGPT no se copia en la app complementaria.
          </li>
          <li>
            Cada cuenta tiene como máximo una clave de conexión. No caduca y puede vincular más de un dispositivo. El
            relé guarda un hash SHA-256 de la clave para buscarla, y la propia clave cifrada con AES-256-GCM bajo un
            secreto del servidor, para que tú, con la sesión iniciada, puedas volver a verla más tarde. Este cifrado
            protege frente a la exposición de la base de datos por sí sola, no frente a un compromiso del servidor o de
            su secreto.
          </li>
          <li>
            El panel muestra la clave oculta de forma predeterminada. Solo aparece después de que elijas «{d.showKey}»,
            solo se puede copiar mientras se muestra y solo se guarda en la memoria de la página, nunca en el
            almacenamiento del navegador.
          </li>
          <li>
            Crear una clave nueva («{d.createNewKey}») sustituye a la anterior de inmediato; revocarla («{d.revokeKey}»)
            la elimina. Los dispositivos ya vinculados siguen vinculados en ambos casos. «{d.revokeAll}» elimina la
            clave y desconecta todos tus dispositivos.
          </li>
          <li>
            Los dispositivos vinculados antes de que existieran las claves de conexión siguen vinculados. Los códigos de
            vinculación de corta duración que se usaban entonces no podían volver a mostrarse y ya han caducado.
          </li>
          <li>
            Vincular un dispositivo crea un registro de dispositivo y un token de dispositivo. El relé solo guarda el
            token como hash. La app complementaria guarda el token y la dirección del relé en el almacenamiento de la
            app Even Hub del teléfono.
          </li>
          <li>
            Cuando tu Dot se suscribe a eventos, el relé guarda la suscripción, su dirección de devolución de llamada y
            su secreto de firma. Una suscripción dura una hora de forma predeterminada (entre un minuto y un día) y se
            puede cancelar.
          </li>
          <li>El relé mantiene contadores de solicitudes de corta duración para limitar el abuso.</li>
        </ul>
      </section>

      <section aria-labelledby="recipients">
        <h2 id="recipients">Adónde va la información</h2>
        <ul>
          <li>
            <strong>Nuestro relé</strong>, alojado en la plataforma Sites que usa este proyecto: el texto, los
            identificadores y los registros de conexión descritos arriba. Nunca audio ni tu clave de Soniox.
          </li>
          <li>
            <strong>Soniox</strong> (<code>stt-rt.soniox.com</code>): el audio que envías para transcribir y tu clave.
          </li>
          <li>
            <strong>ChatGPT (tu Dot)</strong> y la devolución de llamada MCP que registra: tus mensajes y
            transcripciones, y las respuestas que devuelve.
          </li>
          <li>
            <strong>Even Realities</strong> (app) y el sistema operativo de tu teléfono: alojan la app complementaria,
            conectan el micrófono y la pantalla de las gafas y contienen el almacenamiento de la app Even Hub.
          </li>
        </ul>
        <p>
          Cada proveedor trata los datos según sus propias condiciones y políticas. La app complementaria y el código
          del relé de este proyecto no incluyen herramientas de analítica ni de publicidad. No hemos auditado dónde
          guardan los proveedores los datos, sus registros ni sus copias de seguridad.
        </p>
      </section>

      <section aria-labelledby="retention">
        <h2 id="retention">Cuánto tiempo conserva el relé las conversaciones</h2>
        <ul>
          <li>
            <strong>Límite de 30 días.</strong> 30 días después de crearse un mensaje, una transcripción o una respuesta
            (UTC), el relé deja de mostrarlo, entregarlo, reintentarlo o responderlo, se haya eliminado ya físicamente o
            no.
          </li>
          <li>
            <strong>Borrar ahora.</strong> Con la sesión iniciada en el sitio web del relé, puedes borrar todas tus
            conversaciones a la vez con «{d.deleteForever}». El contenido se elimina de inmediato. El relé solo conserva
            una marca breve y sin contenido por cada elemento borrado para que un reintento tardío no pueda volver a
            guardarlo, y la app complementaria vacía su historial en pantalla la próxima vez que busca respuestas. Tus
            dispositivos, tu clave de conexión y la suscripción de Dot no se ven afectados.
          </li>
          <li>
            <strong>Eliminación física.</strong> Hay una limpieza diaria programada a las 03:00, hora de Corea
            (Asia/Seoul). Cada ejecución elimina de forma permanente hasta 20.000 registros que han superado el límite
            de 30 días; lo que exceda esa cantidad espera a una ejecución posterior. Por tanto, la eliminación puede
            producirse hasta aproximadamente un día después del límite, y más tarde si una ejecución falla o se acumula
            un retraso. Aún no se ha observado que la limpieza programada se ejecute por sí sola, así que no prometemos
            la eliminación en un día concreto. Algunos registros caducados también pueden eliminarse antes cuando se
            envían mensajes nuevos.
          </li>
          <li>
            Las marcas sin contenido que deja un borrado o una limpieza se conservan 30 días y luego las elimina la
            misma limpieza.
          </li>
          <li>
            La clave de conexión se conserva hasta que la sustituyes o la revocas, o desconectas todos los dispositivos.
            Los códigos, suscripciones y contadores de solicitudes caducados dejan de funcionar al caducar, pero no se
            eliminan según un calendario.
          </li>
        </ul>
        <p>
          Desconectar todos los dispositivos les retira el acceso, pero no elimina las conversaciones; para eso usa «
          {d.deleteForever}». «{companionDisconnect}» en la app complementaria solo borra el token guardado en ese
          teléfono.
        </p>
        <p>
          El relé no puede eliminar lo que ya se ha enviado a ChatGPT o a Soniox, ni lo que ya se ha mostrado en tu
          teléfono o en tus gafas. Las copias que conservan los proveedores, así como los registros y copias de
          seguridad del alojamiento y de los proveedores, quedan fuera de estos compromisos.
        </p>
      </section>

      <section aria-labelledby="background">
        <h2 id="background">Teléfono bloqueado y uso en segundo plano</h2>
        <p>
          Mientras la sesión de las gafas siga activa, la app complementaria está diseñada para seguir escuchando «Hey
          dots», grabando y mostrando respuestas incluso con el teléfono bloqueado o la app Even en segundo plano. Que
          siga funcionando entonces depende de la app Even y del sistema operativo de tu teléfono. Cerrar la app
          complementaria, desconectarla o desactivar «Hey dots» detiene la escucha.
        </p>
      </section>

      <section aria-labelledby="security">
        <h2 id="security">Seguridad</h2>
        <p>
          La app complementaria se comunica con el relé y con Soniox solo mediante HTTPS y WebSockets seguros. El acceso
          de los dispositivos usa tokens propios de cada dispositivo; las acciones de la cuenta requieren tu inicio de
          sesión en ChatGPT y se limitan a tus propios registros; y las solicitudes de clave y de vinculación tienen
          límite de frecuencia. Ningún sistema es perfectamente seguro, y no podemos garantizar que estas medidas
          impidan cualquier uso indebido.
        </p>
      </section>

      <section aria-labelledby="changes">
        <h2 id="changes">Cambios y contacto</h2>
        <p>
          Si este aviso cambia, la versión actualizada y su fecha de entrada en vigor se publicarán en esta página. Para
          preguntas o solicitudes sobre tu información, escribe a{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Consulta también las{" "}
          <Link href={policyPath("terms", "es")}>{copy.es.page.terms}</Link>.
        </p>
      </section>
    </>
  );
}
