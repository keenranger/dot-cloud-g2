import {
  AudioInputSource,
  CreateStartUpPageContainer,
  OsEventTypeList,
  TextContainerProperty,
  TextContainerUpgrade,
  waitForEvenAppBridge,
  type EvenAppBridge,
} from "@evenrealities/even_hub_sdk";
import { boundaryStep, pairCode, relayOrigin, segmentContent, segments } from "./protocol.ts";
import { G2Text } from "./g2-display.ts";
import { captionBody } from "./g2-caption.ts";
import { ExitRequest } from "./g2-guide.ts";
import { g2LifecycleStep, gesture } from "./g2-lifecycle.ts";
import "./style.css";
import { completeVoice, draftFor, transcriptField, utteranceBody, type Draft } from "./voice-flow.ts";
import { SonioxTranscriptionError, openSonioxStream, type SonioxStream } from "./soniox-transcriber.ts";
import { SonioxKey } from "./soniox-key.ts";
import { MessageHistory, type Reply } from "./message-history.ts";
import { loadWakeDetector, type WakeDetector } from "./wake-detector.ts";
import { canListen, finishWakeClip, wakeBlocker, type WakeConditions } from "./wake-gate.ts";
import { PreferenceStore, UNKNOWN_PREFERENCES } from "./preferences.ts";
import {
  APP_NAME,
  LANGUAGE_STORAGE,
  PAGE_TEXT,
  PLACEHOLDERS,
  SPLIT_MARKERS,
  captionFinishing,
  captionLive,
  currentLanguage,
  edgeText,
  failureText,
  idleText,
  messageText,
  parseLanguage,
  setLanguage,
  splitMarkers,
  sttText,
  t,
  wakeBlocked,
  type Language,
} from "./locale.ts";
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
/** Text the app writes itself: a function is said again when the language changes, a string stays as written. */
type Said = string | (() => string);
const said = (text: Said) => (typeof text === "string" ? text : text());
// The function behind each element's current text, so a language change rewrites it in place; user content has none.
const sayings = new Map<string, () => string>();
/** `quiet` skips rewriting identical text, which can make some screen readers announce it again. */
function say(id: string, text: Said, quiet = false): void {
  const value = said(text);
  if (!quiet || el(id).textContent !== value) el(id).textContent = value;
  if (typeof text === "string") sayings.delete(id);
  else sayings.set(id, text);
}
const status = (text: Said) => say("status", text);
const storageKey = "dot-cloud-device-v1";
let bridge: EvenAppBridge | undefined;
let ready = false;
// False between a pagehide that unloads the page and any later pageshow; the page is not running then.
let pageLoaded = true;
// The G2 page is in the glasses foreground. Phone page visibility is deliberately not tracked: a locked phone or a
// backgrounded Even app keeps Hey dots, manual capture and reply polling running.
let active = true;
let exited = false;
let generation = 0;
let credentials: { origin: string; token: string } | undefined;
let requests = new Set<AbortController>();
let storageQueue = Promise.resolve(true);
function saveCredentials(value: string): Promise<boolean> {
  storageQueue = storageQueue.catch(() => false).then(() => bridge!.setLocalStorage(storageKey, value));
  return storageQueue;
}
let pollTimer: ReturnType<typeof setTimeout> | undefined;
let pollRunning = false;
let displayQueue = Promise.resolve();
let displayVersion = 0;
let parts = [t("After connecting, press and hold and speak.", "연결 후 길게 누른 채 말하세요.")];
let part = 0;
// What the G2 body shows: a reply by message id, or one notice. A new selection is shown from its start.
let selection = "notice:0";
let notices = 0;
// A submission notice that the next reply makes obsolete, even when that reply lands behind the message being read.
let replyNotice: string | undefined;
// A one-off header note (a navigation edge, a failed exit request) holds only while the G2 view it answered is unchanged.
let headerNote: { text: () => string; view: string } | undefined;
// A notice that says a capture is in progress; a pause discards the capture, so the notice must not come back with the page.
let captureNotice: string | undefined;
// The reply the phone shows, which stays there while G2 shows a notice; undefined when the phone shows a notice.
let phoneReply: string | undefined;
// The voice whose running text the capture notice shows on G2. It holds the body only while that notice is still
// selected; a reply arriving meanwhile waits, and the user moving to a message ends it.
let caption: { voice: LiveVoice; heading: Said; label: () => string; text: string } | undefined;
// The function behind the G2 notice on screen, so a language change rewrites that notice in place.
let noticeText: { selection: string; text: () => string } | undefined;
// Counts polls that brought new replies. Unlike `history.revision`, an owner deletion or expiry leaves it alone, so
// neither can stand in for a reply that a capture or submission notice should give way to.
let replies = 0;
const view = () => `${selection}#${part}@${history.revision}`;
const g2 = new G2Text((containerID, containerName, content) =>
  bridge!.textContainerUpgrade(
    new TextContainerUpgrade({ containerID, containerName, contentOffset: 0, contentLength: content.length, content }),
  ),
);
const history = new MessageHistory();
const exit = new ExitRequest(() => bridge!.shutDownPageContainer(1));
let recording = false;
let recordingWanted = false;
let micQueue = Promise.resolve();
let bytes = 0;
let recordingTimer: ReturnType<typeof setTimeout> | undefined;
let busy = false;
let keyBusy = false;
// Pairing waits until the saved connection has been read, so a late startup read cannot replace a new pairing.
let restored = false;
let wakeDetector: WakeDetector | undefined;
let wakeMicOpen = false;
// The host did not confirm a G2 microphone stop, so it may still be open. Nothing opens it again until a stop is
// confirmed, and that stop is retried only on an explicit trigger: a G2 resume or exit, a long press, or the toggle.
let micUnconfirmed = false;
const micStopUnconfirmed = () =>
  t(
    "The microphone may still be on. Press and hold to try again, or close the app from the Even app.",
    "마이크 중지를 확인하지 못했습니다. 길게 눌러 다시 시도하거나 Even 앱에서 종료하세요.",
  );
// An audioControl acknowledgement only says the host accepted the request; G2 frames show audio is arriving. The SDK
// documents no frame cadence and may withhold frames in silence, so missing frames are reported as unknown and never
// close, reopen or discard anything.
const FIRST_FRAME_MS = 4000;
const FRAME_GAP_MS = 6000;
let micFrames = 0;
let livenessTimer: ReturnType<typeof setTimeout> | undefined;
// No frame arrived within the bounded wait; the next frame clears it.
let audioQuiet = false;
// Saved voice preferences are read before Hey dots may open the microphone; until then both checkboxes are locked.
let settingsLoaded = false;
let settingsNote: (() => string) | undefined;
const settingsUnread = () =>
  t(
    "Couldn't load your saved voice settings, so Hey dots and automatic sending are off. Turn them back on if you like.",
    "저장된 음성 설정을 불러오지 못해 Hey dots와 자동 전송을 꺼 두었습니다. 필요하면 다시 켜세요.",
  );
const preferences = new PreferenceStore(() => bridge!);
let wakeEpoch = 0;
// Kept as a function so a language change can say the same state again.
let wakeLabel = () => t("Microphone off", "마이크 꺼짐");
// Typed or reviewed text keeps one utterance id until it is accepted, so an identical resend is idempotent on the relay.
let draft: Draft | undefined;
const transcriptions = new Set<{ controller: AbortController; wake: boolean }>();
/** A Soniox session that receives audio while it is captured; its UUID follows the utterance to submission. */
interface LiveVoice {
  stream: SonioxStream;
  entry: { controller: AbortController; wake: boolean };
  id: string;
  version: number;
  keyRevision: number;
  // `replies` when the capture began; a reply received after it is shown once the capture is submitted.
  replies: number;
}
let manualVoice: LiveVoice | undefined;
let wakeVoice: LiveVoice | undefined;
// A transcript would replace typed text, so recording waits until the draft is sent or cleared, as Hey dots does.
const draftPending = () =>
  t(
    "You have an unsent message, so recording is paused. Send or clear it first.",
    "작성 중인 내용이 있어 녹음하지 않습니다. 먼저 전송하거나 지우세요.",
  );
const noKey = () =>
  t(
    "Add your Soniox key in settings to ask by voice. You can also type your message and send it.",
    "Soniox 키가 없어 음성 전사를 할 수 없습니다. 설정에 본인 Soniox 키를 입력하거나 직접 입력해 전송하세요.",
  );
const sonioxKey = new SonioxKey(
  () => bridge!,
  () => {
    // A replaced or removed key cancels transcriptions that started with the previous key.
    abortTranscriptions(() => true);
    keyNotice();
    controls();
    syncWake();
  },
);
function abortTranscriptions(match: (wake: boolean) => boolean): void {
  for (const entry of transcriptions) if (match(entry.wake)) entry.controller.abort();
}
function keyNotice(): void {
  // Without a key the checkbox holds the user's pending choice for the next apply.
  if (sonioxKey.value) el<HTMLInputElement>("soniox-remember").checked = sonioxKey.remembered;
  // Clearing stays available until removal of a possibly stored key is confirmed.
  el("soniox-clear").hidden = !sonioxKey.value && !sonioxKey.remembered && !sonioxKey.unconfirmed;
  say("soniox-status", () =>
    !sonioxKey.value
      ? sonioxKey.unconfirmed
        ? t(
            "The key is cleared here, but removal from Even app storage wasn't confirmed. Tap Remove key again.",
            "키를 지웠지만 Even 앱 저장소 삭제를 확인하지 못했습니다. 다시 지우기를 누르세요.",
          )
        : noKey()
      : sonioxKey.unconfirmed
        ? t(
            "The key works for this session only. A key remembered earlier may still be stored, because the change to Even app storage wasn't confirmed.",
            "키를 이번 실행에만 사용합니다. Even 앱 저장소 변경을 확인하지 못했으니 이전에 기억한 키가 남아 있을 수 있습니다.",
          )
        : sonioxKey.remembered
          ? t(
              "Soniox key set · remembered on this phone in Even app storage until you remove it.",
              "Soniox 키 설정됨 · 이 기기의 Even 앱 저장소에 기억합니다. 지우기 전까지 남습니다.",
            )
          : t(
              "Soniox key set · kept only until you close the app.",
              "Soniox 키 설정됨 · 메모리에만 보관하며 앱을 닫으면 사라집니다.",
            ),
  );
}
function wakeState(): WakeConditions {
  return {
    settings: settingsLoaded,
    enabled: el<HTMLInputElement>("wake-enabled").checked,
    active: active && !exited,
    ready,
    connected: !!credentials,
    transcriber: !!sonioxKey.value,
    busy,
    manual: recordingWanted || recording,
    draft: !!el<HTMLTextAreaElement>("text").value.trim(),
  };
}
function wakeAllowed(): boolean {
  return canListen(wakeState());
}
function wakeNotice(text: () => string): void {
  const value = text();
  if (el("wake-status").textContent !== value) el("wake-status").textContent = value;
  wakeLabel = text;
  if (ready) renderDisplay();
}
/** Asks the host to stop the G2 microphone and records whether the stop was confirmed. */
async function closeMic(): Promise<boolean> {
  clearTimeout(livenessTimer);
  const ok = await bridge!.audioControl(false, AudioInputSource.Glasses).catch(() => false);
  micUnconfirmed = !ok;
  return ok;
}
/**
 * Observes whether G2 frames arrive while a microphone is open. Without frames it only says reception is unconfirmed;
 * the microphone, detector and capture stay as they are, and it stops observing until the next frame.
 */
function watchAudio(): void {
  clearTimeout(livenessTimer);
  const seen = micFrames;
  livenessTimer = setTimeout(
    () => {
      if (!wakeMicOpen && !recording) return;
      if (micFrames > seen) return watchAudio();
      audioQuiet = true;
      wakeNotice(
        recording
          ? () =>
              t(
                "Recording · no sound from G2 yet · keep speaking and it will be picked up.",
                "수동 녹음 중 · G2 오디오 수신 확인 안 됨 · 말하면 이어서 받습니다.",
              )
          : () =>
              t(
                "Hey dots listening · no sound from G2 yet · this can be normal when it's quiet.",
                "Hey dots 듣는 중 · G2 오디오 수신 확인 안 됨 · 조용하면 정상일 수 있습니다.",
              ),
      );
    },
    seen ? FRAME_GAP_MS : FIRST_FRAME_MS,
  );
}
/** `retry` marks an explicit trigger, which may retry one unconfirmed microphone stop. */
function syncWake(retry = false): void {
  if (!wakeAllowed()) {
    wakeEpoch++;
    wakeDetector?.cancel();
    // Hey dots is on by default, so the label says which prerequisite is missing rather than implying it listens.
    const reason = () => {
      const blocked = wakeBlocker(wakeState()) ?? "enabled";
      return () => wakeBlocked(blocked);
    };
    wakeNotice(
      wakeMicOpen || (micUnconfirmed && retry)
        ? () => t("Turning the microphone off", "마이크 중지 요청 중")
        : micUnconfirmed
          ? micStopUnconfirmed
          : reason(),
    );
    // A wake capture that has not finished yet is withdrawn with its Soniox session.
    discardVoice(wakeVoice);
    wakeVoice = undefined;
    // Turning Hey dots off withdraws a post-cue clip that is still being transcribed.
    if (!el<HTMLInputElement>("wake-enabled").checked) abortTranscriptions((wake) => wake);
    queueMic(async () => {
      wakeDetector?.dispose();
      wakeDetector = undefined;
      if (wakeMicOpen || (micUnconfirmed && retry)) {
        wakeMicOpen = false;
        if (!(await closeMic())) {
          wakeNotice(micStopUnconfirmed);
          return;
        }
        wakeNotice(
          !el<HTMLInputElement>("wake-enabled").checked
            ? () => t("Hey dots off · microphone off", "Hey dots 꺼짐 · 마이크 꺼짐")
            : !sonioxKey.value
              ? () =>
                  t(
                    "Hey dots unavailable · no Soniox key · microphone off",
                    "Hey dots 사용 불가 · Soniox 키 없음 · 마이크 꺼짐",
                  )
              : () => t("Hey dots paused · microphone off", "Hey dots 일시 중지 · 마이크 꺼짐"),
        );
        return;
      }
      if (micUnconfirmed) {
        wakeNotice(micStopUnconfirmed);
        return;
      }
      // With no microphone to close, the label keeps the reason, so repeated calls such as keystrokes do not rewrite
      // the G2 header back and forth.
      wakeNotice(reason());
    });
    return;
  }
  queueMic(async () => {
    if (!wakeAllowed() || wakeMicOpen) return;
    if (micUnconfirmed) {
      // Never open over a microphone that may still be on; only an explicit trigger retries the stop.
      if (!retry || !(await closeMic())) return wakeNotice(micStopUnconfirmed);
      if (!wakeAllowed()) return;
    }
    const epoch = ++wakeEpoch;
    const version = generation;
    wakeNotice(() => t("Getting Hey dots ready on this phone", "Hey dots 로컬 감지 모델 준비 중"));
    try {
      const detector = await loadWakeDetector(
        (event) => {
          if (epoch !== wakeEpoch || !current(version) || !wakeAllowed()) return;
          if (event.type === "audio") {
            wakeVoice?.stream.write(event.pcm);
          } else if (event.type === "wake") {
            // Soniox connects right after the cue; only post-cue speech confirmed by local VAD is written to it.
            discardVoice(wakeVoice);
            wakeVoice = openVoice(version, true);
            wakeNotice(() => t("Hey dots heard · ask your question now.", "Hey dots 감지됨 · 이제 질문을 말하세요."));
            captureText(
              () => t("Hey dots heard · ask your question.", "Hey dots 감지됨 · 질문을 말하세요."),
              wakeVoice,
            );
          } else {
            const voice = wakeVoice;
            wakeVoice = undefined;
            busy = true;
            syncWake();
            controls();
            const clip = event.wav;
            const deliveryEpoch = wakeEpoch;
            queueMic(async () => {
              try {
                if (!current(version)) {
                  discardVoice(voice);
                  return;
                }
                await finishWakeClip({
                  clip,
                  canUpload: () =>
                    deliveryEpoch === wakeEpoch && active && el<HTMLInputElement>("wake-enabled").checked,
                  upload: async () => (voice ? finishVoice(voice) : showNotice(noKey)),
                  restore: () => {
                    discardVoice(voice);
                    if (history.selected) showSelectedReply();
                    else
                      displayText(() =>
                        t(
                          "Ready for your question. Say Hey dots or press and hold to speak.",
                          "질문을 기다립니다. Hey dots 또는 길게 누르기로 말하세요.",
                        ),
                      );
                  },
                });
              } catch (e) {
                if (current(version)) report(e);
              } finally {
                if (current(version)) {
                  busy = false;
                  controls();
                  syncWake();
                }
              }
            });
          }
        },
        () => {
          if (epoch !== wakeEpoch) return;
          el<HTMLInputElement>("wake-enabled").checked = false;
          syncWake();
          wakeNotice(() =>
            t(
              "Hey dots stopped listening. Press and hold to speak, or type your message.",
              "로컬 감지가 중단되었습니다. 길게 누르기나 직접 입력을 이용하세요.",
            ),
          );
        },
        "dots",
      );
      if (!wakeAllowed() || epoch !== wakeEpoch || !current(version)) {
        detector.dispose();
        return;
      }
      wakeDetector = detector;
      if (!(await bridge!.audioControl(true, AudioInputSource.Glasses)))
        throw new LocalizedError(() => t("Couldn't turn on the G2 microphone.", "G2 마이크를 시작하지 못했습니다."));
      wakeMicOpen = true;
      micFrames = 0;
      audioQuiet = false;
      if (!wakeAllowed() || epoch !== wakeEpoch || !current(version)) {
        detector.dispose();
        wakeDetector = undefined;
        wakeMicOpen = false;
        if (!(await closeMic())) wakeNotice(micStopUnconfirmed);
        return;
      }
      detector.listen();
      wakeNotice(() =>
        t("G2 microphone turning on · waiting for sound", "G2 마이크 시작 요청 수락 · 오디오 수신 대기 중"),
      );
      watchAudio();
    } catch (e) {
      el<HTMLInputElement>("wake-enabled").checked = false;
      syncWake();
      report(e);
    }
  });
}
/** An error whose message is said again when the language changes. */
class LocalizedError extends Error {
  readonly text: () => string;
  constructor(text: () => string) {
    super(text());
    this.text = text;
  }
}
/** How an error reads in the selected language; `fallback` covers a value that is not an Error. */
const errorText =
  (e: unknown, fallback: () => string): (() => string) =>
  () =>
    e instanceof LocalizedError ? e.text() : e instanceof Error ? messageText(e.message) : fallback();
/** The relay refused an utterance ID it no longer holds: the owner deleted it, or it passed retention. */
class UtteranceGone extends LocalizedError {}
const erased = () =>
  t(
    "Your conversation history was deleted, so its replies are gone from this phone too. Anything you were typing is kept, and you can ask a new question.",
    "대화 기록이 삭제되어 이 기기에 보이던 답변을 모두 지웠습니다. 입력 중이던 내용은 그대로이며 새 질문을 보낼 수 있습니다.",
  );
const expired = () =>
  t(
    "Replies older than the keep period were removed from this phone too.",
    "보관 기간이 지난 답변을 이 기기에서도 지웠습니다.",
  );
const ackPending = () => t("final answer coming", "최종 답변 대기");
const ackLabel = () => t("Interim reply", "중간 답변");
const finalLabel = () => t("Final answer", "최종 답변");
const report = (e: unknown) => status(errorText(e, () => t("Something went wrong.", "작업을 완료하지 못했습니다.")));
const current = (version: number) => !exited && generation === version;
function controls(): void {
  const typed = !!el<HTMLTextAreaElement>("text").value.trim();
  el<HTMLButtonElement>("record").disabled =
    !ready ||
    !settingsLoaded ||
    !credentials ||
    !sonioxKey.value ||
    busy ||
    recordingWanted ||
    recording ||
    !active ||
    typed;
  // The page default must not be saved over a choice that is still being read.
  el<HTMLInputElement>("wake-enabled").disabled = el<HTMLInputElement>("auto-send").disabled = !settingsLoaded;
  el<HTMLButtonElement>("stop").disabled = !recordingWanted && !recording;
  el<HTMLButtonElement>("send").disabled =
    !credentials || busy || recordingWanted || !el<HTMLTextAreaElement>("text").value.trim();
  el("disconnect").hidden = !credentials;
  el<HTMLButtonElement>("pair-submit").disabled = busy || !bridge || !restored;
  el<HTMLButtonElement>("soniox-apply").disabled = el<HTMLButtonElement>("soniox-clear").disabled = keyBusy || !bridge;
  el("pair").setAttribute("aria-busy", String(busy && !credentials));
  // Says why recording is unavailable instead of leaving a silently disabled button.
  const hint = !bridge
    ? t("Waiting for the Even app.", "Even 앱 연결을 기다리는 중입니다.")
    : !ready
      ? t("Getting the G2 screen ready.", "G2 화면을 준비하는 중입니다.")
      : !settingsLoaded
        ? t("Loading your saved voice settings.", "저장된 음성 설정을 불러오는 중입니다.")
        : !credentials
          ? t("Connect to your server to record.", "녹음하려면 먼저 서버에 연결하세요.")
          : !sonioxKey.value
            ? t(
                "Add a Soniox key to record. You can still type your message below and send it.",
                "녹음하려면 Soniox 키가 필요합니다. 아래에 직접 입력해 전송할 수는 있습니다.",
              )
            : busy
              ? t("Finishing the previous request.", "이전 요청을 처리하는 중입니다.")
              : typed && !recordingWanted && !recording
                ? draftPending()
                : "";
  if (el("record-hint").textContent !== hint) el("record-hint").textContent = hint;
  el("record-hint").hidden = !hint;
  el<HTMLButtonElement>("prev-message").disabled = history.index <= 0;
  el<HTMLButtonElement>("next-message").disabled = history.index < 0 || history.index >= history.messages.length - 1;
  const stage = history.selected ? stageLabel(history.selected) : "";
  const position = history.messages.length
    ? t(
        `Message ${history.index + 1} of ${history.messages.length}${stage ? ` · ${stage}` : ""}`,
        `${history.index + 1} / ${history.messages.length}개 메시지${stage ? ` · ${stage}` : ""}`,
      )
    : t("No messages yet.", "아직 받은 메시지가 없습니다.");
  // Rewriting identical text can make some screen readers announce it again.
  if (el("message-position").textContent !== position) el("message-position").textContent = position;
}
/** A button that disables itself at an edge hands focus to its partner, so keyboard and screen reader users keep their place. */
function keepFocus(from: string, to: string): void {
  const button = el<HTMLButtonElement>(from);
  if (document.activeElement === button && button.disabled) el(to).focus();
}
async function request<T>(path: string, method = "GET", body?: BodyInit, type = "application/json"): Promise<T> {
  const saved = credentials;
  if (!saved) throw new LocalizedError(() => t("Connect to your server first.", "먼저 서버에 연결하세요."));
  const version = generation;
  const controller = new AbortController();
  requests.add(controller);
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 45000);
  try {
    const response = await fetch(saved.origin + path, {
      method,
      ...(body !== undefined ? { body } : {}),
      signal: controller.signal,
      headers: { Authorization: `Bearer ${saved.token}`, ...(body ? { "Content-Type": type } : {}) },
    });
    if (!current(version)) throw new DOMException("Connection changed", "AbortError");
    if (response.status === 401)
      throw new LocalizedError(() =>
        t(
          "This connection has expired. Disconnect, then connect again with a new connection key.",
          "연결이 만료되었습니다. 연결 해제 후 새 연결 키로 연결하세요.",
        ),
      );
    if (response.status === 410)
      throw new UtteranceGone(() =>
        t(
          "The server didn't take this question because the conversation was deleted or passed its keep period. It won't be resent automatically; sending again sends it as a new question.",
          "대화 기록 삭제 또는 보관 기간 만료로 서버가 이 질문을 받지 않았습니다. 자동으로 다시 보내지 않으며, 다시 전송하면 새 질문으로 보냅니다.",
        ),
      );
    if (!response.ok)
      throw new LocalizedError(() =>
        t(`Server request failed (${response.status})`, `서버 요청 실패 (${response.status})`),
      );
    const result = (await response.json()) as T;
    if (!current(version)) throw new DOMException("Connection changed", "AbortError");
    return result;
  } catch (e) {
    // Only a request that got no usable response is rephrased; fetch reports a network failure as a TypeError.
    if (!controller.signal.aborted && !(e instanceof TypeError)) throw e;
    if (!current(version)) throw new DOMException("Connection changed", "AbortError");
    const kind = timedOut ? "timeout" : controller.signal.aborted ? "cancelled" : "network";
    throw new LocalizedError(() => failureText(kind, method !== "GET"));
  } finally {
    clearTimeout(timeout);
    requests.delete(controller);
  }
}
function cancelRequests(): void {
  generation++;
  displayVersion++;
  clearTimeout(pollTimer);
  for (const request of requests) request.abort();
  requests = new Set();
  abortTranscriptions(() => true);
}
/** `quiet` marks running text on G2: the phone display status announces neither each partial nor a poll's retry. */
function renderDisplay(quiet = captionShown()): void {
  const version = ++displayVersion;
  const connectionVersion = generation;
  // Until the first reply or notice, the body names the next setup step.
  if (selection === "notice:0") {
    parts = [idleText({ restored, connected: !!credentials, transcriber: !!sonioxKey.value })];
    part = 0;
  }
  const content = segmentContent(parts, part, splitMarkers());
  const key = `${selection}#${part}`;
  // Phone part buttons only exist for a reply too long for one G2 update.
  const single = parts.length < 2;
  // A part button hidden while focused would drop focus to the page; it goes to the message controls or the reply.
  if (single && (document.activeElement === el("prev") || document.activeElement === el("next"))) {
    const target =
      ["next-message", "prev-message"].map((id) => el<HTMLButtonElement>(id)).find((button) => !button.disabled) ??
      el("reply");
    if (target === el("reply")) el("reply").tabIndex = -1;
    target.focus();
  }
  el("prev").hidden = el("next").hidden = single;
  el<HTMLButtonElement>("prev").disabled = part === 0;
  el<HTMLButtonElement>("next").disabled = part === parts.length - 1;
  // A render that writes nothing, such as a keystroke, leaves the display status alone instead of announcing it again.
  if (!ready)
    displayStatus(() =>
      t("G2 not connected yet · you can read here on your phone.", "G2 연결 전 · 휴대폰에서 읽을 수 있습니다."),
    );
  else if (!quiet && (!g2.has(2, g2Header()) || !g2.has(1, content, key)))
    displayStatus(() => t("Showing on G2…", "G2 표시 요청 중"));
  displayQueue = displayQueue
    .then(async () => {
      if (!ready || !bridge || !active || !current(connectionVersion) || version !== displayVersion) return;
      // Status goes to the header only; an unchanged body is not rewritten, so its native scroll position stays.
      // The whole reply goes to the event-capturing container, which scrolls it natively on G2.
      const ok = await g2.show(1, "reply", content, key);
      if (!current(connectionVersion) || version !== displayVersion) return;
      const headerOk = await g2.show(2, "microphone", g2Header());
      if (!current(connectionVersion) || version !== displayVersion) return;
      displayStatus(
        !(ok && headerOk)
          ? () =>
              t(
                "Couldn't update G2 · read the reply here on your phone.",
                "G2 표시 갱신 실패 · 휴대폰에서 답변을 확인하세요.",
              )
          : quiet
            ? () => t("Showing the live transcript (not final) on G2", "G2에 실시간 인식(미확정) 표시 중")
            : () => t("Shown on G2.", "G2가 표시 갱신을 확인했습니다."),
      );
    })
    .catch(() => {
      if (current(connectionVersion) && version === displayVersion)
        displayStatus(() => t("Couldn't confirm that G2 was updated.", "G2 표시 갱신을 확인하지 못했습니다."));
    });
}
function displayStatus(text: Said): void {
  say("display", text, true);
}
/**
 * An utterance's acknowledgement and final answer are separate messages: the acknowledgement is labelled intermediate,
 * and says the final answer is still coming until it is kept here; the final is labelled final beside its
 * acknowledgement. A reply without an acknowledgement keeps no label.
 */
function stageLabel(reply: Reply): string {
  if (reply.stage === "ack") return history.paired(reply) ? ackLabel() : `${ackLabel()} · ${ackPending()}`;
  return history.paired(reply) ? finalLabel() : "";
}
/** The message position leads the header, so moving between replies with identical text is still visible. */
function g2Header(): string {
  const reading = selection.startsWith("reply:") && history.index >= 0;
  const position = reading
    ? t(`Reply ${history.index + 1}/${history.messages.length}`, `답변 ${history.index + 1}/${history.messages.length}`)
    : "";
  const stage = reading && history.selected ? stageLabel(history.selected) : "";
  const note = headerNote?.view === view() ? headerNote.text() : "";
  return Array.from([position, stage, note, wakeLabel()].filter(Boolean).join(" · ")).slice(0, 70).join("");
}
function showSelectedReply(): void {
  const reply = history.selected;
  if (!reply) return;
  say("reply", reply.text);
  phoneReply = reply.message_id;
  parts = segments(reply.text, SPLIT_MARKERS);
  part = 0;
  selection = `reply:${reply.message_id}`;
  controls();
  renderDisplay();
}
/** Shows status text in the G2 body in place of a reply. */
function displayText(text: Said): void {
  parts = segments(said(text), SPLIT_MARKERS);
  part = 0;
  selection = `notice:${++notices}`;
  noticeText = typeof text === "string" ? undefined : { selection, text };
  renderDisplay();
}
/** A capture notice; with `voice`, its running text is shown under `label` once Soniox reports any. */
function captureText(text: Said, voice?: LiveVoice, label = captionLive): void {
  // The same voice moving on to finishing keeps what was already heard, unless the user has left its notice.
  const heard = voice && caption?.voice === voice && selection === captureNotice ? caption.text : "";
  displayText(heard ? captionBody(label(), heard) : text);
  captureNotice = selection;
  caption = voice ? { voice, heading: text, label, text: heard } : undefined;
}
function captionHolds(): boolean {
  return !!caption && selection === captureNotice;
}
function captionShown(): boolean {
  return captionHolds() && !!caption!.text;
}
/** Shows a partial on G2 only while its own capture notice is selected; writes are paced by G2 acknowledgements. */
function showCaption(voice: LiveVoice, text: string): void {
  if (caption?.voice !== voice || !captionHolds()) return;
  caption.text = text;
  parts = segments(text ? captionBody(caption.label(), text) : said(caption.heading), SPLIT_MARKERS);
  part = 0;
  renderDisplay(true);
}
const captureStopped = () =>
  t("Voice input stopped · nothing was sent.", "음성 입력을 멈췄습니다 · 전송하지 않았습니다.");
/**
 * A voice that ends without submission while its notice still holds the body: a reply received during the capture
 * comes back in its place, otherwise `notice` says the capture stopped. Unconfirmed text never stays on G2.
 * Returns whether the body was replaced.
 */
function releaseCaption(voice: LiveVoice | undefined, notice: Said = captureStopped): boolean {
  if (!voice || caption?.voice !== voice) return false;
  const held = captionHolds();
  caption = undefined;
  // A paused page keeps the capture notice selected, so resume brings the reader back.
  if (!held || !active) return false;
  if (replyWaiting(voice.replies)) restoreReader();
  else displayText(notice);
  return true;
}
/** A reply arrived since `since` and is still kept: a deletion that took it leaves nothing to come back. */
function replyWaiting(since: number): boolean {
  return replies !== since && !!history.selected;
}
/** A reply arrived behind the reader while G2 waited for it: the message being read comes back in place of the notice. */
function restoreReader(): void {
  status(
    history.index < history.messages.length - 1
      ? () =>
          t(
            "Dot replied · going back to the message you were reading. Move to the next message to see the new reply.",
            "Dot 답변 수신 · 읽던 메시지로 돌아갑니다. 새 답변은 다음 메시지로 이동해 확인하세요.",
          )
      : () => t("Dot replied · showing the latest reply on G2.", "Dot 답변 수신 · G2에 최신 답변을 표시합니다."),
  );
  showSelectedReply();
}
function moveMessage(delta: number): void {
  if (history.move(delta)) showSelectedReply();
}
/** Phone buttons step through the parts of a split reply without leaving the message. */
function movePart(delta: number): void {
  part = Math.max(0, Math.min(parts.length - 1, part + delta));
  renderDisplay();
}
/** A G2 scroll boundary event continues to the adjacent part of a split reply, else to the adjacent message from its start. */
function turn(delta: number): void {
  const step = boundaryStep(part, parts.length, delta);
  if ("part" in step) {
    part = step.part;
    renderDisplay();
  } else if (history.move(step.message)) showSelectedReply();
  else {
    // Only the header says why nothing moved, so the body and its native scroll position stay.
    const count = history.messages.length;
    headerNote = { text: () => edgeText(count, step.message), view: view() };
    renderDisplay();
  }
}
// Compared by identity, so the note is recognized whichever language it was shown in.
const exitFailed = () => t("Couldn't close · double-tap again", "종료 요청 실패 · 다시 두 번 탭하세요");
/** A root-page double tap asks the host to confirm the exit; the session continues until the host reports it. */
function requestExit(): void {
  if (exited) return;
  void exit.request().then((ok) => {
    if (ok === undefined || exited) return;
    if (ok) {
      // The host shows its confirmation; an earlier failure note no longer holds.
      if (headerNote?.text !== exitFailed) return;
      headerNote = undefined;
    } else {
      status(() =>
        t(
          "Couldn't ask G2 to close the app. Double-tap again, or close it from the Even app.",
          "G2 종료 요청을 보내지 못했습니다. 다시 두 번 탭하거나 Even 앱에서 종료하세요.",
        ),
      );
      headerNote = { text: exitFailed, view: view() };
    }
    if (active) renderDisplay();
  });
}
async function poll(): Promise<void> {
  if (pollRunning || !active || exited || !credentials) return;
  // A poll started early replaces the scheduled one, so every caller keeps a single 2.5-second chain.
  clearTimeout(pollTimer);
  const version = generation;
  pollRunning = true;
  try {
    const result = await request<{ messages: Reply[]; conversation_revision?: unknown; retention_cutoff?: unknown }>(
      "/api/device/messages",
    );
    if (!current(version) || !active) return;
    const revision = history.revision;
    // The revision is applied before the messages it was read with; an older snapshot is not shown at all.
    const conversation = history.observe(result.conversation_revision);
    if (conversation === "stale" || conversation === "invalid") {
      status(
        conversation === "stale"
          ? () =>
              t(
                "Skipped an outdated server response that is older than the conversation already shown.",
                "이미 반영한 대화 기록보다 오래된 서버 응답이라 표시하지 않았습니다.",
              )
          : () =>
              t(
                "Skipped a server response without a conversation version, because it could include deleted replies.",
                "서버 응답에 대화 기록 버전이 없어 삭제된 답변이 섞였을 수 있으므로 표시하지 않았습니다.",
              ),
      );
      return;
    }
    if (conversation === "erased") conversationErased();
    const pruned = history.expire(result.retention_cutoff);
    // Expiry alone bumps the revision but brings no reply that a waiting notice could give way to.
    const kept = history.revision;
    const changed = history.receive(result.messages);
    if (history.revision !== kept) replies++;
    controls();
    // The reply on screen passed retention and no newer reply replaces it: the reader moves to the oldest kept one.
    if (pruned && !changed && selection.startsWith("reply:") && `reply:${history.selected?.message_id}` !== selection) {
      status(expired);
      if (history.selected) showSelectedReply();
      else {
        say("reply", expired);
        phoneReply = undefined;
        displayText(expired);
      }
    } else if (changed && captionHolds() && history.selected!.utterance_id !== caption!.voice.id) {
      // The phone shows the reply now; G2 keeps the running speech and shows the reply when the capture is submitted.
      // A reply to the capture itself (its acknowledgement or final) answers what the notice is waiting for, below.
      say("reply", history.selected!.text);
      phoneReply = history.selected!.message_id;
      status(
        conversation === "erased"
          ? () =>
              t(
                `${erased()} The new reply will show on G2 after your voice input is sent.`,
                `${erased()} 새 답변은 음성 입력을 전송한 뒤 G2에 표시합니다.`,
              )
          : () =>
              t(
                "Dot replied · it will show on G2 after your voice input is sent.",
                "Dot 답변 수신 · 음성 입력 중이라 G2에는 전송 후 표시합니다.",
              ),
      );
    } else if (changed) {
      status(
        conversation === "erased"
          ? () => t(`${erased()} Showing the new reply.`, `${erased()} 새 답변을 표시합니다.`)
          : history.selected!.stage === "ack"
            ? () =>
                t(
                  `Dot ${ackLabel().toLowerCase()} received · ${ackPending()} · showing it on G2.`,
                  `Dot ${ackLabel()} 수신 · ${ackPending()} · G2 표시를 요청합니다.`,
                )
            : history.paired(history.selected!)
              ? () =>
                  t(
                    `Dot ${finalLabel().toLowerCase()} received · showing it on G2. The ${ackLabel().toLowerCase()} stays in the previous message.`,
                    `Dot ${finalLabel()} 수신 · G2 표시를 요청합니다. ${ackLabel()}도 이전 메시지에 남아 있습니다.`,
                  )
              : () => t("Dot replied · showing it on G2.", "Dot 답변 수신 · G2 표시를 요청합니다."),
      );
      showSelectedReply();
    } else if (history.revision !== kept && selection === replyNotice) restoreReader();
    // New replies behind the reader only change the header position; the body keeps its scroll.
    else if (
      history.revision !== revision ||
      (ready &&
        (!g2.has(2, g2Header()) || !g2.has(1, segmentContent(parts, part, splitMarkers()), `${selection}#${part}`)))
    )
      renderDisplay();
    // G2 keeps its notice, but the reply left on the phone behind it expired too: the phone moves to the oldest kept one.
    // The status line still describes the capture or wait in progress; the live reply region announces the change.
    if (pruned && phoneReply && !history.messages.some((reply) => reply.message_id === phoneReply)) {
      say("reply", history.selected?.text ?? expired);
      phoneReply = history.selected?.message_id;
    }
  } catch (e) {
    if (current(version) && active) report(e);
  } finally {
    pollRunning = false;
    if (!exited && active && credentials) pollTimer = setTimeout(() => void poll(), current(version) ? 2500 : 0);
  }
}
/**
 * The owner deleted the conversation: the replies shown here are gone, on the phone and on G2. The text field, its
 * draft, the key, pairing, preferences, the microphone and any capture in progress are left as they are.
 */
function conversationErased(): void {
  replyNotice = undefined;
  headerNote = undefined;
  say("reply", erased);
  phoneReply = undefined;
  status(erased);
  // A capture notice is current work, not old history, so it stays on G2 until the capture moves on.
  if (selection !== captureNotice) displayText(erased);
}
function queueMic(action: () => Promise<void>): void {
  micQueue = micQueue.then(action).catch(report).finally(controls);
}
function showNotice(text: Said): void {
  status(text);
  displayText(text);
}
function showPartial(text: string): void {
  el("partial").hidden = !text;
  say("partial", () => (text ? `${captionLive()}: ${text}` : ""));
}
function voiceLive(voice: LiveVoice): boolean {
  return (
    current(voice.version) &&
    active &&
    !voice.entry.controller.signal.aborted &&
    sonioxKey.revision === voice.keyRevision &&
    (!voice.entry.wake || el<HTMLInputElement>("wake-enabled").checked)
  );
}
/** Audio goes from the phone straight to Soniox with the user's key while it is captured; only the transcript reaches the relay. */
function openVoice(version: number, wake: boolean): LiveVoice | undefined {
  const key = sonioxKey.value;
  if (!key || !current(version) || !active) return undefined;
  const entry = { controller: new AbortController(), wake };
  transcriptions.add(entry);
  const voice: LiveVoice = {
    entry,
    id: crypto.randomUUID(),
    version,
    keyRevision: sonioxKey.revision,
    replies,
    stream: openSonioxStream({
      credential: () => key,
      signal: entry.controller.signal,
      // Running text is shown, marked unconfirmed; history and submission wait for the final transcript.
      onPartial: (text) => {
        if (!voiceLive(voice)) return;
        showPartial(text);
        showCaption(voice, text);
      },
    }),
  };
  // An abandoned stream must not become an unhandled rejection; failures surface through end().
  voice.stream.result.catch(() => undefined);
  return voice;
}
function discardVoice(voice: LiveVoice | undefined): void {
  if (!voice) return;
  voice.entry.controller.abort();
  transcriptions.delete(voice.entry);
  showPartial("");
  releaseCaption(voice);
}
async function finishVoice(voice: LiveVoice): Promise<void> {
  const { version, id } = voice;
  if (!current(version) || !active) return discardVoice(voice);
  status(() =>
    t("Finishing your transcript · waiting for the final text", "음성 전사 마무리 중 · Soniox 최종 결과 대기"),
  );
  // After the user moved to a message, the finishing notice no longer shows this voice's running text.
  const owner = caption?.voice === voice && captionHolds() ? voice : undefined;
  captureText(
    () => t("Finishing your transcript · not sent yet", "음성 전사 마무리 중 · 아직 전송 전"),
    owner,
    captionFinishing,
  );
  let kept = false;
  // Once the transcript was handed to the relay, a failure leaves its storage unknown, so G2 must not say "not sent".
  let submitted = false;
  let notice: Said = captureStopped;
  try {
    await completeVoice({
      transcribe: () => voice.stream.end(),
      current: () => voiceLive(voice),
      automatic: () => el<HTMLInputElement>("auto-send").checked,
      review: (text) => {
        const field = el<HTMLTextAreaElement>("text");
        const automatic = el<HTMLInputElement>("auto-send").checked;
        // Text typed after the recording started stays; see transcriptField.
        const next = transcriptField(field.value, text, automatic);
        field.value = next.value;
        if (next.draft) draft = { id, text };
        else if (!automatic) draft = undefined;
        controls();
        if (automatic) return next.draft;
        status(
          next.draft
            ? () => t("Transcript ready · check it, then send.", "전사 완료 · 내용을 확인한 뒤 전송하세요.")
            : () =>
                t(
                  "Transcript ready · added after what you were typing. Check it, then send.",
                  "전사 완료 · 입력 중이던 내용 뒤에 전사 결과를 붙였습니다. 확인한 뒤 전송하세요.",
                ),
        );
        // A reply received during the capture comes back in place of the notice; the phone keeps the review prompt.
        if (caption?.voice === voice && captionHolds() && replyWaiting(voice.replies)) showSelectedReply();
        else
          displayText(() =>
            t("Transcript ready · check it on your phone, then send.", "전사 완료 · 휴대폰에서 확인한 뒤 전송하세요."),
          );
        return next.draft;
      },
      send: (text) => {
        submitted = true;
        return sendText(text, version, id, voice.replies);
      },
      // A failed automatic send leaves the transcript in the field as review mode would, on the same connection only.
      keep: (text) => {
        if (!current(version)) return;
        const field = el<HTMLTextAreaElement>("text");
        const next = transcriptField(field.value, text, false);
        field.value = next.value;
        draft = next.draft ? { id, text } : undefined;
        kept = true;
        controls();
      },
    });
  } catch (e) {
    // keep() may have put the refused ID back with the transcript; a resend must use a new one.
    if (e instanceof UtteranceGone && draft?.id === id) draft = undefined;
    if (submitted)
      notice = errorText(e, () => t("Couldn't confirm whether it was sent.", "전송 결과를 확인하지 못했습니다."));
    if (kept) {
      const reason = errorText(e, () => t("Couldn't send.", "전송하지 못했습니다."));
      throw new LocalizedError(() =>
        t(
          `${reason()} Your transcript is kept in the message box. Check it and send again.`,
          `${reason()} 전사 결과를 입력란에 남겼습니다. 확인한 뒤 다시 전송하세요.`,
        ),
      );
    }
    if (!(e instanceof SonioxTranscriptionError)) throw e;
    // Cancellation by a key change or Hey dots off still replaces the "transcribing" notice on G2, unless a reply
    // received during the capture comes back in its place; the phone status keeps the reason either way.
    if (current(version) && active) {
      const message = () => sttText(e);
      if (releaseCaption(voice, message)) status(message);
      else showNotice(message);
    }
  } finally {
    transcriptions.delete(voice.entry);
    showPartial("");
    releaseCaption(voice, notice);
  }
}
function startRecording(): void {
  if (!ready || !settingsLoaded || !credentials || recordingWanted || recording || busy || !active || !bridge) return;
  if (!sonioxKey.value) return showNotice(noKey);
  if (el<HTMLTextAreaElement>("text").value.trim()) return showNotice(draftPending);
  recordingWanted = true;
  // A long press is an explicit trigger, so an unconfirmed earlier stop is retried once before this capture opens.
  syncWake(true);
  bytes = 0;
  controls();
  const version = generation;
  // Soniox connects while the microphone starts, so speech is recognized while it is spoken.
  const voice = openVoice(version, false);
  manualVoice = voice;
  // A failed or overloaded session ends the recording now instead of after the user releases.
  voice?.stream.result.catch(() => {
    if (manualVoice === voice) stopRecording(false);
  });
  const withdraw = () => {
    if (manualVoice === voice) manualVoice = undefined;
    discardVoice(voice);
  };
  queueMic(async () => {
    try {
      if (!current(version) || !recordingWanted || !active) return withdraw();
      if (wakeMicOpen || micUnconfirmed) {
        recordingWanted = false;
        withdraw();
        throw new LocalizedError(micStopUnconfirmed);
      }
      if (!(await bridge!.audioControl(true, AudioInputSource.Glasses))) {
        recordingWanted = false;
        withdraw();
        throw new LocalizedError(() => t("Couldn't turn on the G2 microphone.", "G2 마이크를 시작하지 못했습니다."));
      }
      recording = true;
      micFrames = 0;
      audioQuiet = false;
      wakeNotice(() =>
        t(
          "G2 microphone turning on · waiting for your voice",
          "G2 마이크 시작 요청 수락 · 수동 녹음 오디오 수신 대기 중",
        ),
      );
      if (!current(version) || !recordingWanted || !active) return;
      watchAudio();
      status(() =>
        t(
          "Recording · turning your voice into text as you speak · stop to send the final text.",
          "녹음 중 · Soniox 실시간 전사 중 · 중지하면 최종 결과를 전송합니다.",
        ),
      );
      captureText(
        () => t("Recording · let go to transcribe and send.", "녹음 중 · 손을 떼면 전사 후 전송합니다."),
        voice,
      );
      recordingTimer = setTimeout(() => stopRecording(false), 30000);
    } finally {
      // A manual capture that never opened the microphone hands it back to Hey dots.
      if (current(version) && !recordingWanted && !recording) syncWake();
    }
  });
}
function stopRecording(discard: boolean): void {
  if (!recordingWanted && !recording) return;
  recordingWanted = false;
  clearTimeout(recordingTimer);
  controls();
  const version = generation;
  const voice = manualVoice;
  manualVoice = undefined;
  queueMic(async () => {
    try {
      if (!recording) return discardVoice(voice);
      const ok = await closeMic();
      recording = false;
      if (!ok) {
        // The capture is over either way; the unconfirmed stop keeps every later open waiting for a confirmed one.
        discardVoice(voice);
        status(micStopUnconfirmed);
        wakeNotice(micStopUnconfirmed);
        return;
      }
      wakeNotice(() => t("Microphone off · processing your voice", "마이크 꺼짐 · 음성 처리 중"));
      bytes = 0;
      if (!voice || discard || !current(version) || !active) return discardVoice(voice);
      busy = true;
      controls();
      try {
        await finishVoice(voice);
      } catch (e) {
        if (current(version)) report(e);
      } finally {
        if (current(version)) {
          busy = false;
          controls();
        }
      }
    } finally {
      // Every manual capture that released the microphone, including a discarded or empty one, hands it back to Hey
      // dots; an unconfirmed stop keeps the header saying the microphone may still be on.
      if (current(version) && !recordingWanted && !recording) syncWake();
    }
  });
}
el("record").onclick = startRecording;
el("stop").onclick = () => stopRecording(false);
el("prev").onclick = () => {
  movePart(-1);
  keepFocus("prev", "next");
};
el("next").onclick = () => {
  movePart(1);
  keepFocus("next", "prev");
};
el("prev-message").onclick = () => {
  moveMessage(-1);
  keepFocus("prev-message", "next-message");
};
el("next-message").onclick = () => {
  moveMessage(1);
  keepFocus("next-message", "prev-message");
};
el("text").oninput = () => {
  if (!el<HTMLTextAreaElement>("text").value.trim()) draft = undefined;
  controls();
  syncWake();
};
/** Saves an explicit choice; a failed write is said, since the next launch would then use the previous choice. */
function savePreferences(): void {
  void preferences
    .save({
      wake: el<HTMLInputElement>("wake-enabled").checked,
      autoSend: el<HTMLInputElement>("auto-send").checked,
    })
    .then((ok) => {
      if (ok === false)
        status(() =>
          t(
            "Couldn't save your settings. They apply now, but the next launch may use your previous settings.",
            "설정을 저장하지 못했습니다. 이번 실행에는 적용되지만 다음 실행에서는 이전 설정이 쓰일 수 있습니다.",
          ),
        );
    });
}
el("wake-enabled").onchange = () => {
  // The toggle is an explicit retry after an unconfirmed stop.
  savePreferences();
  syncWake(true);
};
el("auto-send").onchange = savePreferences;
/** `since` is the `replies` count a reply must come after to replace the submission notice. */
async function sendText(text: string, version: number, id: string, since = replies): Promise<void> {
  if (!current(version) || !active) return;
  const erasures = history.erasures;
  status(() => t("Sending to your server · not confirmed yet", "서버로 전송 중 · 아직 저장 확인 전"));
  let result: { status: string };
  try {
    result = await request<{ status: string }>("/api/device/utterances", "POST", utteranceBody(id, text));
  } catch (e) {
    // The relay will refuse this ID for good, so a deliberate resend of the same text gets a new one.
    if (e instanceof UtteranceGone && draft?.id === id) draft = undefined;
    throw e;
  }
  if (!current(version) || !active) return;
  const message =
    result.status === "accepted"
      ? () =>
          t("Saved and delivered to Dot · waiting for a reply.", "서버 저장 및 Dot 콜백 수신 확인 · 답변을 기다립니다.")
      : () =>
          t(
            "Saved on your server · Dot hasn't confirmed it or replied yet.",
            "서버에 저장됨 · Dot 수신과 답변은 아직 확인되지 않았습니다.",
          );
  if (history.erasures !== erasures) {
    // Accepted around a deletion: it may have been deleted with the conversation, so no waiting state is claimed.
    const gone = () =>
      t(
        "Your server got the question, but the conversation was deleted meanwhile, so this question may be gone too.",
        "서버가 질문을 받았지만 그 사이 대화 기록이 삭제되어 이 질문도 지워졌을 수 있습니다.",
      );
    status(gone);
    // Running text the deletion left on G2 gives way to a reply written after it, else to the same statement, never
    // to "not sent". The phone keeps the statement either way.
    if (captionHolds()) {
      if (replyWaiting(since)) showSelectedReply();
      else displayText(gone);
    }
  }
  // A reply can arrive while the submission HTTP response is still in flight; a deletion or expiry is not one.
  else if (!replyWaiting(since)) {
    status(
      result.status === "replied"
        ? () => t("A reply is ready · loading it.", "서버에 답변 있음 · 답변을 불러옵니다.")
        : message,
    );
    if (result.status !== "replied") displayText(message);
    else void poll();
    if (selection.startsWith("notice:")) replyNotice = selection;
  } else if (selection.startsWith("notice:") && history.selected) restoreReader();
  // Text edited while the request was in flight is a new draft and stays.
  if (el<HTMLTextAreaElement>("text").value.trim() === text) el<HTMLTextAreaElement>("text").value = "";
  if (draft?.id === id) draft = undefined;
}
el("send").onclick = () => {
  const text = el<HTMLTextAreaElement>("text").value.trim();
  if (busy || recordingWanted || recording || !text || !credentials || !active) return;
  const version = generation;
  busy = true;
  syncWake();
  controls();
  draft = draftFor(draft, text, () => crypto.randomUUID());
  void sendText(text, version, draft.id)
    .catch((e) => {
      // sendText clears the field only after the relay accepted it, so a failure leaves the typed text in place.
      if (current(version)) {
        const reason = errorText(e, () => t("Couldn't send.", "전송하지 못했습니다."));
        status(() =>
          t(
            `${reason()} Your message is still in the message box.`,
            `${reason()} 입력한 내용은 입력란에 남아 있습니다.`,
          ),
        );
      }
    })
    .finally(() => {
      if (current(version)) {
        busy = false;
        controls();
        syncWake();
      }
    });
};
el("text").onkeydown = (event) => {
  if (!event.isComposing && event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    el("send").click();
  }
};
// Standard HTTPS navigation: external-browser and return behavior needs physical WebView QA.
let dashboardCopying = false;
// The dashboard opens in the language chosen here; the address shown and copied stays the bare origin pairing validates.
const dashboardHref = (origin: string) => `${origin}/?lang=${currentLanguage()}`;
function updateDashboard(): string | undefined {
  const link = el<HTMLAnchorElement>("dashboard-link");
  const address = el<HTMLInputElement>("dashboard-address");
  const copy = el<HTMLButtonElement>("copy-dashboard");
  say("dashboard-status", "");
  try {
    const origin = relayOrigin(el<HTMLInputElement>("origin").value.trim());
    link.href = dashboardHref(origin);
    link.removeAttribute("aria-disabled");
    address.value = origin;
    copy.disabled = dashboardCopying;
    return origin;
  } catch {
    link.removeAttribute("href");
    link.setAttribute("aria-disabled", "true");
    address.value = "";
    copy.disabled = true;
    say("dashboard-status", () =>
      t(
        "To open the dashboard, enter your server's HTTPS address with nothing after it.",
        "대시보드를 열려면 경로 없는 HTTPS 서버 기본 주소를 입력하세요.",
      ),
    );
  }
}
el("origin").oninput = () => {
  updateDashboard();
};
el("dashboard-link").onclick = (event) => {
  if (!updateDashboard()) event.preventDefault();
};
el("copy-dashboard").onclick = async () => {
  if (dashboardCopying) return;
  const origin = updateDashboard();
  if (!origin) return;
  dashboardCopying = true;
  el<HTMLButtonElement>("copy-dashboard").disabled = true;
  let copied = false;
  try {
    await navigator.clipboard.writeText(origin);
    copied = true;
  } catch {
    // A visible selectable address works even when Clipboard API permission is unavailable.
  } finally {
    dashboardCopying = false;
    const currentOrigin = updateDashboard();
    if (currentOrigin === origin) {
      say(
        "dashboard-status",
        copied
          ? () =>
              t(
                "Dashboard address copied. Open it in your phone's browser.",
                "대시보드 주소를 복사했습니다. 휴대폰 브라우저에서 여세요.",
              )
          : () =>
              t(
                "Couldn't copy. Press and hold the dashboard address above to copy it.",
                "복사하지 못했습니다. 위 대시보드 주소를 길게 눌러 직접 복사하세요.",
              ),
      );
      if (!copied) {
        const address = el<HTMLInputElement>("dashboard-address");
        address.focus();
        address.select();
      }
    }
  }
};
updateDashboard();

// English is the default; a Korean choice is remembered in Even app storage. A choice made before the saved one is
// read wins over it.
let languageChosen = false;
/** Rewrites the page, the statuses derived from current state, and the G2 header in the selected language. */
function applyLanguage(): void {
  const index = currentLanguage() === "ko" ? 1 : 0;
  document.documentElement.lang = currentLanguage();
  for (const [id, text] of Object.entries(PAGE_TEXT)) el(id).textContent = text[index];
  el<HTMLInputElement>(index ? "language-ko" : "language-en").checked = true;
  const origin = el<HTMLInputElement>("dashboard-address").value;
  if (origin) el<HTMLAnchorElement>("dashboard-link").href = dashboardHref(origin);
  for (const [id, text] of sayings) say(id, text);
  controls();
  // The G2 notice or capture text on screen is rewritten in place; a reply, user text and the part being read stay.
  if (captionHolds())
    parts = segments(
      caption!.text ? captionBody(caption!.label(), caption!.text) : said(caption!.heading),
      SPLIT_MARKERS,
    );
  else if (noticeText?.selection === selection) parts = segments(noticeText.text(), SPLIT_MARKERS);
  part = Math.min(part, parts.length - 1);
  // Says the current wake state again and, once G2 is ready, rewrites its header and idle text.
  wakeNotice(wakeLabel);
  if (!ready) renderDisplay();
}
function saveLanguage(): void {
  void bridge!
    .setLocalStorage(LANGUAGE_STORAGE, currentLanguage())
    .catch(() => false)
    .then((ok) => {
      if (!ok)
        status(() =>
          t(
            "Couldn't save your language choice. It applies now, but the next launch may use English.",
            "언어 선택을 저장하지 못했습니다. 지금은 적용되지만 다음 실행에서는 영어로 보일 수 있습니다.",
          ),
        );
    });
}
function chooseLanguage(value: Language): void {
  languageChosen = true;
  if (value === currentLanguage()) return;
  setLanguage(value);
  applyLanguage();
  status(() => t("Showing the app in English.", "앱을 한국어로 표시합니다."));
  if (bridge) saveLanguage();
}
el("language-en").onchange = () => chooseLanguage("en");
el("language-ko").onchange = () => chooseLanguage("ko");

/** Pairing results stay next to the pairing form as well as in the page status. */
function pairNotice(text: Said): void {
  say("pair-status", text);
  status(text);
}
el<HTMLFormElement>("pair").onsubmit = (event) => {
  event.preventDefault();
  if (busy || !bridge || !restored) return;
  let origin: string;
  let code: string;
  let field = "origin";
  // Each attempt judges both fields anew, so a corrected field is not still announced as invalid.
  el("origin").removeAttribute("aria-invalid");
  el("code").removeAttribute("aria-invalid");
  try {
    origin = relayOrigin(el<HTMLInputElement>("origin").value.trim());
    field = "code";
    code = pairCode(el<HTMLInputElement>("code").value);
  } catch (e) {
    el(field).setAttribute("aria-invalid", "true");
    el(field).focus();
    return pairNotice(
      e instanceof TypeError
        ? () =>
            t(
              "That server address isn't valid. Enter an address that starts with https://.",
              "서버 주소 형식이 올바르지 않습니다. https://로 시작하는 주소를 입력하세요.",
            )
        : errorText(e, () => ""),
    );
  }
  // A failed new pairing keeps the connection that was working before it.
  const previous = credentials;
  cancelRequests();
  stopRecording(true);
  credentials = undefined;
  syncWake();
  busy = true;
  controls();
  pairNotice(() => t("Connecting to your server", "서버에 연결하는 중"));
  const version = generation;
  const controller = new AbortController();
  requests.add(controller);
  const timeout = setTimeout(() => controller.abort(), 15000);
  void (async () => {
    try {
      let response: Response;
      try {
        response = await fetch(origin + "/api/device/pair", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
          signal: controller.signal,
        });
      } catch {
        const timedOut = controller.signal.aborted;
        throw new LocalizedError(() =>
          timedOut
            ? t(
                "The server didn't answer within 15 seconds. Check the address and your network.",
                "서버가 15초 안에 응답하지 않았습니다. 주소와 네트워크를 확인하세요.",
              )
            : t(
                "Couldn't reach the server. Check the address and your network.",
                "서버에 연결하지 못했습니다. 주소와 네트워크를 확인하세요.",
              ),
        );
      }
      if (!response.ok)
        throw new LocalizedError(() =>
          response.status === 400 || response.status === 401 || response.status === 404
            ? t(
                `That connection key is wrong or has expired (${response.status}). Get a new key and enter it again.`,
                `연결 키가 맞지 않거나 만료되었습니다 (${response.status}). 새 연결 키를 받아 다시 입력하세요.`,
              )
            : t(
                `Couldn't connect to the server (${response.status}) · please try again shortly.`,
                `서버 연결 실패 (${response.status}) · 잠시 뒤 다시 시도하세요.`,
              ),
        );
      const result = (await response.json()) as { token: string };
      if (!current(version)) return;
      if (!result.token)
        throw new LocalizedError(() =>
          t("The server didn't complete the connection.", "서버가 연결 토큰을 반환하지 않았습니다."),
        );
      const saved = { origin, token: result.token };
      if (!(await saveCredentials(JSON.stringify(saved))))
        throw new LocalizedError(() =>
          t(
            "Couldn't save the connection. Connect again with a new connection key.",
            "연결 정보를 저장하지 못했습니다. 새 연결 키로 다시 연결하세요.",
          ),
        );
      if (!current(version)) return;
      credentials = saved;
      el<HTMLInputElement>("code").value = "";
      history.clear();
      pairNotice(() =>
        t(
          "Connected to your server · finish connecting and subscribing in Dot too.",
          "서버 연결됨 · Dot에서 MCP 연결과 구독도 완료하세요.",
        ),
      );
      void poll();
    } catch (e) {
      if (!current(version)) return;
      credentials = previous;
      const message = errorText(e, () => t("Couldn't connect.", "연결하지 못했습니다."));
      pairNotice(
        previous
          ? () => t(`${message()} Your previous connection is kept.`, `${message()} 기존 서버 연결은 유지합니다.`)
          : message,
      );
      if (previous) void poll();
    } finally {
      clearTimeout(timeout);
      requests.delete(controller);
      if (current(version)) {
        busy = false;
        controls();
        syncWake();
      }
    }
  })();
};
/** Key results stay next to the key field, which also describes the input. */
function keyResult(action: Promise<unknown>): void {
  keyBusy = true;
  controls();
  void action
    .then(
      () => {
        el("soniox-key").removeAttribute("aria-invalid");
        keyNotice();
      },
      (e) => {
        keyNotice();
        say(
          "soniox-status",
          errorText(e, () => t("Couldn't use this key.", "키를 적용하지 못했습니다.")),
        );
        el("soniox-key").setAttribute("aria-invalid", "true");
        el("soniox-key").focus();
      },
    )
    .finally(() => {
      keyBusy = false;
      controls();
    });
}
el<HTMLFormElement>("soniox").onsubmit = (event) => {
  event.preventDefault();
  if (!bridge) {
    say("soniox-status", () =>
      t("Wait until the Even app is connected, then enter your key.", "Even 앱 연결을 확인한 뒤 키를 입력하세요."),
    );
    return;
  }
  if (keyBusy) return;
  const input = el<HTMLInputElement>("soniox-key");
  const value = input.value;
  // The key leaves the DOM as soon as it is read, whether or not it is accepted.
  input.value = "";
  say("soniox-status", () => t("Saving your key", "키 적용 중"));
  keyResult(sonioxKey.apply(value, el<HTMLInputElement>("soniox-remember").checked));
};
// Enter that commits an IME composition must not submit the form.
for (const id of ["soniox-key", "origin", "code"])
  el(id).onkeydown = (event) => {
    if (event.isComposing && event.key === "Enter") event.preventDefault();
  };
el("soniox-remember").onchange = () => {
  // With no key yet, the choice simply applies when a key is entered.
  if (!bridge || !sonioxKey.value) return;
  say("soniox-status", () => t("Updating where your key is kept", "저장 설정 변경 중"));
  keyResult(sonioxKey.remember(el<HTMLInputElement>("soniox-remember").checked));
};
el("soniox-clear").onclick = () => {
  if (!bridge) return;
  el<HTMLInputElement>("soniox-remember").checked = false;
  // The clear button hides once removal is confirmed; focus stays on the key field.
  el("soniox-key").focus();
  say("soniox-status", () => t("Removing your key", "키 지우는 중"));
  keyResult(sonioxKey.clear());
};
el("disconnect").onclick = () => {
  // This button hides itself; focus moves to the pairing code for a new connection.
  el("code").focus();
  cancelRequests();
  stopRecording(true);
  credentials = undefined;
  syncWake();
  busy = false;
  history.clear();
  say("reply", () => t("Disconnected.", "연결을 해제했습니다."));
  phoneReply = undefined;
  displayText(() => t("Disconnected.", "연결을 해제했습니다."));
  controls();
  void saveCredentials("")
    .then((ok) =>
      status(
        ok
          ? () =>
              t(
                "This phone forgot the connection. Remove the device on your server too to revoke it completely.",
                "이 기기의 저장된 토큰을 지웠습니다. 서버에서도 기기를 해제하면 토큰이 폐기됩니다.",
              )
          : () =>
              t(
                "Couldn't confirm that the saved connection was removed. Check the Even app's stored data.",
                "토큰 삭제를 확인하지 못했습니다. Even 앱 저장 정보를 확인하세요.",
              ),
      ),
    )
    .catch(report);
};
/** The G2 page left the glasses foreground or the host is exiting it: listening, capture and polling stop. */
function pause(): void {
  active = false;
  clearTimeout(livenessTimer);
  syncWake(true);
  clearTimeout(pollTimer);
  for (const request of requests) request.abort();
  abortTranscriptions(() => true);
  stopRecording(true);
  controls();
}
function resume(): void {
  // A repeated FOREGROUND_ENTER, or one after a gesture already resumed, changes nothing: no body rewrite that would
  // reset native scroll, no second poll, and no wake epoch bump that would drop a queued Hey dots command.
  // An unloaded page stays paused until pageshow, whatever G2 event arrives.
  if (exited || active || !pageLoaded) return;
  active = true;
  // The pause discarded that capture, so the reader comes back instead; a draft in the text field stays as it is.
  if (selection === captureNotice) {
    if (history.selected) showSelectedReply();
    else
      displayText(() =>
        t(
          "Voice input stopped because you switched apps on G2. Say Hey dots or press and hold to speak again.",
          "G2에서 앱이 전환되어 음성 입력을 멈췄습니다. Hey dots 또는 길게 누르기로 다시 말하세요.",
        ),
      );
  }
  // G2 may have dropped the page while it was in the background, so resend the current text once.
  g2.forget();
  // Returning to G2 is an explicit retry of an unconfirmed stop.
  syncWake(true);
  controls();
  void poll();
  renderDisplay();
}
// Phone visibility is not the glasses session lifecycle, so there is no page visibility gate: a locked phone keeps
// the session running. Only a genuine page unload (pagehide) or a host event pauses it.
window.addEventListener("pagehide", (event) => {
  // A page kept in the back-forward cache is frozen, not unloaded, and pageshow brings it back unchanged.
  if (event.persisted) return;
  pageLoaded = false;
  pause();
  status(() =>
    t(
      "The page was closed or hidden, so listening, recording and reply checks stopped. They continue when the page is back.",
      "페이지가 닫히거나 내려가 듣기, 녹음과 답변 확인을 멈췄습니다. 페이지가 다시 표시되면 이어집니다.",
    ),
  );
});
window.addEventListener("pageshow", () => {
  pageLoaded = true;
  if (!active && !exited)
    status(() =>
      t(
        "The page is back · listening and reply checks continue.",
        "페이지가 다시 표시되어 듣기와 답변 확인을 이어갑니다.",
      ),
    );
  resume();
});
// Outside the Even app the bridge never appears; say so instead of waiting silently.
const bridgeWait = setTimeout(() => {
  if (!bridge)
    status(() =>
      t(
        `Couldn't find the Even app. Open ${APP_NAME} from the Even app.`,
        `Even 앱을 찾지 못했습니다. Even 앱의 ${APP_NAME}에서 열어 주세요.`,
      ),
    );
}, 10000);
// Fences startup restoration from the start, before any await.
const startup = generation;
void (async () => {
  bridge = await waitForEvenAppBridge();
  clearTimeout(bridgeWait);
  controls();
  if (languageChosen) saveLanguage();
  else
    void bridge.getLocalStorage(LANGUAGE_STORAGE).then(
      (saved) => {
        if (languageChosen || parseLanguage(saved) === currentLanguage()) return;
        setLanguage(parseLanguage(saved));
        applyLanguage();
      },
      // An unreadable choice keeps English.
      () => undefined,
    );
  // Read independently of G2 startup, so a slow read only delays Hey dots, never polling.
  void preferences.restore().then((saved) => {
    const choice = saved ?? UNKNOWN_PREFERENCES;
    el<HTMLInputElement>("wake-enabled").checked = choice.wake;
    el<HTMLInputElement>("auto-send").checked = choice.autoSend;
    settingsLoaded = true;
    if (!saved) status((settingsNote = settingsUnread));
    controls();
    syncWake();
  });
  const result = await bridge.createStartUpPageContainer(
    new CreateStartUpPageContainer({
      containerTotalNum: 2,
      textObject: [
        new TextContainerProperty({
          containerID: 1,
          containerName: "reply",
          xPosition: 8,
          yPosition: 44,
          width: 560,
          height: 228,
          isEventCapture: 1,
          content: idleText({ restored, connected: !!credentials, transcriber: !!sonioxKey.value }),
        }),
        new TextContainerProperty({
          containerID: 2,
          containerName: "microphone",
          xPosition: 8,
          yPosition: 8,
          width: 560,
          height: 32,
          content: wakeLabel(),
        }),
      ],
    }),
  );
  if (result !== 0)
    throw new LocalizedError(() =>
      t(
        "Couldn't start the G2 screen. Open the app again from the Even app.",
        "G2 시작 화면을 만들지 못했습니다. Even 앱에서 다시 여세요.",
      ),
    );
  ready = true;
  active = pageLoaded;
  controls();
  bridge.onEvenHubEvent((event) => {
    if (event.audioEvent && event.audioEvent.source !== AudioInputSource.Phone && (wakeMicOpen || recording)) {
      // The first frame after an open, or after a quiet spell, is what shows G2 audio is arriving.
      if (++micFrames === 1 || audioQuiet) {
        audioQuiet = false;
        wakeNotice(
          wakeMicOpen
            ? () =>
                t(
                  "Microphone on · listening for Hey dots on this phone · nothing is sent before you say it.",
                  "마이크 켜짐 · 휴대폰에서 Hey dots 로컬 감지 중 · 감지 전 소리는 서버에 보내지 않습니다.",
                )
            : () => t("Microphone on · recording", "마이크 켜짐 · 수동 녹음 중"),
        );
        watchAudio();
      }
    }
    if (event.audioEvent && event.audioEvent.source !== AudioInputSource.Phone && wakeMicOpen && wakeAllowed())
      wakeDetector?.append(event.audioEvent.audioPcm);
    if (event.audioEvent && event.audioEvent.source !== AudioInputSource.Phone && recordingWanted && recording) {
      const frame = event.audioEvent.audioPcm;
      if (frame.length % 2) {
        stopRecording(true);
        status(() => t("Received sound that couldn't be read.", "잘못된 오디오 프레임을 받았습니다."));
        return;
      }
      const count = Math.min(frame.length, 960000 - bytes);
      // Frames go to Soniox as they arrive; the stream copies anything it has to hold while connecting.
      manualVoice?.stream.write(frame.subarray(0, count));
      bytes += count;
      if (bytes >= 960000) stopRecording(false);
    }
    const type = event.sysEvent?.eventType ?? event.textEvent?.eventType ?? event.listEvent?.eventType;
    const step = g2LifecycleStep(type);
    if (step === "exit") {
      pause();
      exited = true;
      cancelRequests();
      // Terminal either way; the phone says which, so a device run can tell an abnormal exit from a confirmed one.
      return status(
        type === OsEventTypeList.ABNORMAL_EXIT_EVENT
          ? () =>
              t(
                "The app closed unexpectedly on G2, so listening, recording and reply checks stopped. Open it again from the Even app.",
                "G2 앱이 비정상 종료되어 듣기, 녹음과 답변 확인을 멈췄습니다. Even 앱에서 다시 여세요.",
              )
          : () =>
              t(
                "The app was closed on G2, so listening, recording and reply checks stopped. Open it on G2 to use it again.",
                "G2에서 앱이 종료되어 듣기, 녹음과 답변 확인을 멈췄습니다. 다시 쓰려면 G2에서 앱을 여세요.",
              ),
      );
    }
    if (step === "leave") {
      pause();
      // Said on the phone, so a device run shows whether this host event ever follows a phone lock; it must not.
      return status(() =>
        t(
          "You switched apps on G2, so listening, recording and reply checks stopped. They continue when you open it on G2 again.",
          "G2에서 앱이 전환되어 듣기, 녹음과 답변 확인을 멈췄습니다. G2에서 다시 열면 이어집니다.",
        ),
      );
    }
    if (step === "enter") {
      if (!active && !exited && pageLoaded)
        status(() =>
          t(
            "Back on G2 · listening and reply checks start again.",
            "G2에서 앱으로 돌아와 듣기와 답변 확인을 다시 시작합니다.",
          ),
        );
      return resume();
    }
    // The exit confirmation stays reachable even while the page is paused.
    if (type === OsEventTypeList.DOUBLE_CLICK_EVENT) return requestExit();
    // Input reaches only the foreground G2 page, so a gesture after a missed FOREGROUND_ENTER_EVENT resumes first.
    if (!active && !exited && gesture(type)) resume();
    if (!active) return;
    if (type === OsEventTypeList.LONG_PRESS_EVENT) startRecording();
    if (type === OsEventTypeList.LONG_PRESS_RELEASE_EVENT) stopRecording(false);
    // Documented as swipe up/down or reaching the top/bottom of natively scrolled text; whether a swipe inside
    // overflowing text also emits them is not verified on G2.
    if (type === OsEventTypeList.SCROLL_TOP_EVENT) turn(-1);
    if (type === OsEventTypeList.SCROLL_BOTTOM_EVENT) turn(1);
  });
  await sonioxKey.restore().then(
    () => keyNotice(),
    () => {
      keyNotice();
      status(() =>
        t(
          "Couldn't load your saved Soniox key. Enter it again, or tap Remove key.",
          "저장된 Soniox 키를 불러오지 못했습니다. 키를 다시 입력하거나 키 지우기를 누르세요.",
        ),
      );
    },
  );
  const saved = await bridge.getLocalStorage(storageKey).finally(() => {
    restored = true;
  });
  if (!current(startup)) return;
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as { origin: string; token: string };
      if (typeof parsed.token === "string" && parsed.token) {
        credentials = { origin: relayOrigin(parsed.origin), token: parsed.token };
        el<HTMLInputElement>("origin").value = credentials.origin;
        updateDashboard();
      }
    } catch {
      status(() =>
        t(
          "Your saved connection couldn't be read. Connect with a new connection key.",
          "저장된 연결 설정이 올바르지 않습니다. 새 연결 키로 연결하세요.",
        ),
      );
    }
  }
  controls();
  status(
    settingsNote ??
      (credentials
        ? () => t("Using your saved server connection.", "저장된 서버 연결을 사용합니다.")
        : () =>
            t(
              "G2 ready · enter your server address and connection key.",
              "G2 준비됨 · 서버 주소와 연결 키를 입력하세요.",
            )),
  );
  syncWake();
  void poll();
})().catch((e) => {
  // A failed startup still lets the user pair instead of leaving the form disabled.
  restored = true;
  controls();
  // The idle body stops saying the saved connection is being checked.
  if (ready) renderDisplay();
  report(e);
});
// The page's starting placeholders are the app's own text, so they follow a language change until replaced.
for (const [id, [en, ko]] of Object.entries(PLACEHOLDERS)) say(id, () => t(en, ko));
keyNotice();
controls();
// Hey dots defaults on; until its prerequisites are met the status names the missing one instead of the page's placeholder.
syncWake();
