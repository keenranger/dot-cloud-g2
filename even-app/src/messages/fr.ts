import type { Messages } from "./en.ts";

/** French. */
export const fr: Messages = {
  languageShown: "L'app s'affiche en français.",

  idle(state, app) {
    if (!state.restored) return `${app} · Vérification de votre connexion enregistrée.`;
    if (!state.connected)
      return `${app} · Connectez-vous dans l'app du téléphone avec l'adresse du serveur et la clé de connexion.`;
    if (!state.transcriber)
      return `${app} · Pour poser une question à voix haute, ajoutez votre clé Soniox dans l'app du téléphone. Vous pouvez aussi écrire et envoyer.`;
    return `${app} · Appuyez longuement, posez votre question, puis relâchez.`;
  },
  edge(count, delta) {
    if (!count) return "Aucune réponse";
    return delta < 0 ? "Première réponse" : "Dernière réponse";
  },
  splitMarkers: { continues: "\n(à suivre)", continued: "(suite)\n" },
  captionLive: "Transcription en direct (provisoire)",
  captionFinishing: "Fin de la transcription · provisoire · pas encore envoyée",
  wakeBlocked: {
    settings: "Hey dots · Chargement des réglages",
    enabled: "Hey dots désactivé · Micro coupé",
    active: "Hey dots en pause · Ouvrez l'app sur G2",
    ready: "Hey dots · En attente de G2",
    connected: "Hey dots · Connectez-vous dans l'app",
    transcriber: "Hey dots · Ajoutez la clé Soniox",
    manual: "Hey dots en pause · Enregistrement manuel",
    busy: "Hey dots en pause · Requête en cours",
    draft: "Hey dots en pause · Envoyez ou effacez le texte",
  },
  g2Mic: {
    micOff: "Micro coupé",
    micTurningOff: "Coupure du micro",
    micStopUnconfirmed: "Micro peut-être encore allumé",
    wakeOffMicOff: "Hey dots désactivé · Micro coupé",
    wakeNoKeyMicOff: "Pas de clé Soniox · Micro coupé",
    wakePausedMicOff: "Hey dots en pause · Micro coupé",
    wakePreparing: "Préparation de Hey dots",
    wakeHeardNow: "Micro allumé · Hey dots entendu",
    wakeStopped: "Hey dots arrêté",
    wakeMicStarting: "Allumage du micro",
    manualMicStarting: "Allumage du micro",
    micOffProcessing: "Micro coupé · traitement",
    micOnWake: "Micro allumé · attend Hey dots",
    micOnRecording: "Micro allumé · enregistrement",
    recordingNoSound: "Micro allumé · enregistrement · aucun son",
    wakeListeningNoSound: "Micro allumé · Hey dots · aucun son",
  },
  g2MicCore: { on: "Micro allumé", off: "Micro coupé", unsure: "Micro allumé ?" },

  requestFailure(kind, submission) {
    const cause = {
      timeout: "Le serveur n'a pas répondu dans les 45 secondes, la requête a donc été annulée. Vérifiez votre réseau.",
      cancelled: "L'app a été fermée ou changée sur les lunettes, la requête au serveur a donc été annulée.",
      network: "Impossible de joindre le serveur. Vérifiez votre connexion réseau.",
    }[kind];
    return submission
      ? `${cause} On ne sait pas si le serveur l'a enregistrée. Si c'est le cas, la réponse n'est pas annulée et s'affichera ici à son arrivée.`
      : cause;
  },
  stt(error) {
    switch (error.kind) {
      case "credential":
        return "Cette clé Soniox ne peut pas être utilisée. Saisissez de nouveau votre clé dans les réglages.";
      case "provider":
        return error.status === 401 || error.status === 403
          ? "Soniox a refusé la clé. Vérifiez-la dans la Soniox Console ou remplacez-la par une nouvelle."
          : `Soniox n'a pas pu transcrire ceci${error.status === undefined ? "" : ` (code ${error.status})`}. Veuillez réessayer.`;
      case "timeout":
        return "Soniox a mis trop de temps à répondre. Veuillez réessayer.";
      case "connection":
        return "Impossible de joindre Soniox. Vérifiez votre réseau et réessayez.";
      case "invalid-audio":
        return "L'enregistrement n'a pas pu être lu.";
      case "no-audio":
        return "Aucun son n'est arrivé du micro de G2, rien n'a donc été transcrit. Appuyez longuement pour parler à nouveau.";
      case "protocol":
        return "Soniox a envoyé une réponse illisible. Veuillez réessayer.";
      case "aborted":
        return "La transcription a été annulée.";
      case "overflow":
        return "L'envoi vers Soniox a pris du retard sur l'enregistrement et s'est arrêté. Vérifiez votre réseau et réessayez.";
    }
  },
  thrown: {
    relayOrigin: "Saisissez uniquement l'adresse HTTPS du serveur, sans rien après.",
    pairCode:
      "Collez la clé de connexion complète de 64 caractères (0-9, a-f) affichée dans le tableau de bord de votre serveur.",
    emptyRecording: "L'enregistrement est vide ou n'a pas pu être lu.",
    invalidRecording: "L'enregistrement n'a pas pu être lu.",
    noSpeech: "Aucune parole n'a été reconnue. Veuillez répéter.",
    sonioxKey: "Cela ne ressemble pas à une clé Soniox. Collez la clé complète copiée depuis la Soniox Console.",
  },

  page: {
    lede: "Posez vos questions à Dot à voix haute et lisez les réponses sur vos lunettes.",
    "language-label": "Langue · Language",
    "pair-legend": "Connexion à votre serveur",
    "origin-label": "Adresse du serveur (HTTPS)",
    "origin-hint": "N'ajoutez pas /mcp à la fin. /mcp sert uniquement à connecter ChatGPT.",
    "dashboard-link-text": "Obtenir une clé de connexion dans le tableau de bord",
    "dashboard-link-note": "(s'ouvre dans votre navigateur)",
    "copy-dashboard": "Copier l'adresse du tableau de bord",
    "dashboard-steps":
      "Dans le tableau de bord, connectez-vous, créez une clé de connexion (ou affichez votre clé) et copiez-la. Revenez ensuite ici, collez-la et touchez Se connecter.",
    "dashboard-fallback":
      "Si le lien ne s'ouvre pas, copiez l'adresse ci-dessous et ouvrez-la dans le navigateur de votre téléphone. Pour revenir, rouvrez cet écran depuis l'app Even.",
    "dashboard-address-label": "Adresse du tableau de bord (appui long pour copier)",
    "code-label": "Clé de connexion",
    "code-hint": "Collez la clé de connexion de 64 caractères créée dans le tableau de bord de votre serveur.",
    "pair-submit": "Se connecter",
    disconnect: "Se déconnecter et oublier cette connexion",
    "soniox-legend": "Transcription vocale (votre clé Soniox)",
    "soniox-get-intro":
      "Pour poser vos questions à voix haute, il vous faut votre propre clé API Soniox. Inscrivez-vous ou connectez-vous à la Soniox Console, créez une clé API, puis collez-la ci-dessous.",
    "soniox-console-text": "Obtenir une clé API Soniox",
    "soniox-console-note": "(ouvre la Soniox Console dans votre navigateur)",
    "soniox-privacy":
      "Votre voix va directement de ce téléphone à Soniox pour devenir du texte, et seul ce texte est envoyé à votre serveur. Votre clé et votre audio n'atteignent jamais le serveur. Par sécurité, créez dans la Soniox Console une clé distincte réservée à cette app.",
    "soniox-key-label": "Clé API Soniox",
    "soniox-remember-text": "Mémoriser la clé sur ce téléphone",
    "soniox-remember-hint":
      "Désactivé, la clé n'est conservée que jusqu'à la fermeture de l'app. Modifier ce réglage alors qu'une clé est définie l'enregistre ou la supprime aussitôt. La clé est conservée dans le stockage de l'app Even, qui n'est peut-être pas chiffré.",
    "soniox-apply": "Utiliser cette clé",
    "soniox-clear": "Supprimer la clé",
    voice: "Demander à Dot",
    "voice-note":
      "Sur G2, appuyez longuement, parlez, puis relâchez. Vos paroles sont converties en texte et envoyées automatiquement à Dot. Jusqu'à 30 secondes ; nécessite une clé Soniox.",
    "auto-send-text": "Envoyer automatiquement après la transcription (désactivez pour relire avant l'envoi)",
    "wake-text": "Hey dots mains libres (activé par défaut ; utilise le micro de G2 tant que l'app est ouverte sur G2)",
    "wake-hint":
      "Le micro de G2 ne s'ouvre que lorsque G2 est prête, que vous êtes connecté et qu'une clé Soniox est définie. Ce téléphone détecte lui-même le mot d'activation tant que l'app est ouverte sur G2, et continue d'écouter et de vérifier les réponses même si l'écran s'éteint ou se verrouille ; l'app Even et les limites d'exécution en arrière-plan de votre téléphone peuvent l'affecter. Le micro du téléphone n'est pas utilisé. Dites Hey dots (prononciation anglaise), puis votre question : seule la question qui suit est transcrite par Soniox et envoyée à votre serveur sous forme de texte. Si rien ne se passe, appuyez longuement pour parler. Désactiver cette option arrête l'écoute immédiatement.",
    record: "Démarrer l'enregistrement",
    stop: "Arrêter et transcrire",
    "text-label": "Message (vous pouvez écrire au lieu de parler)",
    send: "Envoyer à Dot",
    "reply-title": "Réponses de Dot",
    "prev-message": "Message précédent",
    "next-message": "Message suivant",
    prev: "Partie précédente sur G2",
    next: "Partie suivante sur G2",
    "help-title": "Aide et commentaires",
    "help-note":
      "La page GitHub du projet contient le guide d'utilisation et le code source. Posez vos questions ou proposez des fonctionnalités dans GitHub Issues.",
    "guide-link-text": "Guide d'utilisation et code source",
    "guide-link-note": "(ouvre GitHub dans votre navigateur)",
    "help-link-text": "Questions et demandes de fonctionnalités",
    "help-link-note": "(ouvre GitHub dans votre navigateur)",
  },
  placeholders: {
    status: "Vérification de la connexion à l'app Even",
    reply: "En attente d'une réponse.",
    display: "Pas encore affiché sur G2",
  },

  afterConnecting: "Une fois connecté, appuyez longuement et parlez.",
  micStopUnconfirmed:
    "Le micro est peut-être encore allumé. Appuyez longuement pour réessayer, ou fermez l'app depuis l'app Even.",
  settingsUnread:
    "Impossible de charger vos réglages vocaux enregistrés : Hey dots et l'envoi automatique sont donc désactivés. Réactivez-les si vous le souhaitez.",
  micOff: "Micro coupé",
  draftPausesRecording:
    "Vous avez un message non envoyé, l'enregistrement est donc en pause. Envoyez-le ou effacez-le d'abord.",
  noSonioxKey:
    "Ajoutez votre clé Soniox dans les réglages pour poser vos questions à voix haute. Vous pouvez aussi écrire votre message et l'envoyer.",
  keyRemovalUnconfirmed:
    "La clé est effacée ici, mais sa suppression du stockage de l'app Even n'a pas été confirmée. Touchez de nouveau Supprimer la clé.",
  keySessionOnlyOldMayRemain:
    "La clé ne sert que pour cette session. Une clé mémorisée auparavant est peut-être encore enregistrée, car la modification du stockage de l'app Even n'a pas été confirmée.",
  keyRemembered:
    "Clé Soniox définie · mémorisée sur ce téléphone dans le stockage de l'app Even jusqu'à sa suppression.",
  keySessionOnly: "Clé Soniox définie · conservée seulement jusqu'à la fermeture de l'app.",
  recordingNoSound: "Enregistrement · aucun son de G2 pour l'instant · continuez à parler, il sera capté.",
  wakeListeningNoSound: "Hey dots écoute · aucun son de G2 pour l'instant · cela peut être normal en cas de silence.",
  micTurningOff: "Coupure du micro",
  wakeOffMicOff: "Hey dots désactivé · micro coupé",
  wakeNoKeyMicOff: "Hey dots indisponible · pas de clé Soniox · micro coupé",
  wakePausedMicOff: "Hey dots en pause · micro coupé",
  wakePreparing: "Préparation de Hey dots sur ce téléphone",
  wakeHeardNow: "Hey dots entendu · posez votre question maintenant.",
  wakeHeard: "Hey dots entendu · posez votre question.",
  readyForQuestion: "Prêt pour votre question. Dites Hey dots ou appuyez longuement pour parler.",
  wakeStopped: "Hey dots n'écoute plus. Appuyez longuement pour parler, ou écrivez votre message.",
  micStartFailed: "Impossible d'allumer le micro de G2.",
  wakeMicStarting: "Allumage du micro de G2 · en attente de son",
  historyDeleted:
    "Votre historique de conversation a été supprimé, ses réponses ont donc aussi disparu de ce téléphone. Ce que vous étiez en train d'écrire est conservé, et vous pouvez poser une nouvelle question.",
  historyExpired: "Les réponses plus anciennes que la durée de conservation ont aussi été supprimées de ce téléphone.",
  ackPending: "réponse finale à venir",
  ackLabel: "Réponse intermédiaire",
  finalLabel: "Réponse finale",
  somethingWrong: "Un problème est survenu.",
  waitingEvenApp: "En attente de l'app Even.",
  preparingG2: "Préparation de l'écran de G2.",
  loadingSettings: "Chargement de vos réglages vocaux enregistrés.",
  connectToRecord: "Connectez-vous à votre serveur pour enregistrer.",
  sonioxToRecord:
    "Ajoutez une clé Soniox pour enregistrer. Vous pouvez toujours écrire votre message ci-dessous et l'envoyer.",
  finishingPrevious: "Fin de la requête précédente.",
  messagePosition: (index, count, stage) => `Message ${index} sur ${count}${stage ? ` · ${stage}` : ""}`,
  noMessages: "Aucun message pour l'instant.",
  connectFirst: "Connectez-vous d'abord à votre serveur.",
  connectionExpired:
    "Cette connexion a expiré. Déconnectez-vous, puis reconnectez-vous avec une nouvelle clé de connexion.",
  questionRejected:
    "Le serveur n'a pas accepté cette question, car la conversation a été supprimée ou a dépassé sa durée de conservation. Elle ne sera pas renvoyée automatiquement ; l'envoyer de nouveau l'enverra comme une nouvelle question.",
  serverFailed: (status) => `Échec de la requête au serveur (${status})`,
  g2NotConnected: "G2 pas encore connectée · vous pouvez lire ici sur votre téléphone.",
  showingOnG2: "Affichage sur G2…",
  g2UpdateFailed: "Impossible de mettre à jour G2 · lisez la réponse ici sur votre téléphone.",
  showingLiveCaption: "Transcription en direct (provisoire) affichée sur G2",
  shownOnG2: "Affiché sur G2.",
  g2Unconfirmed: "Impossible de confirmer la mise à jour de G2.",
  replyPosition: (index, count) => `${index}/${count}`,
  voiceStopped: "Saisie vocale arrêtée · rien n'a été envoyé.",
  replyBackToReading:
    "Dot a répondu · retour au message que vous lisiez. Passez au message suivant pour voir la nouvelle réponse.",
  replyShowingLatest: "Dot a répondu · la dernière réponse s'affiche sur G2.",
  exitFailed: "Non fermée · 2 touches",
  exitRequestFailed:
    "Impossible de demander à G2 de fermer l'app. Touchez de nouveau deux fois, ou fermez-la depuis l'app Even.",
  staleResponse: "Réponse du serveur ignorée : elle est plus ancienne que la conversation déjà affichée.",
  unversionedResponse:
    "Réponse du serveur ignorée : elle n'indique pas de version de conversation et pourrait contenir des réponses supprimées.",
  erasedReplyAfterVoice: (erased) =>
    `${erased} La nouvelle réponse s'affichera sur G2 après l'envoi de votre saisie vocale.`,
  replyAfterVoice: "Dot a répondu · la réponse s'affichera sur G2 après l'envoi de votre saisie vocale.",
  erasedShowingNew: (erased) => `${erased} Affichage de la nouvelle réponse.`,
  ackReceived: "Réponse intermédiaire de Dot reçue · réponse finale à venir · affichage sur G2.",
  finalReceived:
    "Réponse finale de Dot reçue · affichage sur G2. La réponse intermédiaire reste dans le message précédent.",
  replyShowing: "Dot a répondu · affichage sur G2.",
  finishingTranscriptWaiting: "Fin de votre transcription · en attente du texte final",
  finishingTranscript: "Fin de votre transcription · pas encore envoyée",
  transcriptReady: "Transcription prête · relisez-la, puis envoyez.",
  transcriptAppended: "Transcription prête · ajoutée après ce que vous écriviez. Relisez, puis envoyez.",
  transcriptReadyPhone: "Transcription prête · relisez-la sur votre téléphone, puis envoyez.",
  sendUnconfirmed: "Impossible de confirmer l'envoi.",
  sendFailed: "Envoi impossible.",
  transcriptKept: (reason) => `${reason} Votre transcription reste dans la zone de message. Relisez-la et renvoyez-la.`,
  manualMicStarting: "Allumage du micro de G2 · en attente de votre voix",
  recordingLive:
    "Enregistrement · votre voix est convertie en texte pendant que vous parlez · arrêtez pour envoyer le texte final.",
  recordingHold: "Enregistrement · relâchez pour transcrire et envoyer.",
  micOffProcessing: "Micro coupé · traitement de votre voix",
  settingsSaveFailed:
    "Impossible d'enregistrer vos réglages. Ils s'appliquent maintenant, mais le prochain lancement pourra utiliser vos réglages précédents.",
  sending: "Envoi à votre serveur · pas encore confirmé",
  delivered: "Enregistré et transmis à Dot · en attente d'une réponse.",
  savedNotDelivered: "Enregistré sur votre serveur · Dot n'a pas encore confirmé ni répondu.",
  savedThenDeleted:
    "Votre serveur a reçu la question, mais la conversation a été supprimée entre-temps : cette question a peut-être aussi disparu.",
  replyReady: "Une réponse est prête · chargement.",
  messageKept: (reason) => `${reason} Votre message est toujours dans la zone de message.`,
  dashboardNeedsOrigin: "Pour ouvrir le tableau de bord, saisissez l'adresse HTTPS de votre serveur sans rien après.",
  dashboardCopied: "Adresse du tableau de bord copiée. Ouvrez-la dans le navigateur de votre téléphone.",
  dashboardCopyFailed:
    "Copie impossible. Faites un appui long sur l'adresse du tableau de bord ci-dessus pour la copier.",
  languageSaveFailed:
    "Impossible d'enregistrer votre choix de langue. Il s'applique maintenant, mais le prochain lancement pourra afficher une autre langue.",
  originInvalid: "Cette adresse de serveur n'est pas valide. Saisissez une adresse commençant par https://.",
  connecting: "Connexion à votre serveur",
  connectTimeout: "Le serveur n'a pas répondu dans les 15 secondes. Vérifiez l'adresse et votre réseau.",
  connectNetwork: "Impossible de joindre le serveur. Vérifiez l'adresse et votre réseau.",
  keyRejected: (status) =>
    `Cette clé de connexion est incorrecte ou a expiré (${status}). Obtenez une nouvelle clé et saisissez-la de nouveau.`,
  connectFailed: (status) => `Connexion au serveur impossible (${status}) · veuillez réessayer dans un instant.`,
  connectIncomplete: "Le serveur n'a pas finalisé la connexion.",
  connectSaveFailed: "Impossible d'enregistrer la connexion. Reconnectez-vous avec une nouvelle clé de connexion.",
  connected: "Connecté à votre serveur · terminez aussi la connexion et l'abonnement dans Dot.",
  connectFailedGeneric: "Connexion impossible.",
  previousConnectionKept: (message) => `${message} Votre connexion précédente est conservée.`,
  keyFailed: "Impossible d'utiliser cette clé.",
  waitForEvenApp: "Attendez que l'app Even soit connectée, puis saisissez votre clé.",
  keySaving: "Enregistrement de votre clé",
  keyUpdating: "Modification du lieu de conservation de votre clé",
  keyRemoving: "Suppression de votre clé",
  disconnected: "Déconnecté.",
  connectionForgotten:
    "Ce téléphone a oublié la connexion. Supprimez aussi l'appareil sur votre serveur pour la révoquer complètement.",
  forgetUnconfirmed:
    "Impossible de confirmer la suppression de la connexion enregistrée. Vérifiez les données stockées par l'app Even.",
  voiceStoppedAppSwitch:
    "Saisie vocale arrêtée, car vous avez changé d'app sur G2. Dites Hey dots ou appuyez longuement pour parler à nouveau.",
  pageHidden:
    "La page a été fermée ou masquée : l'écoute, l'enregistrement et la vérification des réponses sont arrêtés. Ils reprendront au retour de la page.",
  pageBack: "La page est de retour · l'écoute et la vérification des réponses reprennent.",
  evenAppMissing: (app) => `App Even introuvable. Ouvrez ${app} depuis l'app Even.`,
  g2StartFailed: "Impossible de démarrer l'écran de G2. Rouvrez l'app depuis l'app Even.",
  micOnWake: "Micro allumé · ce téléphone guette Hey dots · rien n'est envoyé avant que vous le disiez.",
  micOnRecording: "Micro allumé · enregistrement",
  badAudioFrame: "Un son illisible a été reçu.",
  abnormalExit:
    "L'app s'est fermée de façon inattendue sur G2 : l'écoute, l'enregistrement et la vérification des réponses sont arrêtés. Rouvrez-la depuis l'app Even.",
  systemExit:
    "L'app a été fermée sur G2 : l'écoute, l'enregistrement et la vérification des réponses sont arrêtés. Ouvrez-la sur G2 pour l'utiliser de nouveau.",
  foregroundExit:
    "Vous avez changé d'app sur G2 : l'écoute, l'enregistrement et la vérification des réponses sont arrêtés. Ils reprendront quand vous la rouvrirez sur G2.",
  foregroundBack: "De retour sur G2 · l'écoute et la vérification des réponses redémarrent.",
  keyLoadFailed:
    "Impossible de charger votre clé Soniox enregistrée. Saisissez-la de nouveau, ou touchez Supprimer la clé.",
  savedConnectionUnreadable:
    "Votre connexion enregistrée est illisible. Connectez-vous avec une nouvelle clé de connexion.",
  usingSavedConnection: "Utilisation de votre connexion au serveur enregistrée.",
  g2ReadyEnterConnection: "G2 prête · saisissez l'adresse du serveur et la clé de connexion.",
};
