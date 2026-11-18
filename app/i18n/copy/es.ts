import type { Copy } from "../dashboard";
import { PRODUCT_NAME } from "../product";

export const es: Copy = {
  dateLocale: "es-ES",
  languageName: "Español",
  page: {
    home: `Inicio de ${PRODUCT_NAME}`,
    headerNote: "PARA EVEN G2 × CHATGPT DOT",
    language: "Idioma",
    signOut: "Cerrar sesión",
    eyebrow: "PREGUNTA SIN SACAR EL TELÉFONO",
    titleLines: ["Pregunta desde tus gafas.", "Lee la respuesta de Dot ahí mismo."],
    intro: "Habla con tu ChatGPT Dot desde Even G2 y lee la respuesta en tus lentes.",
    needs:
      "Necesitarás tus G2 conectadas a la app Even Hub de tu teléfono, ChatGPT en el navegador de un ordenador para una configuración única y una cuenta de Soniox si quieres preguntar por voz.",
    flowLabel: "Cómo funciona",
    flow: ["Hablas en las G2", "Dot responde", "Lo lees en las G2"],
    signInEyebrow: "EMPEZAR",
    signInTitle: "Inicia sesión para configurar tus gafas",
    signInBody:
      "Inicia sesión con tu cuenta de ChatGPT para vincular tus G2 y conectar tu Dot. No tienes que instalar nada en tu ordenador.",
    signIn: "Iniciar sesión con ChatGPT",
    previewTitle: "Versión preliminar",
    previewBody:
      "Las respuestas de Dot a tus gafas aún se están probando en dispositivos reales, así que es posible que algunas respuestas todavía no lleguen.",
    footer: "Tus gafas y tu Dot, conectados.",
    policies: "Políticas",
    privacy: "Aviso de privacidad",
    terms: "Condiciones de uso",
    apply: "Aplicar",
    support: "Ayuda y comentarios",
    supportGuide: "Guía de uso y código fuente en GitHub",
    supportIssues: "Preguntas y solicitudes de funciones en GitHub Issues",
    newTab: "(se abre en una pestaña nueva)",
    metaTitle: "ChatGPT Dot en tus gafas G2",
    metaDescription: "Habla con tu ChatGPT Dot desde Even G2 y lee las respuestas en tus gafas.",
  },
  policy: {
    formerly: "antes Lens MCP for G2",
    effective: "Vigente desde",
    englishVersion: "Versión en inglés",
  },
  notFound: {
    title: "Página no encontrada",
    body: "Esta página no existe o se ha movido.",
    home: "Ir a la página de inicio",
  },
  error: {
    title: "Algo salió mal",
    body: "No se pudo mostrar esta página. Vuelve a intentarlo o ve a la página de inicio. Si sigue ocurriendo, avísanos en GitHub Issues.",
    retry: "Reintentar",
    home: "Ir a la página de inicio",
  },
  dashboard: {
    eyebrow: "TU CONEXIÓN",
    title: "Tu configuración",
    refresh: "Actualizar estado",
    checking: "Comprobando…",
    statusLabel: "Estado de la conexión",
    statusChecking: "Comprobando",
    statusUnavailable: "No disponible",
    devices: "Gafas vinculadas",
    deviceCount: (n) => `${n}`,
    dot: "Dot",
    dotSubscribed: "Escuchando",
    dotWaiting: "Aún sin conectar",
    pending: "Preguntas a la espera de Dot",
    pendingCount: (n) => `${n}`,
    speech: "Entrada de voz",
    speechValue: "Compruébalo en la app del teléfono",
    delivery: {
      accepted: "Dot la recibió",
      http_4xx: "Dot la rechazó",
      http_5xx: "Dot tuvo un problema",
      http_other: "Respuesta inesperada",
      timeout: "Dot tardó demasiado",
      network: "Problema de red",
      invalid_response: "Respuesta ilegible",
    },
    lastDelivery: (label, at, awaiting, retrying, stopped) =>
      `Última pregunta enviada a Dot: ${label}, ${at}. Esperando respuesta: ${awaiting}. Reintento pendiente: ${retrying}. Reintentos detenidos: ${stopped}. «Recibida» significa que Dot recibió la pregunta, no que la haya respondido ni que la respuesta esté en tus gafas.`,

    pairTitle: "Paso 1: vincula tus gafas",
    pairBody: `En tu teléfono, abre ${PRODUCT_NAME} en la app Even Hub e introduce la dirección del servidor y la clave de conexión que aparecen abajo. Mantén tus G2 conectadas al teléfono. Esto es independiente de tu inicio de sesión en ChatGPT.`,
    serverAddress: "Dirección del servidor",
    addressPending: "Obteniendo la dirección…",
    keyHelp:
      "Tu clave de conexión nunca caduca y sirve para todas tus gafas. Permanece oculta hasta que eliges «Mostrar clave». Si creas una clave nueva o revocas esta, la clave anterior ya no podrá vincular gafas nuevas; las gafas ya vinculadas siguen funcionando.",
    keyLabel: "Clave de conexión",
    keyHidden: "Oculta. Elige «Mostrar clave».",
    showKey: "Mostrar clave",
    hideKey: "Ocultar clave",
    copy: "Copiar",
    copyLabel: (label) => `Copiar ${label.charAt(0).toLowerCase()}${label.slice(1)}`,
    keyCreated: (at) => `Creada el ${at} · nunca caduca`,
    legacyCode: (expires) =>
      `Todavía hay activo un código de vinculación antiguo de 10 minutos${expires ? ` (caduca el ${expires})` : ""}. No se puede volver a mostrar, así que crea una clave de conexión una sola vez. La clave nueva nunca caduca.`,
    keyUnavailable:
      "No pudimos comprobar tu clave de conexión. Elige «Actualizar estado» para volver a intentarlo; podrás crear una clave cuando la comprobación funcione.",
    createKey: "Crear clave de conexión",
    createNewKey: "Crear clave nueva",
    creatingKey: "Creando clave…",
    revokeKey: "Revocar clave",
    revokingKey: "Revocando…",
    confirmRotate:
      "Después de crear una clave nueva, la clave actual ya no podrá vincular gafas nuevas. Las gafas ya vinculadas siguen funcionando. ¿Crear una clave nueva?",
    confirmRevoke:
      "Después de revocar la clave, no se podrán vincular gafas nuevas hasta que crees otra. Las gafas ya vinculadas siguen funcionando. ¿Revocar la clave?",
    cancel: "Cancelar",

    dotTitle: "Paso 2: conecta ChatGPT Dot",
    dotBody:
      "Así tu Dot podrá oír tus preguntas y responder en tus gafas. Para este paso no necesitas la clave de conexión.",
    dotSteps: [
      "En un ordenador, abre ChatGPT en un navegador web, añade la dirección de abajo como conector personalizado e instálalo. Omite este paso si ya lo añadiste.",
      "Envía a tu Dot el mensaje de configuración de abajo. Después podrás seguir hablando con el mismo Dot en la app móvil de ChatGPT.",
    ],
    mcpAddress: "Dirección del conector (MCP)",
    promptLabel: "Mensaje de configuración para Dot",
    copyPrompt: "Copiar mensaje de configuración",
    dotPrompt: (connector) =>
      `Suscríbete al evento "utterance.created" del conector en ${connector || "la dirección /mcp de este sitio"} con la session "g2". Cuando llegue una nueva pregunta de voz, respóndela en el idioma en que se hizo y luego llama a reply_to_g2 con el mismo utterance_id que recibiste y tu respuesta como text. Antes de un trabajo lento, como buscar o usar herramientas, llama primero a acknowledge_g2_utterance con el mismo utterance_id y una nota breve, con tus propias palabras, sobre lo que vas a hacer; no envíes un mensaje genérico de «recibido». No me digas que estás conectado hasta que haya llegado realmente un evento.`,

    speechTitle: "Paso 3: activa las preguntas por voz",
    speechBody:
      "Para preguntar por voz, añade tu propia clave API de Soniox en la app del teléfono. Puedes omitir este paso si solo escribes tus preguntas. Nunca introduzcas la clave en este sitio web.",
    speechSteps: [
      "En tu cuenta de Soniox, crea una clave API que permita la transcripción en tiempo real (real-time transcription).",
      `En la app Even Hub de tu teléfono, abre los ajustes de ${PRODUCT_NAME} y pega la clave.`,
      "La clave solo se guarda mientras la app está abierta. Elige «Recordar» para conservarla en tu teléfono; puedes borrarla o sustituirla en cualquier momento en los mismos ajustes.",
    ],
    sonioxGuide: "Cómo configurar los permisos de la clave de Soniox (se abre en una pestaña nueva)",
    speechPrivacy:
      "Tu voz va directamente de tu teléfono a Soniox, que la convierte en texto; solo ese texto llega a este servicio y a tu Dot. Soniox factura a tu propia cuenta. Una clave recordada es tan segura como tu teléfono y la app Even Hub; no se cifra por separado.",

    revokeAllBody:
      "Desconecta todas las gafas de tu cuenta y revoca tu clave de conexión. Para volver a usarlas, vincúlalas con una clave nueva.",
    revokeAll: "Desconectar todas las gafas",
    revokingAll: "Desconectando…",
    deleteBody:
      "Elimina ahora de este servicio tu historial de conversaciones (tus preguntas, las respuestas de Dot y las notificaciones). Tus gafas vinculadas y la conexión con Dot no cambian.",
    deleteConfirm:
      "Esto no se puede deshacer. Lo que ya se haya enviado a ChatGPT (Dot) o a Soniox, o ya se haya mostrado en tu teléfono, no se puede borrar desde aquí. ¿Eliminar tu historial?",
    deleteForever: "Eliminar el historial para siempre",
    deleting: "Eliminando…",
    deleteStart: "Eliminar historial de conversaciones",

    askTitle: "Paso 4: pregunta desde tus G2",
    askBody:
      "Después de los pasos 1 y 2, escribe una pregunta en la app del teléfono, o habla cuando hayas completado el paso 3. La respuesta de Dot aparece en tus gafas.",

    copied: "Copiado.",
    copyUnavailable: "No se pudo copiar automáticamente. Selecciona el texto y cópialo tú.",
    keyShown: "Clave de conexión mostrada.",
    keyCreatedNotice:
      "Se ha creado una clave de conexión nueva. Elige «Mostrar clave» e introdúcela en la app Even Hub. La clave anterior ya no puede vincular gafas nuevas; las gafas ya vinculadas siguen funcionando.",
    keyRevokedNotice:
      "Clave de conexión revocada. No se pueden vincular gafas nuevas hasta que crees una clave; las gafas ya vinculadas siguen funcionando.",
    sessionExpired: "Tu sesión ha caducado. Vuelve a iniciar sesión.",
    rateLimited: "Demasiados intentos. Espera un minuto y vuelve a intentarlo.",
    keyServiceUnavailable:
      "Ahora mismo no se pueden crear ni mostrar claves de conexión. Tu clave actual y tus gafas vinculadas siguen funcionando.",
    keyNotRevealable:
      "Esta clave no se puede volver a mostrar. Tus gafas vinculadas siguen funcionando; crea una clave nueva si la necesitas.",
    keyFailed: {
      create: "No se pudo crear la clave de conexión. Vuelve a intentarlo en un momento.",
      reveal: "No se pudo mostrar la clave de conexión. Vuelve a intentarlo en un momento.",
      withdraw: "No se pudo revocar la clave de conexión. Vuelve a intentarlo en un momento.",
    },
    keyUnconfirmed:
      "No pudimos confirmar la clave nueva para la cuenta con la sesión iniciada ahora. Elige «Actualizar estado» para ver tu clave actual.",
    keyMismatch:
      "Tu clave cambió desde que se cargó esta página, así que no se mostró. Lo hemos comprobado de nuevo; elige «Mostrar clave» otra vez.",
    statusFailed: "No se pudo cargar el estado de tu conexión. Vuelve a intentarlo.",
    statusUnknown: "No se pudo comprobar el estado de tu conexión.",
    revokeAllFailed: "No se pudieron desconectar tus gafas. Vuelve a intentarlo.",
    revokedAll:
      "Todas tus gafas están desconectadas y tu clave de conexión está revocada. Crea una clave nueva para volver a vincularlas.",
    deleteFailed: "No se pudo eliminar tu historial de conversaciones. Vuelve a intentarlo en un momento.",
    deleted: (n) =>
      `Se ${n === 1 ? "eliminó 1 elemento" : `eliminaron ${n} elementos`} de tu historial de conversaciones. Tus gafas vinculadas y la conexión con Dot no han cambiado.`,
  },
};
