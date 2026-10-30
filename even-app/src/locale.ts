import { CAPTION_FINISHING, CAPTION_LIVE } from "./g2-caption.ts";
import { edgeNote, idleBody } from "./g2-guide.ts";
import { sttMessage, type SonioxTranscriptionError } from "./soniox-transcriber.ts";
import { KOREAN_MARKERS, type SplitMarkers } from "./protocol.ts";
import { requestFailure, type RequestFailure } from "./voice-flow.ts";
import { WAKE_BLOCKED, type WakeBlocker } from "./wake-gate.ts";

/** English is the default on every phone; Korean applies only when the user picks it. */
export type Language = "en" | "ko";
export const LANGUAGE_STORAGE = "dot-cloud-language-v1";
export const APP_NAME = "Dots Lens for G2";
let language: Language = "en";

export const currentLanguage = (): Language => language;
export function setLanguage(value: Language): void {
  language = value;
}
/** Anything other than an explicit Korean choice, including an unreadable value, keeps English. */
export const parseLanguage = (raw: string | null | undefined): Language => (raw === "ko" ? "ko" : "en");
/** The text in the selected language. */
export const t = (en: string, ko: string): string => (language === "ko" ? ko : en);

const WAKE_BLOCKED_EN: Record<WakeBlocker, string> = {
  settings: "Hey dots · Loading settings",
  enabled: "Hey dots off · Microphone off",
  active: "Hey dots paused · Open app on G2",
  ready: "Hey dots · Waiting for G2",
  connected: "Hey dots · Connect in phone app",
  transcriber: "Hey dots · Add Soniox key on phone",
  manual: "Hey dots paused · Manual recording",
  busy: "Hey dots paused · Finishing request",
  draft: "Hey dots paused · Send or clear draft",
};
export const wakeBlocked = (reason: WakeBlocker): string => t(WAKE_BLOCKED_EN[reason], WAKE_BLOCKED[reason]);

export function failureText(kind: RequestFailure, submission: boolean): string {
  if (language === "ko") return requestFailure(kind, submission);
  const cause = {
    timeout: "The server did not answer within 45 seconds, so the request was cancelled. Check your network.",
    cancelled: "The app was closed or switched on the glasses, so the server request was cancelled.",
    network: "Could not reach the server. Check your network connection.",
  }[kind];
  return submission ? `${cause} It is not known whether the server saved it.` : cause;
}

export function sttText(error: SonioxTranscriptionError): string {
  if (language === "ko") return sttMessage(error);
  switch (error.kind) {
    case "credential":
      return "This Soniox key can't be used. Enter your key again in settings.";
    case "provider":
      return error.status === 401 || error.status === 403
        ? "Soniox did not accept the key. Check the key in the Soniox Console or replace it with a new one."
        : `Soniox could not transcribe this${error.status === undefined ? "" : ` (code ${error.status})`}. Please try again.`;
    case "timeout":
      return "Soniox took too long to answer. Please try again.";
    case "connection":
      return "Could not reach Soniox. Check your network and try again.";
    case "invalid-audio":
      return "The recording could not be read.";
    case "no-audio":
      return "No sound arrived from the G2 microphone, so nothing was transcribed. Press and hold to speak again.";
    case "protocol":
      return "Soniox sent a reply that could not be read. Please try again.";
    case "aborted":
      return "Transcription was cancelled.";
    case "overflow":
      return "Sending to Soniox fell behind the recording, so it stopped. Check your network and try again.";
  }
}
/** Fixed Korean messages that helper modules throw, in English; any other text is shown as it is. */
const THROWN_EN: Record<string, string> = {
  "HTTPS 서버의 기본 주소만 입력하세요.": "Enter only the server's HTTPS address, with nothing after it.",
  "연결 키는 서버 대시보드에 표시된 64자리 연결 키(0-9, a-f) 전체를 붙여 넣으세요.":
    "Paste the whole 64-character connection key (0-9, a-f) shown in your server dashboard.",
  "녹음 데이터가 없거나 형식이 올바르지 않습니다.": "The recording is empty or could not be read.",
  "녹음 데이터 형식이 올바르지 않습니다.": "The recording could not be read.",
  "인식된 음성이 없습니다. 다시 말해주세요.": "No speech was recognized. Please say it again.",
  "Soniox 키 형식이 올바르지 않습니다. 콘솔에서 복사한 키 전체를 붙여 넣으세요.":
    "That doesn't look like a Soniox key. Paste the whole key copied from the Soniox Console.",
};
export const messageText = (text: string): string => (language === "ko" ? text : (THROWN_EN[text] ?? text));

export function idleText(state: { restored: boolean; connected: boolean; transcriber: boolean }): string {
  if (language === "ko") return idleBody(state);
  if (!state.restored) return `${APP_NAME} · Checking your saved connection.`;
  if (!state.connected) return `${APP_NAME} · Connect in the phone app with your server address and connection key.`;
  if (!state.transcriber)
    return `${APP_NAME} · To ask by voice, add your Soniox key in the phone app. You can also type and send.`;
  return `${APP_NAME} · Press and hold, ask your question, then let go.`;
}
export function edgeText(count: number, delta: number): string {
  if (language === "ko") return edgeNote(count, delta);
  if (!count) return "No replies yet";
  return delta < 0 ? "This is the first reply" : "This is the last reply";
}
const ENGLISH_MARKERS: SplitMarkers = { continues: "\n(continues)", continued: "(continued)\n" };
/** Every language's markers: a reply split once still fits after the language changes. */
export const SPLIT_MARKERS: readonly SplitMarkers[] = [ENGLISH_MARKERS, KOREAN_MARKERS];
export const splitMarkers = (): SplitMarkers => (language === "ko" ? KOREAN_MARKERS : ENGLISH_MARKERS);
export const captionLive = (): string => t("Live transcript (not final)", CAPTION_LIVE);
export const captionFinishing = (): string => t("Finishing transcript · not final · not sent yet", CAPTION_FINISHING);

/** Text of the static phone page by element id: English as shipped in index.html, then Korean. */
export const PAGE_TEXT: Record<string, readonly [en: string, ko: string]> = {
  lede: ["Ask Dot by voice and read the replies on your glasses.", "음성으로 Dot에게 묻고, 답변을 안경에서 읽습니다."],
  "pair-legend": ["Connect to your server", "서버 연결"],
  "origin-label": ["Server address (HTTPS)", "휴대폰 앱 서버 기본 주소 (HTTPS)"],
  "origin-hint": [
    "Don't add /mcp at the end. /mcp is only for connecting ChatGPT.",
    "끝에 /mcp를 붙이지 마세요. /mcp는 ChatGPT MCP 연결에만 사용합니다.",
  ],
  "dashboard-link-text": ["Get a connection key from your dashboard", "연결 키 만들기 · 대시보드 열기"],
  "dashboard-link-note": ["(opens in your browser)", "(브라우저에서 열림)"],
  "copy-dashboard": ["Copy dashboard address", "대시보드 주소 복사"],
  "dashboard-steps": [
    "In the dashboard, sign in, create a connection key (or view your key), and copy it. Then come back here, paste it, and tap Connect.",
    "대시보드에서 로그인 → 연결 키 만들기 (또는 키 확인) → 키 복사 → 이 화면으로 돌아와 붙여 넣기 → 연결 순서로 진행하세요.",
  ],
  "dashboard-fallback": [
    "If the link doesn't open, copy the address below and open it in your phone's browser. To come back, open this screen again from the Even app.",
    "링크가 열리지 않으면 아래 주소를 복사해 휴대폰 브라우저에서 여세요. 돌아올 때는 Even 앱에서 이 화면을 직접 여세요.",
  ],
  "dashboard-address-label": ["Dashboard address (press and hold to copy)", "대시보드 주소 (길게 눌러 직접 복사 가능)"],
  "code-label": ["Connection key", "연결 키"],
  "code-hint": [
    "Paste the 64-character connection key you created in your server dashboard.",
    "서버 대시보드에서 만든 64자리 연결 키를 그대로 붙여 넣으세요.",
  ],
  "pair-submit": ["Connect", "연결"],
  disconnect: ["Disconnect and forget this connection", "연결 해제 · 저장된 토큰 지우기"],
  "soniox-legend": ["Voice transcription (your Soniox key)", "음성 전사 (본인 Soniox 키)"],
  "soniox-get-intro": [
    "To ask by voice, you need your own Soniox API key. Sign up or sign in at the Soniox Console, create an API key, then paste it below.",
    "음성으로 질문하려면 본인 Soniox API 키가 필요합니다. Soniox 콘솔에서 가입하거나 로그인해 API 키를 만든 뒤 아래에 붙여 넣으세요.",
  ],
  "soniox-console-text": ["Get a Soniox API key", "Soniox API 키 받기"],
  "soniox-console-note": ["(opens the Soniox Console in your browser)", "(브라우저에서 Soniox 콘솔 열림)"],
  "soniox-privacy": [
    "Your voice goes straight from this phone to Soniox to become text, and only that text is sent to your server. Your key and your audio never reach the server. For safety, create a separate key in the Soniox Console just for this app.",
    "녹음은 이 휴대폰에서 Soniox로 직접 보내 전사하고, 서버에는 전사된 텍스트만 보냅니다. 키와 오디오는 서버로 보내지 않습니다. Soniox 콘솔에서 이 앱 전용 키를 따로 만들어 쓰세요.",
  ],
  "soniox-key-label": ["Soniox API key", "Soniox API 키"],
  "soniox-remember-text": ["Remember the key on this phone", "이 기기에 키 기억하기"],
  "soniox-remember-hint": [
    "When off, the key is kept only until you close the app. Changing this while a key is set saves or removes it right away. The key is kept in Even app storage, which may not be encrypted.",
    "끄면 메모리에만 두고 앱을 닫으면 사라집니다. 키가 적용된 상태에서 바꾸면 바로 저장하거나 지웁니다. Even 앱 저장소에 저장되며 암호화 여부는 확인되지 않았습니다.",
  ],
  "soniox-apply": ["Use this key", "키 적용"],
  "soniox-clear": ["Remove key", "키 지우기"],
  voice: ["Ask Dot", "Dot에게 묻기"],
  "voice-note": [
    "On G2, press and hold, speak, then let go. What you said is turned into text and sent to Dot automatically. Up to 30 seconds; needs a Soniox key.",
    "G2에서 길게 누른 채 말하고 손을 떼면 Soniox로 전사한 뒤 자동으로 Dot에 전송합니다. 최대 30초이며 Soniox 키가 필요합니다.",
  ],
  "auto-send-text": [
    "Send automatically after transcription (turn off to review before sending)",
    "음성 전사 후 자동 전송 (끄면 전사 내용을 검토하고 전송)",
  ],
  "wake-text": [
    "Hey dots hands-free voice (on by default; uses the G2 microphone while the app is open on G2)",
    "Hey dots 로컬 음성 호출 (기본 켜짐 · G2에서 앱이 열려 있는 동안 G2 마이크 사용)",
  ],
  "wake-hint": [
    "The G2 microphone opens only when G2 is ready, you are connected, and a Soniox key is set. This phone listens for the wake word itself, while the app is open on G2, and keeps listening and checking for replies even if the phone screen turns off or locks; the Even app and your phone's background limits may affect this. The phone's own microphone is not used. Say Hey dots (English pronunciation), then your question: only the question after it is transcribed by Soniox and sent to your server as text. If it doesn't respond, press and hold to speak instead. Turning this off stops listening right away.",
    "G2 준비, 서버 연결, Soniox 키가 모두 있을 때만 G2 마이크를 열고, 호출어는 이 휴대폰에서 로컬로 감지합니다. G2에서 앱이 열려 있는 동안 동작하며, 휴대폰 화면이 꺼지거나 잠겨도 이 앱은 듣기와 답변 확인을 계속합니다. 잠금 중 동작은 Even 앱과 휴대폰의 백그라운드 실행 제한에 영향을 받을 수 있습니다. 휴대폰 마이크는 쓰지 않습니다. 영어 발음 Hey dots 뒤에 질문을 말하면, 호출 뒤 질문만 Soniox로 전사하고 그 텍스트를 서버로 전송합니다. 반응하지 않으면 길게 눌러 말하세요. 끄면 즉시 듣기를 멈춥니다.",
  ],
  record: ["Start recording", "녹음 시작"],
  stop: ["Stop and transcribe", "녹음 중지 · 전사"],
  "text-label": ["Message (you can type instead of speaking)", "보낼 내용 (음성 대신 직접 입력 가능)"],
  send: ["Send to Dot", "Dot에 전송"],
  "reply-title": ["Replies from Dot", "Dot 답변"],
  "prev-message": ["Previous message", "이전 메시지"],
  "next-message": ["Next message", "다음 메시지"],
  prev: ["Previous part on G2", "G2 이전 부분"],
  next: ["Next part on G2", "G2 다음 부분"],
};
/** Placeholders that stay until the app writes something in their place. */
export const PLACEHOLDERS: Record<string, readonly [en: string, ko: string]> = {
  status: ["Checking the Even app connection", "Even Hub 연결 확인 중"],
  reply: ["Waiting for a reply.", "답변을 기다립니다."],
  display: ["Not shown on G2 yet", "G2 표시 확인 전"],
};
