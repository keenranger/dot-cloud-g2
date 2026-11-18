import type { Copy } from "../dashboard";
import { PRODUCT_NAME } from "../product";

export const fr: Copy = {
  dateLocale: "fr-FR",
  languageName: "Français",
  page: {
    home: `Accueil ${PRODUCT_NAME}`,
    headerNote: "POUR EVEN G2 × CHATGPT DOT",
    language: "Langue",
    signOut: "Se déconnecter",
    eyebrow: "DEMANDEZ SANS SORTIR VOTRE TÉLÉPHONE",
    titleLines: ["Posez votre question depuis vos lunettes.", "Lisez la réponse de Dot au même endroit."],
    intro: "Parlez à votre ChatGPT Dot depuis Even G2 et lisez la réponse sur vos verres.",
    needs:
      "Il vous faut vos G2 connectées à l’application Even Hub sur votre téléphone, ChatGPT dans le navigateur d’un ordinateur pour une configuration unique, et un compte Soniox si vous voulez poser vos questions à la voix.",
    flowLabel: "Comment ça marche",
    flow: ["Vous parlez sur les G2", "Dot répond", "Vous lisez sur les G2"],
    signInEyebrow: "COMMENCER",
    signInTitle: "Connectez-vous pour configurer vos lunettes",
    signInBody:
      "Connectez-vous avec votre compte ChatGPT pour associer vos G2 et connecter votre Dot. Rien à installer sur votre ordinateur.",
    signIn: "Se connecter avec ChatGPT",
    previewTitle: "Préversion",
    previewBody:
      "Les réponses de Dot sur vos lunettes sont encore en test sur de vrais appareils ; certaines réponses peuvent donc ne pas encore arriver.",
    footer: "Vos lunettes et votre Dot, connectés.",
    policies: "Politiques",
    privacy: "Avis de confidentialité",
    terms: "Conditions d’utilisation",
    apply: "Appliquer",
    support: "Aide et suggestions",
    supportGuide: "Guide d’utilisation et code source sur GitHub",
    supportIssues: "Questions et demandes de fonctionnalités sur GitHub Issues",
    newTab: "(s’ouvre dans un nouvel onglet)",
    metaTitle: "ChatGPT Dot sur vos lunettes G2",
    metaDescription: "Parlez à votre ChatGPT Dot depuis Even G2 et lisez les réponses sur vos lunettes.",
  },
  policy: {
    formerly: "anciennement Lens MCP for G2",
    effective: "En vigueur le",
    englishVersion: "Version anglaise",
  },
  notFound: {
    title: "Page introuvable",
    body: "Cette page n’existe pas ou a été déplacée.",
    home: "Aller à l’accueil",
  },
  error: {
    title: "Un problème est survenu",
    body: "Cette page n’a pas pu s’afficher. Réessayez ou revenez à l’accueil. Si le problème persiste, signalez-le-nous via GitHub Issues.",
    retry: "Réessayer",
    home: "Aller à l’accueil",
  },
  dashboard: {
    eyebrow: "VOTRE CONNEXION",
    title: "Votre configuration",
    refresh: "Actualiser l’état",
    checking: "Vérification…",
    statusLabel: "État de la connexion",
    statusChecking: "Vérification",
    statusUnavailable: "Indisponible",
    devices: "Lunettes associées",
    deviceCount: (n) => `${n}`,
    dot: "Dot",
    dotSubscribed: "À l’écoute",
    dotWaiting: "Pas encore connecté",
    pending: "Questions en attente de Dot",
    pendingCount: (n) => `${n}`,
    speech: "Saisie vocale",
    speechValue: "Vérifiez dans l’application du téléphone",
    delivery: {
      accepted: "Dot l’a reçue",
      http_4xx: "Dot l’a refusée",
      http_5xx: "Dot a rencontré un problème",
      http_other: "Réponse inattendue",
      timeout: "Dot a mis trop de temps",
      network: "Problème réseau",
      invalid_response: "Réponse illisible",
    },
    lastDelivery: (label, at, awaiting, retrying, stopped) =>
      `Dernière question envoyée à Dot : ${label}, ${at}. En attente de réponse : ${awaiting}. Nouvel essai prévu : ${retrying}. Essais arrêtés : ${stopped}. « Reçue » signifie que Dot a reçu la question, pas qu’il y a répondu ni que la réponse est sur vos lunettes.`,

    pairTitle: "Étape 1 : associer vos lunettes",
    pairBody: `Sur votre téléphone, ouvrez ${PRODUCT_NAME} dans l’application Even Hub et saisissez l’adresse du serveur et la clé de connexion ci-dessous. Gardez vos G2 connectées à votre téléphone. Cette étape est distincte de votre connexion à ChatGPT.`,
    serverAddress: "Adresse du serveur",
    addressPending: "Récupération de l’adresse…",
    keyHelp:
      "Votre clé de connexion n’expire jamais et fonctionne pour toutes vos lunettes. Elle reste masquée jusqu’à ce que vous choisissiez « Afficher la clé ». Si vous créez une nouvelle clé ou révoquez celle-ci, l’ancienne clé ne peut plus associer de nouvelles lunettes ; les lunettes déjà associées continuent de fonctionner.",
    keyLabel: "Clé de connexion",
    keyHidden: "Masquée. Choisissez « Afficher la clé ».",
    showKey: "Afficher la clé",
    hideKey: "Masquer la clé",
    copy: "Copier",
    copyLabel: (label) => `Copier : ${label}`,
    keyCreated: (at) => `Créée le ${at} · n’expire jamais`,
    legacyCode: (expires) =>
      `Un ancien code d’association de 10 minutes est encore actif${expires ? ` (expire le ${expires})` : ""}. Il ne peut pas être affiché à nouveau ; créez donc une clé de connexion, une seule fois. La nouvelle clé n’expire jamais.`,
    keyUnavailable:
      "Nous n’avons pas pu vérifier votre clé de connexion. Choisissez « Actualiser l’état » pour réessayer ; vous pourrez créer une clé une fois la vérification réussie.",
    createKey: "Créer une clé de connexion",
    createNewKey: "Créer une nouvelle clé",
    creatingKey: "Création de la clé…",
    revokeKey: "Révoquer la clé",
    revokingKey: "Révocation…",
    confirmRotate:
      "Après la création d’une nouvelle clé, la clé actuelle ne pourra plus associer de nouvelles lunettes. Les lunettes déjà associées continuent de fonctionner. Créer une nouvelle clé ?",
    confirmRevoke:
      "Après la révocation de la clé, aucune paire de lunettes ne pourra être nouvellement associée tant que vous n’en aurez pas créé une nouvelle. Les lunettes déjà associées continuent de fonctionner. Révoquer la clé ?",
    cancel: "Annuler",

    dotTitle: "Étape 2 : connecter ChatGPT Dot",
    dotBody:
      "Votre Dot pourra ainsi entendre vos questions et répondre sur vos lunettes. La clé de connexion n’est pas nécessaire pour cette étape.",
    dotSteps: [
      "Sur un ordinateur, ouvrez ChatGPT dans un navigateur web, ajoutez l’adresse ci-dessous comme connecteur personnalisé et installez-le. Passez cette étape si vous l’avez déjà ajouté.",
      "Envoyez à votre Dot le message de configuration ci-dessous. Ensuite, vous pouvez continuer à parler au même Dot dans l’application mobile ChatGPT.",
    ],
    mcpAddress: "Adresse du connecteur (MCP)",
    promptLabel: "Message de configuration pour Dot",
    copyPrompt: "Copier le message de configuration",
    dotPrompt: (connector) =>
      `Abonne-toi à l’événement "utterance.created" du connecteur à l’adresse ${connector || "/mcp de ce site"} avec la session "g2". Quand une nouvelle question vocale arrive, réponds dans la langue dans laquelle elle a été posée, puis appelle reply_to_g2 avec le même utterance_id que celui reçu et ta réponse en tant que text. Avant un travail lent comme une recherche ou l’utilisation d’outils, appelle d’abord acknowledge_g2_utterance avec le même utterance_id et une courte note, avec tes propres mots, sur ce que tu vas faire ; n’envoie pas de message stéréotypé du type « reçu ». Ne me dis pas que tu es connecté tant qu’un événement n’est pas réellement arrivé.`,

    speechTitle: "Étape 3 : activer les questions vocales",
    speechBody:
      "Pour poser vos questions à la voix, ajoutez votre propre clé API Soniox dans l’application du téléphone. Vous pouvez passer cette étape si vous tapez seulement vos questions. Ne saisissez jamais cette clé sur ce site.",
    speechSteps: [
      "Dans votre compte Soniox, créez une clé API qui autorise la transcription en temps réel (real-time transcription).",
      `Dans l’application Even Hub de votre téléphone, ouvrez les réglages de ${PRODUCT_NAME} et collez la clé.`,
      "La clé n’est conservée que tant que l’application est ouverte. Choisissez « Mémoriser » pour la garder sur votre téléphone ; vous pouvez l’effacer ou la remplacer à tout moment dans les mêmes réglages.",
    ],
    sonioxGuide: "Comment définir les autorisations de la clé Soniox (s’ouvre dans un nouvel onglet)",
    speechPrivacy:
      "Votre voix part de votre téléphone directement vers Soniox, qui la transforme en texte ; seul ce texte parvient à ce service et à votre Dot. Soniox facture votre propre compte. Une clé mémorisée n’est pas plus sûre que votre téléphone et l’application Even Hub ; elle n’est pas chiffrée séparément.",

    revokeAllBody:
      "Déconnectez toutes les lunettes de votre compte et révoquez votre clé de connexion. Pour les utiliser à nouveau, associez-les avec une nouvelle clé.",
    revokeAll: "Déconnecter toutes les lunettes",
    revokingAll: "Déconnexion…",
    deleteBody:
      "Supprimez dès maintenant votre historique de conversation (vos questions, les réponses de Dot et les notifications) de ce service. Vos lunettes associées et la connexion à Dot restent inchangées.",
    deleteConfirm:
      "Cette action est irréversible. Ce qui a déjà été envoyé à ChatGPT (Dot) ou à Soniox, ou déjà affiché sur votre téléphone, ne peut pas être effacé d’ici. Supprimer votre historique ?",
    deleteForever: "Supprimer définitivement l’historique",
    deleting: "Suppression…",
    deleteStart: "Supprimer l’historique de conversation",

    askTitle: "Étape 4 : poser une question depuis vos G2",
    askBody:
      "Après les étapes 1 et 2, tapez une question dans l’application du téléphone, ou parlez une fois l’étape 3 terminée. La réponse de Dot s’affiche sur vos lunettes.",

    copied: "Copié.",
    copyUnavailable: "Impossible de copier automatiquement. Sélectionnez le texte et copiez-le vous-même.",
    keyShown: "Clé de connexion affichée.",
    keyCreatedNotice:
      "Nouvelle clé de connexion créée. Choisissez « Afficher la clé » et saisissez-la dans l’application Even Hub. L’ancienne clé ne peut plus associer de nouvelles lunettes ; les lunettes déjà associées continuent de fonctionner.",
    keyRevokedNotice:
      "Clé de connexion révoquée. Aucune nouvelle paire de lunettes ne peut être associée tant que vous n’avez pas créé de clé ; les lunettes déjà associées continuent de fonctionner.",
    sessionExpired: "Votre session a expiré. Veuillez vous reconnecter.",
    rateLimited: "Trop de tentatives. Patientez une minute, puis réessayez.",
    keyServiceUnavailable:
      "Les clés de connexion ne peuvent pas être créées ni affichées pour le moment. Votre clé actuelle et vos lunettes associées continuent de fonctionner.",
    keyNotRevealable:
      "Cette clé ne peut pas être affichée à nouveau. Vos lunettes associées continuent de fonctionner ; créez une nouvelle clé si vous en avez besoin.",
    keyFailed: {
      create: "Impossible de créer la clé de connexion. Réessayez dans un instant.",
      reveal: "Impossible d’afficher la clé de connexion. Réessayez dans un instant.",
      withdraw: "Impossible de révoquer la clé de connexion. Réessayez dans un instant.",
    },
    keyUnconfirmed:
      "Nous n’avons pas pu confirmer la nouvelle clé pour le compte actuellement connecté. Choisissez « Actualiser l’état » pour voir votre clé actuelle.",
    keyMismatch:
      "Votre clé a changé depuis le chargement de cette page ; elle n’a donc pas été affichée. Nous avons vérifié à nouveau ; choisissez encore une fois « Afficher la clé ».",
    statusFailed: "Impossible de charger l’état de votre connexion. Veuillez réessayer.",
    statusUnknown: "Impossible de vérifier l’état de votre connexion.",
    revokeAllFailed: "Impossible de déconnecter vos lunettes. Veuillez réessayer.",
    revokedAll:
      "Toutes vos lunettes sont déconnectées et votre clé de connexion est révoquée. Créez une nouvelle clé pour les associer à nouveau.",
    deleteFailed: "Impossible de supprimer votre historique de conversation. Réessayez dans un instant.",
    deleted: (n) =>
      `${n} ${n === 1 ? "élément supprimé" : "éléments supprimés"} de votre historique de conversation. Vos lunettes associées et la connexion à Dot sont inchangées.`,
  },
};
