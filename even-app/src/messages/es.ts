import type { Messages } from "./en.ts";

/** Spanish. */
export const es: Messages = {
  languageShown: "La app se muestra en español.",

  idle(state, app) {
    if (!state.restored) return `${app} · Comprobando tu conexión guardada.`;
    if (!state.connected)
      return `${app} · Conéctate en la app del teléfono con la dirección del servidor y la clave de conexión.`;
    if (!state.transcriber)
      return `${app} · Para preguntar por voz, añade tu clave de Soniox en la app del teléfono. También puedes escribir y enviar.`;
    return `${app} · Mantén pulsado, haz tu pregunta y suelta.`;
  },
  edge(count, delta) {
    if (!count) return "Sin respuestas";
    return delta < 0 ? "Primera respuesta" : "Última respuesta";
  },
  splitMarkers: { continues: "\n(continúa)", continued: "(continuación)\n" },
  captionLive: "Transcripción en directo (provisional)",
  captionFinishing: "Terminando la transcripción · provisional · aún no enviada",
  wakeBlocked: {
    settings: "Hey dots · Cargando ajustes",
    enabled: "Hey dots desactivado · Micrófono apagado",
    active: "Hey dots en pausa · Abre la app en G2",
    ready: "Hey dots · Esperando a G2",
    connected: "Hey dots · Conéctate en la app",
    transcriber: "Hey dots · Añade la clave de Soniox",
    manual: "Hey dots en pausa · Grabación manual",
    busy: "Hey dots en pausa · Terminando solicitud",
    draft: "Hey dots en pausa · Envía o borra el borrador",
  },
  g2Mic: {
    micOff: "Micrófono apagado",
    micTurningOff: "Apagando el micrófono",
    micStopUnconfirmed: "Micrófono quizá aún encendido",
    wakeOffMicOff: "Hey dots desactivado · Micrófono apagado",
    wakeNoKeyMicOff: "Sin clave de Soniox · Micrófono apagado",
    wakePausedMicOff: "Hey dots en pausa · Micrófono apagado",
    wakePreparing: "Preparando Hey dots",
    wakeHeardNow: "Micrófono encendido · Hey dots detectado",
    wakeStopped: "Hey dots detenido",
    wakeMicStarting: "Encendiendo micrófono",
    manualMicStarting: "Encendiendo micrófono",
    micOffProcessing: "Micrófono apagado · procesando",
    micOnWake: "Micrófono encendido · esperando Hey dots",
    micOnRecording: "Micrófono encendido · grabando",
    recordingNoSound: "Micrófono encendido · grabando · sin sonido",
    wakeListeningNoSound: "Micrófono encendido · Hey dots · sin sonido",
  },
  g2MicCore: { on: "Micro encendido", off: "Micro apagado", unsure: "¿Micro encendido?" },

  requestFailure(kind, submission) {
    const cause = {
      timeout: "El servidor no respondió en 45 segundos, así que se canceló la solicitud. Revisa tu red.",
      cancelled: "La app se cerró o se cambió en las gafas, así que se canceló la solicitud al servidor.",
      network: "No se pudo contactar con el servidor. Revisa tu conexión de red.",
    }[kind];
    return submission
      ? `${cause} No se sabe si el servidor lo guardó. Si se guardó, la respuesta no se cancela y aparecerá aquí cuando llegue.`
      : cause;
  },
  stt(error) {
    switch (error.kind) {
      case "credential":
        return "No se puede usar esta clave de Soniox. Vuelve a introducir tu clave en los ajustes.";
      case "provider":
        return error.status === 401 || error.status === 403
          ? "Soniox no aceptó la clave. Revísala en la Soniox Console o sustitúyela por una nueva."
          : `Soniox no pudo transcribir esto${error.status === undefined ? "" : ` (código ${error.status})`}. Inténtalo de nuevo.`;
      case "timeout":
        return "Soniox tardó demasiado en responder. Inténtalo de nuevo.";
      case "connection":
        return "No se pudo contactar con Soniox. Revisa tu red e inténtalo de nuevo.";
      case "invalid-audio":
        return "No se pudo leer la grabación.";
      case "no-audio":
        return "No llegó sonido del micrófono de G2, así que no se transcribió nada. Mantén pulsado para hablar de nuevo.";
      case "protocol":
        return "Soniox envió una respuesta que no se pudo leer. Inténtalo de nuevo.";
      case "aborted":
        return "Se canceló la transcripción.";
      case "overflow":
        return "El envío a Soniox se quedó atrás respecto a la grabación y se detuvo. Revisa tu red e inténtalo de nuevo.";
    }
  },
  thrown: {
    relayOrigin: "Introduce solo la dirección HTTPS del servidor, sin nada detrás.",
    pairCode: "Pega la clave de conexión completa de 64 caracteres (0-9, a-f) que muestra el panel de tu servidor.",
    emptyRecording: "La grabación está vacía o no se pudo leer.",
    invalidRecording: "No se pudo leer la grabación.",
    noSpeech: "No se reconoció ninguna voz. Dilo de nuevo.",
    sonioxKey: "Eso no parece una clave de Soniox. Pega la clave completa copiada de la Soniox Console.",
  },

  page: {
    lede: "Pregunta a Dot por voz y lee las respuestas en tus gafas.",
    "language-label": "Idioma · Language",
    "pair-legend": "Conectar con tu servidor",
    "origin-label": "Dirección del servidor (HTTPS)",
    "origin-hint": "No añadas /mcp al final. /mcp solo sirve para conectar ChatGPT.",
    "dashboard-link-text": "Obtener una clave de conexión en tu panel",
    "dashboard-link-note": "(se abre en el navegador)",
    "copy-dashboard": "Copiar la dirección del panel",
    "dashboard-steps":
      "En el panel, inicia sesión, crea una clave de conexión (o consulta tu clave) y cópiala. Después vuelve aquí, pégala y toca Conectar.",
    "dashboard-fallback":
      "Si el enlace no se abre, copia la dirección de abajo y ábrela en el navegador de tu teléfono. Para volver, abre de nuevo esta pantalla desde la app Even.",
    "dashboard-address-label": "Dirección del panel (mantén pulsado para copiar)",
    "code-label": "Clave de conexión",
    "code-hint": "Pega la clave de conexión de 64 caracteres que creaste en el panel de tu servidor.",
    "pair-submit": "Conectar",
    disconnect: "Desconectar y olvidar esta conexión",
    "soniox-legend": "Transcripción de voz (tu clave de Soniox)",
    "soniox-get-intro":
      "Para preguntar por voz necesitas tu propia clave API de Soniox. Regístrate o inicia sesión en la Soniox Console, crea una clave API y pégala abajo.",
    "soniox-console-text": "Obtener una clave API de Soniox",
    "soniox-console-note": "(abre la Soniox Console en el navegador)",
    "soniox-privacy":
      "Tu voz va directamente de este teléfono a Soniox para convertirse en texto, y solo ese texto se envía a tu servidor. Tu clave y tu audio nunca llegan al servidor. Por seguridad, crea en la Soniox Console una clave aparte solo para esta app.",
    "soniox-key-label": "Clave API de Soniox",
    "soniox-remember-text": "Recordar la clave en este teléfono",
    "soniox-remember-hint":
      "Si está desactivado, la clave solo se guarda hasta que cierres la app. Cambiarlo con una clave configurada la guarda o la elimina al instante. La clave se guarda en el almacenamiento de la app Even, que puede no estar cifrado.",
    "soniox-apply": "Usar esta clave",
    "soniox-clear": "Eliminar clave",
    voice: "Preguntar a Dot",
    "voice-note":
      "En G2, mantén pulsado, habla y suelta. Lo que dices se convierte en texto y se envía a Dot automáticamente. Hasta 30 segundos; requiere una clave de Soniox.",
    "auto-send-text": "Enviar automáticamente tras la transcripción (desactívalo para revisar antes de enviar)",
    "wake-text":
      "Hey dots manos libres (activado por defecto; usa el micrófono de G2 mientras la app está abierta en G2)",
    "wake-hint":
      "El micrófono de G2 solo se abre cuando G2 está lista, estás conectado y hay una clave de Soniox configurada. Este teléfono detecta la palabra de activación por sí mismo mientras la app está abierta en G2, y sigue escuchando y comprobando respuestas aunque la pantalla se apague o se bloquee; la app Even y los límites de segundo plano de tu teléfono pueden afectar a esto. No se usa el micrófono del teléfono. Di Hey dots (pronunciación inglesa) y luego tu pregunta: solo la pregunta que sigue se transcribe con Soniox y se envía a tu servidor como texto. Si no responde, mantén pulsado para hablar. Al desactivarlo, deja de escuchar al instante.",
    record: "Empezar a grabar",
    stop: "Detener y transcribir",
    "text-label": "Mensaje (puedes escribir en vez de hablar)",
    send: "Enviar a Dot",
    "reply-title": "Respuestas de Dot",
    "prev-message": "Mensaje anterior",
    "next-message": "Mensaje siguiente",
    prev: "Parte anterior en G2",
    next: "Parte siguiente en G2",
    "help-title": "Ayuda y comentarios",
    "help-note":
      "La página del proyecto en GitHub tiene la guía de uso y el código fuente. Haz preguntas o pide funciones en GitHub Issues.",
    "guide-link-text": "Guía de uso y código fuente",
    "guide-link-note": "(abre GitHub en el navegador)",
    "help-link-text": "Preguntas y peticiones de funciones",
    "help-link-note": "(abre GitHub en el navegador)",
  },
  placeholders: {
    status: "Comprobando la conexión con la app Even",
    reply: "Esperando una respuesta.",
    display: "Aún no se muestra en G2",
  },

  afterConnecting: "Después de conectar, mantén pulsado y habla.",
  micStopUnconfirmed:
    "Puede que el micrófono siga encendido. Mantén pulsado para volver a intentarlo o cierra la app desde la app Even.",
  settingsUnread:
    "No se pudieron cargar tus ajustes de voz guardados, así que Hey dots y el envío automático están desactivados. Vuelve a activarlos si quieres.",
  micOff: "Micrófono apagado",
  draftPausesRecording: "Tienes un mensaje sin enviar, así que la grabación está en pausa. Envíalo o bórralo primero.",
  noSonioxKey:
    "Añade tu clave de Soniox en los ajustes para preguntar por voz. También puedes escribir tu mensaje y enviarlo.",
  keyRemovalUnconfirmed:
    "La clave se borró aquí, pero no se confirmó su eliminación del almacenamiento de la app Even. Toca Eliminar clave otra vez.",
  keySessionOnlyOldMayRemain:
    "La clave solo sirve para esta sesión. Puede que siga guardada una clave recordada antes, porque no se confirmó el cambio en el almacenamiento de la app Even.",
  keyRemembered:
    "Clave de Soniox configurada · recordada en este teléfono, en el almacenamiento de la app Even, hasta que la elimines.",
  keySessionOnly: "Clave de Soniox configurada · solo se guarda hasta que cierres la app.",
  recordingNoSound: "Grabando · aún no llega sonido de G2 · sigue hablando y se captará.",
  wakeListeningNoSound: "Hey dots escuchando · aún no llega sonido de G2 · puede ser normal si hay silencio.",
  micTurningOff: "Apagando el micrófono",
  wakeOffMicOff: "Hey dots desactivado · micrófono apagado",
  wakeNoKeyMicOff: "Hey dots no disponible · sin clave de Soniox · micrófono apagado",
  wakePausedMicOff: "Hey dots en pausa · micrófono apagado",
  wakePreparing: "Preparando Hey dots en este teléfono",
  wakeHeardNow: "Hey dots detectado · haz tu pregunta ahora.",
  wakeHeard: "Hey dots detectado · haz tu pregunta.",
  readyForQuestion: "Listo para tu pregunta. Di Hey dots o mantén pulsado para hablar.",
  wakeStopped: "Hey dots dejó de escuchar. Mantén pulsado para hablar o escribe tu mensaje.",
  micStartFailed: "No se pudo encender el micrófono de G2.",
  wakeMicStarting: "Encendiendo el micrófono de G2 · esperando sonido",
  historyDeleted:
    "Se eliminó tu historial de conversación, así que sus respuestas también desaparecieron de este teléfono. Lo que estabas escribiendo se conserva y puedes hacer una nueva pregunta.",
  historyExpired: "Las respuestas más antiguas que el periodo de conservación también se eliminaron de este teléfono.",
  ackPending: "respuesta final en camino",
  ackLabel: "Respuesta provisional",
  finalLabel: "Respuesta final",
  somethingWrong: "Algo salió mal.",
  waitingEvenApp: "Esperando a la app Even.",
  preparingG2: "Preparando la pantalla de G2.",
  loadingSettings: "Cargando tus ajustes de voz guardados.",
  connectToRecord: "Conéctate a tu servidor para grabar.",
  sonioxToRecord: "Añade una clave de Soniox para grabar. Aún puedes escribir tu mensaje abajo y enviarlo.",
  finishingPrevious: "Terminando la solicitud anterior.",
  messagePosition: (index, count, stage) => `Mensaje ${index} de ${count}${stage ? ` · ${stage}` : ""}`,
  noMessages: "Aún no hay mensajes.",
  connectFirst: "Primero conéctate a tu servidor.",
  connectionExpired: "Esta conexión caducó. Desconecta y vuelve a conectar con una nueva clave de conexión.",
  questionRejected:
    "El servidor no aceptó esta pregunta porque la conversación se eliminó o superó su periodo de conservación. No se reenviará automáticamente; si la envías de nuevo, se enviará como una pregunta nueva.",
  serverFailed: (status) => `Falló la solicitud al servidor (${status})`,
  g2NotConnected: "G2 aún no está conectada · puedes leer aquí en tu teléfono.",
  showingOnG2: "Mostrando en G2…",
  g2UpdateFailed: "No se pudo actualizar G2 · lee la respuesta aquí en tu teléfono.",
  showingLiveCaption: "Mostrando la transcripción en directo (provisional) en G2",
  shownOnG2: "Mostrado en G2.",
  g2Unconfirmed: "No se pudo confirmar que G2 se actualizara.",
  replyPosition: (index, count) => `${index}/${count}`,
  voiceStopped: "Entrada de voz detenida · no se envió nada.",
  replyBackToReading:
    "Dot respondió · volviendo al mensaje que leías. Pasa al mensaje siguiente para ver la nueva respuesta.",
  replyShowingLatest: "Dot respondió · mostrando la última respuesta en G2.",
  exitFailed: "No se cerró · 2 toques",
  exitRequestFailed: "No se pudo pedir a G2 que cerrara la app. Toca dos veces otra vez o ciérrala desde la app Even.",
  staleResponse: "Se omitió una respuesta del servidor obsoleta, más antigua que la conversación ya mostrada.",
  unversionedResponse:
    "Se omitió una respuesta del servidor sin versión de conversación, porque podría incluir respuestas eliminadas.",
  erasedReplyAfterVoice: (erased) => `${erased} La nueva respuesta aparecerá en G2 cuando se envíe tu entrada de voz.`,
  replyAfterVoice: "Dot respondió · aparecerá en G2 cuando se envíe tu entrada de voz.",
  erasedShowingNew: (erased) => `${erased} Mostrando la nueva respuesta.`,
  ackReceived: "Respuesta provisional de Dot recibida · respuesta final en camino · mostrándola en G2.",
  finalReceived:
    "Respuesta final de Dot recibida · mostrándola en G2. La respuesta provisional queda en el mensaje anterior.",
  replyShowing: "Dot respondió · mostrándola en G2.",
  finishingTranscriptWaiting: "Terminando tu transcripción · esperando el texto final",
  finishingTranscript: "Terminando tu transcripción · aún no enviada",
  transcriptReady: "Transcripción lista · revísala y envíala.",
  transcriptAppended: "Transcripción lista · añadida tras lo que estabas escribiendo. Revísala y envíala.",
  transcriptReadyPhone: "Transcripción lista · revísala en tu teléfono y envíala.",
  sendUnconfirmed: "No se pudo confirmar si se envió.",
  sendFailed: "No se pudo enviar.",
  transcriptKept: (reason) =>
    `${reason} Tu transcripción se queda en el cuadro de mensaje. Revísala y envíala de nuevo.`,
  manualMicStarting: "Encendiendo el micrófono de G2 · esperando tu voz",
  recordingLive: "Grabando · tu voz se convierte en texto mientras hablas · detén para enviar el texto final.",
  recordingHold: "Grabando · suelta para transcribir y enviar.",
  micOffProcessing: "Micrófono apagado · procesando tu voz",
  settingsSaveFailed:
    "No se pudieron guardar tus ajustes. Se aplican ahora, pero el próximo inicio puede usar los ajustes anteriores.",
  sending: "Enviando a tu servidor · aún sin confirmar",
  delivered: "Guardado y entregado a Dot · esperando una respuesta.",
  savedNotDelivered: "Guardado en tu servidor · Dot aún no lo ha confirmado ni respondido.",
  savedThenDeleted:
    "Tu servidor recibió la pregunta, pero mientras tanto se eliminó la conversación, así que puede que esta pregunta también haya desaparecido.",
  replyReady: "Hay una respuesta lista · cargándola.",
  messageKept: (reason) => `${reason} Tu mensaje sigue en el cuadro de mensaje.`,
  dashboardNeedsOrigin: "Para abrir el panel, introduce la dirección HTTPS de tu servidor sin nada detrás.",
  dashboardCopied: "Dirección del panel copiada. Ábrela en el navegador de tu teléfono.",
  dashboardCopyFailed: "No se pudo copiar. Mantén pulsada la dirección del panel de arriba para copiarla.",
  languageSaveFailed:
    "No se pudo guardar tu elección de idioma. Se aplica ahora, pero el próximo inicio puede mostrar otro idioma.",
  originInvalid: "Esa dirección de servidor no es válida. Introduce una dirección que empiece por https://.",
  connecting: "Conectando con tu servidor",
  connectTimeout: "El servidor no respondió en 15 segundos. Revisa la dirección y tu red.",
  connectNetwork: "No se pudo contactar con el servidor. Revisa la dirección y tu red.",
  keyRejected: (status) =>
    `Esa clave de conexión es incorrecta o caducó (${status}). Obtén una clave nueva e introdúcela de nuevo.`,
  connectFailed: (status) => `No se pudo conectar con el servidor (${status}) · inténtalo de nuevo en un momento.`,
  connectIncomplete: "El servidor no completó la conexión.",
  connectSaveFailed: "No se pudo guardar la conexión. Vuelve a conectar con una nueva clave de conexión.",
  connected: "Conectado a tu servidor · termina también la conexión y la suscripción en Dot.",
  connectFailedGeneric: "No se pudo conectar.",
  previousConnectionKept: (message) => `${message} Se mantiene tu conexión anterior.`,
  keyFailed: "No se pudo usar esta clave.",
  waitForEvenApp: "Espera a que la app Even esté conectada y luego introduce tu clave.",
  keySaving: "Guardando tu clave",
  keyUpdating: "Cambiando dónde se guarda tu clave",
  keyRemoving: "Eliminando tu clave",
  disconnected: "Desconectado.",
  connectionForgotten:
    "Este teléfono olvidó la conexión. Elimina también el dispositivo en tu servidor para revocarla por completo.",
  forgetUnconfirmed:
    "No se pudo confirmar que se eliminara la conexión guardada. Revisa los datos guardados de la app Even.",
  voiceStoppedAppSwitch:
    "La entrada de voz se detuvo porque cambiaste de app en G2. Di Hey dots o mantén pulsado para hablar de nuevo.",
  pageHidden:
    "La página se cerró o se ocultó, así que se detuvieron la escucha, la grabación y la comprobación de respuestas. Continuarán cuando vuelva la página.",
  pageBack: "La página ha vuelto · continúan la escucha y la comprobación de respuestas.",
  evenAppMissing: (app) => `No se encontró la app Even. Abre ${app} desde la app Even.`,
  g2StartFailed: "No se pudo iniciar la pantalla de G2. Vuelve a abrir la app desde la app Even.",
  micOnWake: "Micrófono encendido · este teléfono espera Hey dots · no se envía nada antes de que lo digas.",
  micOnRecording: "Micrófono encendido · grabando",
  badAudioFrame: "Se recibió un sonido que no se pudo leer.",
  abnormalExit:
    "La app se cerró inesperadamente en G2, así que se detuvieron la escucha, la grabación y la comprobación de respuestas. Ábrela de nuevo desde la app Even.",
  systemExit:
    "La app se cerró en G2, así que se detuvieron la escucha, la grabación y la comprobación de respuestas. Ábrela en G2 para volver a usarla.",
  foregroundExit:
    "Cambiaste de app en G2, así que se detuvieron la escucha, la grabación y la comprobación de respuestas. Continuarán cuando la abras de nuevo en G2.",
  foregroundBack: "De vuelta en G2 · la escucha y la comprobación de respuestas empiezan de nuevo.",
  keyLoadFailed: "No se pudo cargar tu clave de Soniox guardada. Introdúcela de nuevo o toca Eliminar clave.",
  savedConnectionUnreadable: "No se pudo leer tu conexión guardada. Conéctate con una nueva clave de conexión.",
  usingSavedConnection: "Usando tu conexión al servidor guardada.",
  g2ReadyEnterConnection: "G2 lista · introduce la dirección del servidor y la clave de conexión.",
};
