// Copy for the sign-in page and dashboard. English is the default; Korean is chosen with ?lang=ko or the saved
// preference. Keep both locales in step: every key exists in each.

// Provisional product name; change it here only.
export const PRODUCT_NAME = "Dots Lens for G2";

export const locales = ["en", "ko"] as const;
export type Locale = (typeof locales)[number];
export const LOCALE_COOKIE = "lang";

export function resolveLocale(...candidates: (string | string[] | null | undefined)[]): Locale {
  for (const candidate of candidates) {
    const value = Array.isArray(candidate) ? candidate[0] : candidate;
    if (value && (locales as readonly string[]).includes(value)) return value as Locale;
  }
  return "en";
}

// The page path that keeps the language through sign-in, sign-out and reloads.
export function localePath(locale: Locale) {
  return `/?lang=${locale}`;
}

export type DeliveryCategory =
  | "accepted"
  | "http_4xx"
  | "http_5xx"
  | "http_other"
  | "timeout"
  | "network"
  | "invalid_response";

const en = {
  dateLocale: "en-US",
  languageName: "English",
  page: {
    home: `${PRODUCT_NAME} home`,
    headerNote: "FOR EVEN G2 × CHATGPT DOT",
    language: "Language",
    signOut: "Sign out",
    eyebrow: "ASK WITHOUT REACHING FOR YOUR PHONE",
    titleLines: ["Ask on your glasses.", "Read Dot's reply right there."],
    intro: "Speak to your ChatGPT Dot from Even G2 and read the answer on your lenses.",
    needs:
      "You'll need your G2 connected to the Even Hub app on your phone, ChatGPT in a computer browser for a one-time setup, and a Soniox account if you want to ask by voice.",
    flowLabel: "How it works",
    flow: ["You speak on G2", "Dot answers", "You read it on G2"],
    signInEyebrow: "GET STARTED",
    signInTitle: "Sign in to set up your glasses",
    signInBody:
      "Sign in with your ChatGPT account to pair your G2 and connect your Dot. There is nothing to install on your computer.",
    signIn: "Sign in with ChatGPT",
    previewTitle: "Early preview",
    previewBody:
      "Dot's replies to your glasses are still being tested on real devices, so some replies may not arrive yet.",
    footer: "Your glasses and your Dot, connected.",
  },
  dashboard: {
    eyebrow: "YOUR CONNECTION",
    title: "Your setup",
    refresh: "Refresh status",
    checking: "Checking…",
    statusLabel: "Connection status",
    statusChecking: "Checking",
    statusUnavailable: "Unavailable",
    devices: "Paired glasses",
    deviceCount: (n: number) => `${n}`,
    dot: "Dot",
    dotSubscribed: "Listening",
    dotWaiting: "Not connected yet",
    pending: "Questions waiting for Dot",
    pendingCount: (n: number) => `${n}`,
    speech: "Voice input",
    speechValue: "Check the phone app",
    delivery: {
      accepted: "Dot received it",
      http_4xx: "Dot declined it",
      http_5xx: "Dot had a problem",
      http_other: "Unexpected response",
      timeout: "Dot took too long",
      network: "Network problem",
      invalid_response: "Unreadable response",
    } satisfies Record<DeliveryCategory, string>,
    lastDelivery: (label: string, at: string, awaiting: number, retrying: number, stopped: number) =>
      `Last question sent to Dot: ${label}, ${at}. Waiting for a reply: ${awaiting}. Retrying: ${retrying}. Stopped retrying: ${stopped}. Received means Dot got the question, not that it has answered or that the answer is on your glasses.`,

    pairTitle: "Step 1: Pair your glasses",
    pairBody: `On your phone, open ${PRODUCT_NAME} in the Even Hub app and enter the server address and connection key below. Keep your G2 connected to your phone. This is separate from your ChatGPT sign-in.`,
    serverAddress: "Server address",
    addressPending: "Getting the address…",
    keyHelp:
      "Your connection key never expires and works for all your glasses. It stays hidden until you choose Show key. If you create a new key or revoke this one, the old key can no longer pair new glasses; glasses already paired keep working.",
    keyLabel: "Connection key",
    keyHidden: "Hidden. Choose Show key.",
    showKey: "Show key",
    hideKey: "Hide key",
    copy: "Copy",
    copyLabel: (label: string) => `Copy ${label.charAt(0).toLowerCase()}${label.slice(1)}`,
    keyCreated: (at: string) => `Created ${at} · never expires`,
    legacyCode: (expires: string | null) =>
      `An older 10-minute pairing code is still active${expires ? ` (expires ${expires})` : ""}. It can't be shown again, so create a connection key once. The new key never expires.`,
    keyUnavailable:
      "We couldn't check your connection key. Choose Refresh status to try again; you can create a key once the check succeeds.",
    createKey: "Create connection key",
    createNewKey: "Create new key",
    creatingKey: "Creating key…",
    revokeKey: "Revoke key",
    revokingKey: "Revoking…",
    confirmRotate:
      "After you create a new key, the current key can no longer pair new glasses. Glasses already paired keep working. Create a new key?",
    confirmRevoke:
      "After you revoke the key, no glasses can be newly paired until you create a new one. Glasses already paired keep working. Revoke the key?",
    cancel: "Cancel",

    dotTitle: "Step 2: Connect ChatGPT Dot",
    dotBody:
      "This lets your Dot hear your questions and reply on your glasses. You don't need the connection key for this step.",
    dotSteps: [
      "On a computer, open ChatGPT in a web browser, add the address below as a custom connector, and install it. Skip this if you've already added it.",
      "Send your Dot the setup message below. After that, you can keep talking to the same Dot in the ChatGPT mobile app.",
    ],
    mcpAddress: "Connector (MCP) address",
    promptLabel: "Setup message for Dot",
    copyPrompt: "Copy setup message",
    // The event name, session, tool and utterance_id are the relay contract; keep them verbatim in every locale.
    dotPrompt: (connector: string) =>
      `Subscribe to the "utterance.created" event from the connector at ${connector || "this site's /mcp address"} with session "g2". When a new voice question arrives, answer it in the language it was asked in, then call reply_to_g2 with the same utterance_id you received and your answer as text. Don't tell me you're connected until an event has actually arrived.`,

    speechTitle: "Step 3: Turn on voice questions",
    speechBody:
      "To ask by voice, add your own Soniox API key in the phone app. You can skip this step if you only type your questions. Never enter the key on this website.",
    speechSteps: [
      "In your Soniox account, create an API key that allows real-time transcription.",
      `In the Even Hub app on your phone, open ${PRODUCT_NAME} settings and paste the key.`,
      "The key is kept only while the app is open. Choose Remember to keep it on your phone; you can clear or replace it any time in the same settings.",
    ],
    sonioxGuide: "How to set Soniox key permissions (opens in a new tab)",
    speechPrivacy:
      "Your voice goes from your phone straight to Soniox, which turns it into text; only that text reaches this service and your Dot. Soniox bills your own account. A remembered key is only as safe as your phone and the Even Hub app; it is not separately encrypted.",

    revokeAllBody:
      "Disconnect all glasses on your account and revoke your connection key. To use them again, pair with a new key.",
    revokeAll: "Disconnect all glasses",
    revokingAll: "Disconnecting…",
    deleteBody:
      "Delete your conversation history (your questions, Dot's replies and notifications) from this service now. Your paired glasses and Dot connection stay as they are.",
    deleteConfirm:
      "This can't be undone. Anything already sent to ChatGPT (Dot) or Soniox, or already shown on your phone, can't be erased from here. Delete your history?",
    deleteForever: "Delete history permanently",
    deleting: "Deleting…",
    deleteStart: "Delete conversation history",

    askTitle: "Step 4: Ask from your G2",
    askBody:
      "After steps 1 and 2, type a question in the phone app, or speak once step 3 is done. Dot's answer appears on your glasses.",

    copied: "Copied.",
    copyUnavailable: "Couldn't copy automatically. Select the text and copy it yourself.",
    keyShown: "Connection key shown.",
    keyCreatedNotice:
      "New connection key created. Choose Show key and enter it in the Even Hub app. The old key can no longer pair new glasses; glasses already paired keep working.",
    keyRevokedNotice:
      "Connection key revoked. No new glasses can be paired until you create a key; glasses already paired keep working.",
    sessionExpired: "Your sign-in has expired. Please sign in again.",
    rateLimited: "Too many tries. Please wait a minute and try again.",
    keyServiceUnavailable:
      "Connection keys can't be created or shown right now. Your current key and paired glasses keep working.",
    keyNotRevealable:
      "This key can't be shown again. Your paired glasses keep working; create a new key if you need one.",
    keyFailed: {
      create: "Couldn't create a connection key. Please try again shortly.",
      reveal: "Couldn't show the connection key. Please try again shortly.",
      withdraw: "Couldn't revoke the connection key. Please try again shortly.",
    },
    keyUnconfirmed:
      "We couldn't confirm the new key for the account signed in now. Choose Refresh status to see your current key.",
    keyMismatch:
      "Your key changed since this page loaded, so it wasn't shown. We've checked again; try Show key once more.",
    statusFailed: "Couldn't load your connection status. Please try again.",
    statusUnknown: "Couldn't check your connection status.",
    revokeAllFailed: "Couldn't disconnect your glasses. Please try again.",
    revokedAll: "All your glasses are disconnected and your connection key is revoked. Create a new key to pair again.",
    deleteFailed: "Couldn't delete your conversation history. Please try again shortly.",
    deleted: (n: number) =>
      `Deleted ${n} ${n === 1 ? "item" : "items"} from your conversation history. Your paired glasses and Dot connection are unchanged.`,
  },
};

export type Copy = typeof en;

const ko: Copy = {
  dateLocale: "ko-KR",
  languageName: "한국어",
  page: {
    home: `${PRODUCT_NAME} 홈`,
    headerNote: "EVEN G2 × CHATGPT DOT",
    language: "언어",
    signOut: "로그아웃",
    eyebrow: "휴대폰을 꺼내지 않고 묻기",
    titleLines: ["안경에서 묻고,", "Dot의 답을 바로 읽으세요."],
    intro: "Even G2에서 ChatGPT Dot에게 말하고, 답변을 안경 화면에서 확인하세요.",
    needs:
      "휴대폰의 Even Hub 앱에 연결된 G2, 한 번만 설정하면 되는 컴퓨터 브라우저의 ChatGPT, 음성으로 질문하려면 Soniox 계정이 필요합니다.",
    flowLabel: "사용 흐름",
    flow: ["G2에서 말하기", "Dot이 답변", "G2에서 읽기"],
    signInEyebrow: "시작하기",
    signInTitle: "로그인하고 안경 연결 시작하기",
    signInBody: "ChatGPT 계정으로 로그인하면 G2를 페어링하고 Dot을 연결할 수 있습니다. 컴퓨터에 설치할 것은 없습니다.",
    signIn: "ChatGPT로 로그인",
    previewTitle: "미리보기 단계",
    previewBody: "안경으로 오는 Dot의 답변은 아직 실제 기기에서 확인 중이라, 일부 답변이 도착하지 않을 수 있습니다.",
    footer: "안경과 Dot을 잇는 가장 짧은 연결.",
  },
  dashboard: {
    eyebrow: "내 연결",
    title: "내 연결 설정",
    refresh: "상태 새로고침",
    checking: "확인 중…",
    statusLabel: "내 연결 상태",
    statusChecking: "확인 중",
    statusUnavailable: "확인 불가",
    devices: "연결된 안경",
    deviceCount: (n) => `${n}대`,
    dot: "Dot",
    dotSubscribed: "듣는 중",
    dotWaiting: "아직 연결 안 됨",
    pending: "Dot의 답을 기다리는 질문",
    pendingCount: (n) => `${n}건`,
    speech: "음성 입력",
    speechValue: "휴대폰 앱에서 확인",
    delivery: {
      accepted: "Dot이 받음",
      http_4xx: "Dot이 거절함",
      http_5xx: "Dot 쪽 오류",
      http_other: "예상하지 못한 응답",
      timeout: "응답 시간 초과",
      network: "네트워크 문제",
      invalid_response: "읽을 수 없는 응답",
    },
    lastDelivery: (label, at, awaiting, retrying, stopped) =>
      `최근 Dot에 보낸 질문: ${label}, ${at}. 답변 대기 ${awaiting}건, 재시도 대기 ${retrying}건, 재시도 중단 ${stopped}건. 받음은 Dot이 질문을 받았다는 뜻이며, 답했거나 안경에 표시되었다는 뜻은 아닙니다.`,

    pairTitle: "1단계: 안경 페어링",
    pairBody: `휴대폰의 Even Hub 앱에서 ${PRODUCT_NAME}를 열고 아래 서버 주소와 연결 키를 입력하세요. G2가 휴대폰에 연결되어 있어야 합니다. ChatGPT 로그인과는 별개입니다.`,
    serverAddress: "서버 주소",
    addressPending: "주소 확인 중…",
    keyHelp:
      "연결 키는 만료되지 않으며 내 모든 안경에 쓸 수 있습니다. 키 확인을 누르기 전까지는 가려져 있습니다. 새 키를 만들거나 키를 폐기하면 이전 키로는 새 안경을 연결할 수 없지만, 이미 연결된 안경은 그대로 동작합니다.",
    keyLabel: "연결 키",
    keyHidden: "가려짐 · 키 확인을 누르세요",
    showKey: "키 확인",
    hideKey: "키 숨기기",
    copy: "복사",
    copyLabel: (label) => `${label} 복사`,
    keyCreated: (at) => `만든 시각: ${at} · 만료 없음`,
    legacyCode: (expires) =>
      `이전 방식의 10분 연결 코드가 남아 있습니다${expires ? `(만료 ${expires})` : ""}. 이 코드는 다시 볼 수 없으니, 연결 키를 한 번 만들어 주세요. 새 키는 만료 없이 계속 쓸 수 있습니다.`,
    keyUnavailable:
      "연결 키 상태를 확인하지 못했습니다. 상태 새로고침으로 다시 확인해 주세요. 확인이 끝나면 키를 만들 수 있습니다.",
    createKey: "연결 키 만들기",
    createNewKey: "새 연결 키 만들기",
    creatingKey: "키 만드는 중…",
    revokeKey: "연결 키 폐기",
    revokingKey: "폐기 중…",
    confirmRotate:
      "새 키를 만들면 지금 키로는 더 이상 새 안경을 연결할 수 없습니다. 이미 연결된 안경은 그대로 동작합니다. 새 키를 만들까요?",
    confirmRevoke:
      "키를 폐기하면 새 키를 만들기 전까지 어떤 안경도 새로 연결할 수 없습니다. 이미 연결된 안경은 그대로 동작합니다. 폐기할까요?",
    cancel: "취소",

    dotTitle: "2단계: ChatGPT Dot 연결",
    dotBody: "Dot이 내 질문을 듣고 안경으로 답할 수 있게 합니다. 이 단계에는 연결 키가 필요 없습니다.",
    dotSteps: [
      "컴퓨터의 웹 브라우저에서 ChatGPT를 열고 아래 주소를 사용자 지정 커넥터로 추가해 설치하세요. 이미 추가했다면 건너뛰세요.",
      "아래 설정 요청을 Dot에 보내세요. 이후 같은 Dot을 ChatGPT 모바일 앱에서도 이어서 쓸 수 있습니다.",
    ],
    mcpAddress: "커넥터(MCP) 주소",
    promptLabel: "Dot에 보낼 설정 요청",
    copyPrompt: "설정 요청 복사",
    dotPrompt: (connector) =>
      `${connector || "이 사이트의 /mcp 주소"} 커넥터의 "utterance.created" 이벤트를 session "g2"로 구독해 줘. 새 음성 질문을 받으면 질문한 언어로 답하고, reply_to_g2에 받은 것과 동일한 utterance_id와 답변을 text로 보내 줘. 이벤트가 실제로 도착하기 전에는 연결되었다고 말하지 마.`,

    speechTitle: "3단계: 음성 질문 켜기",
    speechBody:
      "음성으로 질문하려면 휴대폰 앱에 본인의 Soniox API 키를 입력하세요. 질문을 직접 입력만 한다면 이 단계는 건너뛰어도 됩니다. 이 사이트에는 키를 입력하지 마세요.",
    speechSteps: [
      "Soniox 계정에서 실시간 음성 인식(real-time transcription)을 허용한 API 키를 만드세요.",
      `휴대폰 Even Hub 앱에서 ${PRODUCT_NAME}의 설정을 열고 키를 붙여 넣으세요.`,
      "키는 앱을 사용하는 동안에만 보관됩니다. 기억하기를 선택하면 휴대폰에 남으며, 같은 설정 화면에서 언제든 지우거나 새 키로 바꿀 수 있습니다.",
    ],
    sonioxGuide: "Soniox API 키 권한 안내(새 창)",
    speechPrivacy:
      "음성은 휴대폰에서 Soniox로 바로 전송되어 텍스트로 바뀌고, 그 텍스트만 이 서비스와 Dot에 전달됩니다. 사용 요금은 본인 Soniox 계정에 청구됩니다. 기억한 키의 안전성은 휴대폰과 Even Hub 앱을 얼마나 믿을 수 있는지에 달려 있으며, 별도로 암호화되지 않습니다.",

    revokeAllBody:
      "내 계정에 연결된 모든 안경의 연결을 끊고 연결 키도 폐기합니다. 다시 쓰려면 새 연결 키로 페어링하세요.",
    revokeAll: "모든 안경 연결 해제",
    revokingAll: "연결 해제 중…",
    deleteBody:
      "이 계정의 대화 기록(내 질문, Dot의 답변, 알림)을 이 서비스에서 바로 삭제합니다. 연결된 안경과 Dot 연결은 그대로입니다.",
    deleteConfirm:
      "삭제하면 되돌릴 수 없습니다. 이미 ChatGPT(Dot)나 Soniox로 전달된 내용, 휴대폰에 이미 표시된 내용은 여기서 지울 수 없습니다. 삭제할까요?",
    deleteForever: "대화 기록 영구 삭제",
    deleting: "삭제 중…",
    deleteStart: "대화 기록 삭제",

    askTitle: "4단계: G2에서 묻기",
    askBody:
      "1·2단계를 마치면 휴대폰 앱에서 질문을 입력하고, 3단계까지 마치면 말로도 물을 수 있습니다. Dot의 답변이 안경에 표시됩니다.",

    copied: "복사했습니다.",
    copyUnavailable: "자동 복사를 사용할 수 없습니다. 표시된 내용을 직접 선택해 복사해 주세요.",
    keyShown: "연결 키를 표시했습니다.",
    keyCreatedNotice:
      "새 연결 키를 만들었습니다. 키 확인을 눌러 Even Hub 앱에 입력해 주세요. 이전 키로는 새 안경을 연결할 수 없고, 이미 연결된 안경은 그대로입니다.",
    keyRevokedNotice:
      "연결 키를 폐기했습니다. 새 키를 만들기 전까지 새 안경을 연결할 수 없고, 이미 연결된 안경은 그대로입니다.",
    sessionExpired: "로그인 세션이 만료되었습니다. 다시 로그인해 주세요.",
    rateLimited: "요청이 많아 잠시 막혔습니다. 1분 뒤 다시 시도해 주세요.",
    keyServiceUnavailable: "지금은 연결 키를 만들거나 보여 줄 수 없습니다. 기존 키와 연결된 안경은 그대로 동작합니다.",
    keyNotRevealable:
      "이 연결 키는 다시 볼 수 없습니다. 연결된 안경은 그대로 동작하며, 키가 필요하면 새 연결 키를 만들어 주세요.",
    keyFailed: {
      create: "연결 키를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.",
      reveal: "연결 키를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      withdraw: "연결 키를 폐기하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    },
    keyUnconfirmed: "만든 키를 지금 로그인한 계정에서 확인하지 못했습니다. 상태 새로고침으로 현재 키를 확인해 주세요.",
    keyMismatch:
      "이 화면을 연 뒤 키가 바뀌어 표시하지 않았습니다. 최신 상태를 다시 확인했으니 키 확인을 다시 눌러 주세요.",
    statusFailed: "연결 상태를 불러오지 못했습니다. 다시 확인해 주세요.",
    statusUnknown: "연결 상태를 확인하지 못했습니다.",
    revokeAllFailed: "안경 연결을 해제하지 못했습니다. 다시 시도해 주세요.",
    revokedAll: "내 모든 안경의 연결을 해제하고 연결 키도 폐기했습니다. 다시 쓰려면 새 연결 키로 페어링해 주세요.",
    deleteFailed: "대화 기록을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    deleted: (n) => `대화 기록 ${n}건을 삭제했습니다. 연결된 안경과 Dot 연결은 그대로입니다.`,
  },
};

export const copy: Record<Locale, Copy> = { en, ko };
