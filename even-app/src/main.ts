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
import { canListen, finishWakeClip, wakeBlocker, type WakeBlocker, type WakeConditions } from "./wake-gate.ts";
import type { Messages } from "./messages/en.ts";
import { PreferenceStore, UNKNOWN_PREFERENCES } from "./preferences.ts";
import {
  APP_NAME,
  LANGUAGE_STORAGE,
  SPLIT_MARKERS,
  captionFinishing,
  captionLive,
  currentLanguage,
  detectLanguage,
  edgeText,
  failureText,
  idleText,
  langTag,
  messageText,
  msg,
  parseLanguagePreference,
  setLanguage,
  splitMarkers,
  sttText,
  wakeBlocked,
  type Language,
} from "./locale.ts";
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
/** The first of the phone's preferred languages the app has, else English. */
const phoneLanguage = () => detectLanguage(navigator.languages?.length ? navigator.languages : [navigator.language]);
// Until a saved choice is read, the phone's language at launch is selected, so every text the app writes starts in it.
setLanguage(phoneLanguage());
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
let parts = [msg().afterConnecting];
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
const micStopUnconfirmed = () => msg().micStopUnconfirmed;
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
const settingsUnread = () => msg().settingsUnread;
const preferences = new PreferenceStore(() => bridge!);
let wakeEpoch = 0;
/** A microphone notice, with a short G2 header form, or why Hey dots is not listening. */
type MicNotice = keyof Messages["g2Mic"] | { blocked: WakeBlocker };
// Kept as a state, not text, so a language change can say the same state again.
let micNotice: MicNotice = "micOff";
const micText = (notice: MicNotice) => (typeof notice === "string" ? msg()[notice] : wakeBlocked(notice.blocked));
const micHeader = (notice: MicNotice) =>
  typeof notice === "string" ? msg().g2Mic[notice] : wakeBlocked(notice.blocked);
/** Whether each notice means the microphone is on, off, or may be on, for the header's shortest form. */
const MIC_CORE: Record<keyof Messages["g2Mic"], keyof Messages["g2MicCore"]> = {
  micOff: "off",
  micTurningOff: "unsure",
  micStopUnconfirmed: "unsure",
  wakeOffMicOff: "off",
  wakeNoKeyMicOff: "off",
  wakePausedMicOff: "off",
  wakePreparing: "unsure",
  wakeHeardNow: "on",
  wakeStopped: "unsure",
  wakeMicStarting: "unsure",
  manualMicStarting: "unsure",
  micOffProcessing: "off",
  micOnWake: "on",
  micOnRecording: "on",
  recordingNoSound: "on",
  wakeListeningNoSound: "on",
};
// A blocked notice is said only with the microphone closed; a manual capture may be opening it.
const micCore = (notice: MicNotice) =>
  msg().g2MicCore[typeof notice === "string" ? MIC_CORE[notice] : notice.blocked === "manual" ? "unsure" : "off"];
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
const draftPending = () => msg().draftPausesRecording;
const noKey = () => msg().noSonioxKey;
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
        ? msg().keyRemovalUnconfirmed
        : noKey()
      : sonioxKey.unconfirmed
        ? msg().keySessionOnlyOldMayRemain
        : sonioxKey.remembered
          ? msg().keyRemembered
          : msg().keySessionOnly,
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
function wakeNotice(notice: MicNotice): void {
  const value = micText(notice);
  if (el("wake-status").textContent !== value) el("wake-status").textContent = value;
  micNotice = notice;
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
      wakeNotice(recording ? "recordingNoSound" : "wakeListeningNoSound");
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
    // A manual recording holds the microphone open, so its own notice stays until the recording ends.
    const reason = (): MicNotice => (recording ? micNotice : { blocked: wakeBlocker(wakeState()) ?? "enabled" });
    wakeNotice(
      wakeMicOpen || (micUnconfirmed && retry) ? "micTurningOff" : micUnconfirmed ? "micStopUnconfirmed" : reason(),
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
          wakeNotice("micStopUnconfirmed");
          return;
        }
        wakeNotice(
          !el<HTMLInputElement>("wake-enabled").checked
            ? "wakeOffMicOff"
            : !sonioxKey.value
              ? "wakeNoKeyMicOff"
              : "wakePausedMicOff",
        );
        return;
      }
      if (micUnconfirmed) {
        wakeNotice("micStopUnconfirmed");
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
      if (!retry || !(await closeMic())) return wakeNotice("micStopUnconfirmed");
      if (!wakeAllowed()) return;
    }
    const epoch = ++wakeEpoch;
    const version = generation;
    wakeNotice("wakePreparing");
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
            wakeNotice("wakeHeardNow");
            captureText(() => msg().wakeHeard, wakeVoice);
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
                    else displayText(() => msg().readyForQuestion);
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
          wakeNotice("wakeStopped");
        },
        "dots",
      );
      if (!wakeAllowed() || epoch !== wakeEpoch || !current(version)) {
        detector.dispose();
        return;
      }
      wakeDetector = detector;
      if (!(await bridge!.audioControl(true, AudioInputSource.Glasses)))
        throw new LocalizedError(() => msg().micStartFailed);
      wakeMicOpen = true;
      micFrames = 0;
      audioQuiet = false;
      if (!wakeAllowed() || epoch !== wakeEpoch || !current(version)) {
        detector.dispose();
        wakeDetector = undefined;
        wakeMicOpen = false;
        if (!(await closeMic())) wakeNotice("micStopUnconfirmed");
        return;
      }
      detector.listen();
      wakeNotice("wakeMicStarting");
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
const erased = () => msg().historyDeleted;
const expired = () => msg().historyExpired;
const ackPending = () => msg().ackPending;
const ackLabel = () => msg().ackLabel;
const finalLabel = () => msg().finalLabel;
const report = (e: unknown) => status(errorText(e, () => msg().somethingWrong));
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
    ? msg().waitingEvenApp
    : !ready
      ? msg().preparingG2
      : !settingsLoaded
        ? msg().loadingSettings
        : !credentials
          ? msg().connectToRecord
          : !sonioxKey.value
            ? msg().sonioxToRecord
            : busy
              ? msg().finishingPrevious
              : typed && !recordingWanted && !recording
                ? draftPending()
                : "";
  if (el("record-hint").textContent !== hint) el("record-hint").textContent = hint;
  el("record-hint").hidden = !hint;
  el<HTMLButtonElement>("prev-message").disabled = history.index <= 0;
  el<HTMLButtonElement>("next-message").disabled = history.index < 0 || history.index >= history.messages.length - 1;
  const stage = history.selected ? stageLabel(history.selected) : "";
  const position = history.messages.length
    ? msg().messagePosition(history.index + 1, history.messages.length, stage)
    : msg().noMessages;
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
  if (!saved) throw new LocalizedError(() => msg().connectFirst);
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
    if (response.status === 401) throw new LocalizedError(() => msg().connectionExpired);
    if (response.status === 410) throw new UtteranceGone(() => msg().questionRejected);
    if (!response.ok) throw new LocalizedError(() => msg().serverFailed(response.status));
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
  if (!ready) displayStatus(() => msg().g2NotConnected);
  else if (!quiet && (!g2.has(2, g2Header()) || !g2.has(1, content, key))) displayStatus(() => msg().showingOnG2);
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
        !(ok && headerOk) ? () => msg().g2UpdateFailed : quiet ? () => msg().showingLiveCaption : () => msg().shownOnG2,
      );
    })
    .catch(() => {
      if (current(connectionVersion) && version === displayVersion) displayStatus(() => msg().g2Unconfirmed);
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
function stageParts(reply: Reply): string[] {
  if (reply.stage === "ack") return history.paired(reply) ? [ackLabel()] : [ackLabel(), ackPending()];
  return history.paired(reply) ? [finalLabel()] : [];
}
const stageLabel = (reply: Reply) => stageParts(reply).join(" · ");
/**
 * A conservative G2 header width. On the official simulator's framebuffer Hangul, Han and kana advance 17-21px, Latin
 * letters and digits 9-11px, and a space or the middle dot about 6px; each counts the most. The container is 560px,
 * but its scrollbar and padding take the right edge.
 */
const HEADER_WIDTH = 548;
const WIDE = /[\p{sc=Hangul}\p{sc=Han}\u3000-\u30ff\uff01-\uff60\uffe0-\uffe6]/u;
const headerWidth = (text: string) =>
  Array.from(text).reduce((width, char) => width + (WIDE.test(char) ? 21 : char === " " || char === "·" ? 6 : 11), 0);
/**
 * The message position leads the header, so moving between replies with identical text is still visible, and the
 * microphone state ends it whole. A gesture note is only ever shown here, so it always stays. When everything does not
 * fit, whole parts give way: the pending-final note, then the microphone detail down to its bare on, off or may-be-on
 * state, then the stage. The catalogs keep the position, a note or stage, and the bare state within the limit.
 */
function g2Header(): string {
  const reading = selection.startsWith("reply:") && history.index >= 0;
  const position = reading ? msg().replyPosition(history.index + 1, history.messages.length) : "";
  const stage = reading && history.selected ? stageParts(history.selected) : [];
  const note = headerNote?.view === view() ? headerNote.text() : "";
  const mic = micHeader(micNotice);
  const core = micCore(micNotice);
  const join = (parts: string[]) => parts.filter(Boolean).join(" · ");
  const candidates = [
    [position, ...stage, note, mic],
    [position, stage[0], note, mic],
    [position, stage[0], note, core],
    [position, note, mic],
    [position, note, core],
  ].map(join);
  return candidates.find((text) => headerWidth(text) <= HEADER_WIDTH) ?? candidates.at(-1)!;
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
const captureStopped = () => msg().voiceStopped;
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
  status(history.index < history.messages.length - 1 ? () => msg().replyBackToReading : () => msg().replyShowingLatest);
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
const exitFailed = () => msg().exitFailed;
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
      status(() => msg().exitRequestFailed);
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
      status(conversation === "stale" ? () => msg().staleResponse : () => msg().unversionedResponse);
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
      status(conversation === "erased" ? () => msg().erasedReplyAfterVoice(erased()) : () => msg().replyAfterVoice);
    } else if (changed) {
      status(
        conversation === "erased"
          ? () => msg().erasedShowingNew(erased())
          : history.selected!.stage === "ack"
            ? () => msg().ackReceived
            : history.paired(history.selected!)
              ? () => msg().finalReceived
              : () => msg().replyShowing,
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
  status(() => msg().finishingTranscriptWaiting);
  // After the user moved to a message, the finishing notice no longer shows this voice's running text.
  const owner = caption?.voice === voice && captionHolds() ? voice : undefined;
  captureText(() => msg().finishingTranscript, owner, captionFinishing);
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
        status(next.draft ? () => msg().transcriptReady : () => msg().transcriptAppended);
        // A reply received during the capture comes back in place of the notice; the phone keeps the review prompt.
        if (caption?.voice === voice && captionHolds() && replyWaiting(voice.replies)) showSelectedReply();
        else displayText(() => msg().transcriptReadyPhone);
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
    if (submitted) notice = errorText(e, () => msg().sendUnconfirmed);
    if (kept) {
      const reason = errorText(e, () => msg().sendFailed);
      throw new LocalizedError(() => msg().transcriptKept(reason()));
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
        throw new LocalizedError(() => msg().micStartFailed);
      }
      recording = true;
      micFrames = 0;
      audioQuiet = false;
      wakeNotice("manualMicStarting");
      if (!current(version) || !recordingWanted || !active) return;
      watchAudio();
      status(() => msg().recordingLive);
      captureText(() => msg().recordingHold, voice);
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
        wakeNotice("micStopUnconfirmed");
        return;
      }
      wakeNotice("micOffProcessing");
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
      if (ok === false) status(() => msg().settingsSaveFailed);
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
  status(() => msg().sending);
  let result: { status: string };
  try {
    result = await request<{ status: string }>("/api/device/utterances", "POST", utteranceBody(id, text));
  } catch (e) {
    // The relay will refuse this ID for good, so a deliberate resend of the same text gets a new one.
    if (e instanceof UtteranceGone && draft?.id === id) draft = undefined;
    throw e;
  }
  if (!current(version) || !active) return;
  const message = result.status === "accepted" ? () => msg().delivered : () => msg().savedNotDelivered;
  if (history.erasures !== erasures) {
    // Accepted around a deletion: it may have been deleted with the conversation, so no waiting state is claimed.
    const gone = () => msg().savedThenDeleted;
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
    status(result.status === "replied" ? () => msg().replyReady : message);
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
        const reason = errorText(e, () => msg().sendFailed);
        status(() => msg().messageKept(reason()));
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
    say("dashboard-status", () => msg().dashboardNeedsOrigin);
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
      say("dashboard-status", copied ? () => msg().dashboardCopied : () => msg().dashboardCopyFailed);
      if (!copied) {
        const address = el<HTMLInputElement>("dashboard-address");
        address.focus();
        address.select();
      }
    }
  }
};
updateDashboard();

// The phone's language at launch is selected until a choice is saved; a choice from the list is remembered in Even app
// storage. A choice made before the saved one is read wins over it.
let languageChosen = false;
/** The static page, its `lang` and the language list, in the selected language. */
function applyPage(): void {
  document.documentElement.lang = langTag(currentLanguage());
  for (const [id, text] of Object.entries(msg().page)) el(id).textContent = text;
  el<HTMLSelectElement>("language").value = currentLanguage();
  const origin = el<HTMLInputElement>("dashboard-address").value;
  if (origin) el<HTMLAnchorElement>("dashboard-link").href = dashboardHref(origin);
}
/** Rewrites the page, the statuses derived from current state, and the G2 header in the selected language. */
function applyLanguage(): void {
  applyPage();
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
  wakeNotice(micNotice);
  if (!ready) renderDisplay();
}
function saveLanguage(): void {
  void bridge!
    .setLocalStorage(LANGUAGE_STORAGE, currentLanguage())
    .catch(() => false)
    .then((ok) => {
      if (!ok) status(() => msg().languageSaveFailed);
    });
}
/** Only a change of language rewrites the page, and nothing else is reset. */
function useLanguage(value: Language): void {
  el<HTMLSelectElement>("language").value = value;
  if (value === currentLanguage()) return;
  setLanguage(value);
  applyLanguage();
}
function chooseLanguage(value: Language): void {
  languageChosen = true;
  useLanguage(value);
  status(() => msg().languageShown);
  if (bridge) saveLanguage();
}
el<HTMLSelectElement>("language").onchange = () => {
  const value = parseLanguagePreference(el<HTMLSelectElement>("language").value);
  if (value) chooseLanguage(value);
};
// A phone language change while the app is open changes nothing; the next launch without a saved choice detects again.

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
    return pairNotice(e instanceof TypeError ? () => msg().originInvalid : errorText(e, () => ""));
  }
  // A failed new pairing keeps the connection that was working before it.
  const previous = credentials;
  cancelRequests();
  stopRecording(true);
  credentials = undefined;
  syncWake();
  busy = true;
  controls();
  pairNotice(() => msg().connecting);
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
        throw new LocalizedError(() => (timedOut ? msg().connectTimeout : msg().connectNetwork));
      }
      if (!response.ok)
        throw new LocalizedError(() =>
          response.status === 400 || response.status === 401 || response.status === 404
            ? msg().keyRejected(response.status)
            : msg().connectFailed(response.status),
        );
      const result = (await response.json()) as { token: string };
      if (!current(version)) return;
      if (!result.token) throw new LocalizedError(() => msg().connectIncomplete);
      const saved = { origin, token: result.token };
      if (!(await saveCredentials(JSON.stringify(saved)))) throw new LocalizedError(() => msg().connectSaveFailed);
      if (!current(version)) return;
      credentials = saved;
      el<HTMLInputElement>("code").value = "";
      history.clear();
      pairNotice(() => msg().connected);
      void poll();
    } catch (e) {
      if (!current(version)) return;
      credentials = previous;
      const message = errorText(e, () => msg().connectFailedGeneric);
      pairNotice(previous ? () => msg().previousConnectionKept(message()) : message);
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
          errorText(e, () => msg().keyFailed),
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
    say("soniox-status", () => msg().waitForEvenApp);
    return;
  }
  if (keyBusy) return;
  const input = el<HTMLInputElement>("soniox-key");
  const value = input.value;
  // The key leaves the DOM as soon as it is read, whether or not it is accepted.
  input.value = "";
  say("soniox-status", () => msg().keySaving);
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
  say("soniox-status", () => msg().keyUpdating);
  keyResult(sonioxKey.remember(el<HTMLInputElement>("soniox-remember").checked));
};
el("soniox-clear").onclick = () => {
  if (!bridge) return;
  el<HTMLInputElement>("soniox-remember").checked = false;
  // The clear button hides once removal is confirmed; focus stays on the key field.
  el("soniox-key").focus();
  say("soniox-status", () => msg().keyRemoving);
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
  say("reply", () => msg().disconnected);
  phoneReply = undefined;
  displayText(() => msg().disconnected);
  controls();
  void saveCredentials("")
    .then((ok) => status(ok ? () => msg().connectionForgotten : () => msg().forgetUnconfirmed))
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
    else displayText(() => msg().voiceStoppedAppSwitch);
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
  status(() => msg().pageHidden);
});
window.addEventListener("pageshow", () => {
  pageLoaded = true;
  if (!active && !exited) status(() => msg().pageBack);
  resume();
});
// Outside the Even app the bridge never appears; say so instead of waiting silently.
const bridgeWait = setTimeout(() => {
  if (!bridge) status(() => msg().evenAppMissing(APP_NAME));
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
        // An unknown value or a legacy "auto", like nothing saved, keeps the detected language and is not rewritten.
        const value = parseLanguagePreference(saved);
        if (!languageChosen && value) useLanguage(value);
      },
      // An unreadable choice keeps the detected language.
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
          content: g2Header(),
        }),
      ],
    }),
  );
  if (result !== 0) throw new LocalizedError(() => msg().g2StartFailed);
  ready = true;
  active = pageLoaded;
  controls();
  bridge.onEvenHubEvent((event) => {
    if (event.audioEvent && event.audioEvent.source !== AudioInputSource.Phone && (wakeMicOpen || recording)) {
      // The first frame after an open, or after a quiet spell, is what shows G2 audio is arriving.
      if (++micFrames === 1 || audioQuiet) {
        audioQuiet = false;
        wakeNotice(wakeMicOpen ? "micOnWake" : "micOnRecording");
        watchAudio();
      }
    }
    if (event.audioEvent && event.audioEvent.source !== AudioInputSource.Phone && wakeMicOpen && wakeAllowed())
      wakeDetector?.append(event.audioEvent.audioPcm);
    if (event.audioEvent && event.audioEvent.source !== AudioInputSource.Phone && recordingWanted && recording) {
      const frame = event.audioEvent.audioPcm;
      if (frame.length % 2) {
        stopRecording(true);
        status(() => msg().badAudioFrame);
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
      return status(type === OsEventTypeList.ABNORMAL_EXIT_EVENT ? () => msg().abnormalExit : () => msg().systemExit);
    }
    if (step === "leave") {
      pause();
      // Said on the phone, so a device run shows whether this host event ever follows a phone lock; it must not.
      return status(() => msg().foregroundExit);
    }
    if (step === "enter") {
      if (!active && !exited && pageLoaded) status(() => msg().foregroundBack);
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
      status(() => msg().keyLoadFailed);
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
      status(() => msg().savedConnectionUnreadable);
    }
  }
  controls();
  status(settingsNote ?? (credentials ? () => msg().usingSavedConnection : () => msg().g2ReadyEnterConnection));
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
for (const id of ["status", "reply", "display"] as const) say(id, () => msg().placeholders[id]);
// index.html ships English; the phone's language replaces it before the Even app answers.
applyPage();
keyNotice();
controls();
// Hey dots defaults on; until its prerequisites are met the status names the missing one instead of the page's placeholder.
syncWake();
