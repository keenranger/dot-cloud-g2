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
import "./style.css";
import { completeVoice, draftFor, requestFailure, transcriptField, utteranceBody, type Draft } from "./voice-flow.ts";
import { SonioxTranscriptionError, openSonioxStream, sttMessage, type SonioxStream } from "./soniox-transcriber.ts";
import { SonioxKey } from "./soniox-key.ts";
import { MessageHistory, type Reply } from "./message-history.ts";
import { loadWakeDetector, type WakeDetector } from "./wake-detector.ts";
import { WAKE_BLOCKED, canListen, finishWakeClip, wakeBlocker, type WakeConditions } from "./wake-gate.ts";
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const status = (text: string) => {
  el("status").textContent = text;
};
const storageKey = "dot-cloud-device-v1";
let bridge: EvenAppBridge | undefined;
let ready = false;
let pageLoaded = true;
let active = !document.hidden;
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
let parts = ["연결 후 길게 누른 채 말하세요."];
let part = 0;
// What the G2 body shows: a reply by message id, or one notice. A new selection is shown from its start.
let selection = "notice:0";
let notices = 0;
// A submission notice that the next reply makes obsolete, even when that reply lands behind the message being read.
let replyNotice: string | undefined;
const g2 = new G2Text((containerID, containerName, content) =>
  bridge!.textContainerUpgrade(
    new TextContainerUpgrade({ containerID, containerName, contentOffset: 0, contentLength: content.length, content }),
  ),
);
const history = new MessageHistory();
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
let wakeEpoch = 0;
let wakeLabel = "마이크 꺼짐";
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
}
let manualVoice: LiveVoice | undefined;
let wakeVoice: LiveVoice | undefined;
// A transcript would replace typed text, so recording waits until the draft is sent or cleared, as Hey dots does.
const DRAFT_PENDING = "작성 중인 내용이 있어 녹음하지 않습니다. 먼저 전송하거나 지우세요.";
const NO_KEY =
  "Soniox 키가 없어 음성 전사를 할 수 없습니다. 설정에 본인 Soniox 키를 입력하거나 직접 입력해 전송하세요.";
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
  el("soniox-status").textContent = !sonioxKey.value
    ? sonioxKey.unconfirmed
      ? "키를 지웠지만 Even 앱 저장소 삭제를 확인하지 못했습니다. 다시 지우기를 누르세요."
      : NO_KEY
    : sonioxKey.unconfirmed
      ? "키를 이번 실행에만 사용합니다. Even 앱 저장소 변경을 확인하지 못했으니 이전에 기억한 키가 남아 있을 수 있습니다."
      : sonioxKey.remembered
        ? "Soniox 키 설정됨 · 이 기기의 Even 앱 저장소에 기억합니다. 지우기 전까지 남습니다."
        : "Soniox 키 설정됨 · 메모리에만 보관하며 앱을 닫으면 사라집니다.";
}
function wakeState(): WakeConditions {
  return {
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
function wakeNotice(text: string): void {
  if (el("wake-status").textContent !== text) el("wake-status").textContent = text;
  wakeLabel = text;
  if (ready) renderDisplay();
}
function syncWake(): void {
  if (!wakeAllowed()) {
    wakeEpoch++;
    wakeDetector?.cancel();
    // Hey dots is on by default, so the label says which prerequisite is missing rather than implying it listens.
    const reason = () => WAKE_BLOCKED[wakeBlocker(wakeState()) ?? "enabled"];
    wakeNotice(wakeMicOpen ? "마이크 중지 요청 중" : reason());
    // A wake capture that has not finished yet is withdrawn with its Soniox session.
    discardVoice(wakeVoice);
    wakeVoice = undefined;
    // Turning Hey dots off withdraws a post-cue clip that is still being transcribed.
    if (!el<HTMLInputElement>("wake-enabled").checked) abortTranscriptions((wake) => wake);
    queueMic(async () => {
      wakeDetector?.dispose();
      wakeDetector = undefined;
      if (wakeMicOpen) {
        if (!(await bridge!.audioControl(false, AudioInputSource.Glasses))) {
          wakeNotice("마이크 중지를 확인하지 못했습니다. Even 앱에서 종료하세요.");
          return;
        }
        wakeMicOpen = false;
        wakeNotice(
          !el<HTMLInputElement>("wake-enabled").checked
            ? "Hey dots 꺼짐 · 마이크 꺼짐"
            : !sonioxKey.value
              ? "Hey dots 사용 불가 · Soniox 키 없음 · 마이크 꺼짐"
              : "Hey dots 일시 중지 · 마이크 꺼짐",
        );
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
    const epoch = ++wakeEpoch;
    const version = generation;
    wakeNotice("Hey dots 로컬 감지 모델 준비 중");
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
            wakeNotice("Hey dots 감지됨 · 이제 질문을 말하세요.");
            displayText("Hey dots 감지됨 · 질문을 말하세요.");
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
                  upload: async () => (voice ? finishVoice(voice) : showNotice(NO_KEY)),
                  restore: () => {
                    discardVoice(voice);
                    if (history.selected) showSelectedReply();
                    else displayText("질문을 기다립니다. Hey dots 또는 길게 누르기로 말하세요.");
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
          wakeNotice("로컬 감지가 중단되었습니다. 길게 누르기나 직접 입력을 이용하세요.");
        },
        "dots",
      );
      if (!wakeAllowed() || epoch !== wakeEpoch || !current(version)) {
        detector.dispose();
        return;
      }
      wakeDetector = detector;
      if (!(await bridge!.audioControl(true, AudioInputSource.Glasses)))
        throw new Error("G2 마이크를 시작하지 못했습니다.");
      wakeMicOpen = true;
      if (!wakeAllowed() || epoch !== wakeEpoch || !current(version)) {
        detector.dispose();
        wakeDetector = undefined;
        if (await bridge!.audioControl(false, AudioInputSource.Glasses)) wakeMicOpen = false;
        else wakeNotice("마이크 중지를 확인하지 못했습니다. Even 앱에서 종료하세요.");
        return;
      }
      detector.listen();
      wakeNotice("마이크 켜짐 · 휴대폰에서 Hey dots 로컬 감지 중 · 감지 전 소리는 서버에 보내지 않습니다.");
    } catch (e) {
      el<HTMLInputElement>("wake-enabled").checked = false;
      syncWake();
      report(e);
    }
  });
}
const report = (e: unknown) => status(e instanceof Error ? e.message : "작업을 완료하지 못했습니다.");
const current = (version: number) => !exited && generation === version;
function controls(): void {
  const typed = !!el<HTMLTextAreaElement>("text").value.trim();
  el<HTMLButtonElement>("record").disabled =
    !ready || !credentials || !sonioxKey.value || busy || recordingWanted || recording || !active || typed;
  el<HTMLButtonElement>("stop").disabled = !recordingWanted && !recording;
  el<HTMLButtonElement>("send").disabled =
    !credentials || busy || recordingWanted || !el<HTMLTextAreaElement>("text").value.trim();
  el("disconnect").hidden = !credentials;
  el<HTMLButtonElement>("pair-submit").disabled = busy || !bridge || !restored;
  el<HTMLButtonElement>("soniox-apply").disabled = el<HTMLButtonElement>("soniox-clear").disabled = keyBusy || !bridge;
  el("pair").setAttribute("aria-busy", String(busy && !credentials));
  // Says why recording is unavailable instead of leaving a silently disabled button.
  const hint = !bridge
    ? "Even 앱 연결을 기다리는 중입니다."
    : !ready
      ? "G2 화면을 준비하는 중입니다."
      : !credentials
        ? "녹음하려면 먼저 서버에 연결하세요."
        : !sonioxKey.value
          ? "녹음하려면 Soniox 키가 필요합니다. 아래에 직접 입력해 전송할 수는 있습니다."
          : busy
            ? "이전 요청을 처리하는 중입니다."
            : typed && !recordingWanted && !recording
              ? DRAFT_PENDING
              : "";
  if (el("record-hint").textContent !== hint) el("record-hint").textContent = hint;
  el("record-hint").hidden = !hint;
  el<HTMLButtonElement>("prev-message").disabled = history.index <= 0;
  el<HTMLButtonElement>("next-message").disabled = history.index < 0 || history.index >= history.messages.length - 1;
  const position = history.messages.length
    ? `${history.index + 1} / ${history.messages.length}개 메시지`
    : "아직 받은 메시지가 없습니다.";
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
  if (!saved) throw new Error("먼저 서버에 연결하세요.");
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
    if (response.status === 401) throw new Error("연결이 만료되었습니다. 연결 해제 후 새 코드로 연결하세요.");
    if (!response.ok) throw new Error(`서버 요청 실패 (${response.status})`);
    const result = (await response.json()) as T;
    if (!current(version)) throw new DOMException("Connection changed", "AbortError");
    return result;
  } catch (e) {
    // Only a request that got no usable response is rephrased; fetch reports a network failure as a TypeError.
    if (!controller.signal.aborted && !(e instanceof TypeError)) throw e;
    if (!current(version)) throw new DOMException("Connection changed", "AbortError");
    throw new Error(
      requestFailure(timedOut ? "timeout" : controller.signal.aborted ? "cancelled" : "network", method !== "GET"),
    );
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
function renderDisplay(): void {
  const version = ++displayVersion;
  const connectionVersion = generation;
  const content = segmentContent(parts, part);
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
  if (!ready) displayStatus("G2 연결 전 · 휴대폰에서 읽을 수 있습니다.");
  else if (!g2.has(2, g2Header()) || !g2.has(1, content, key)) displayStatus("G2 표시 요청 중");
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
        ok && headerOk ? "G2가 표시 갱신을 확인했습니다." : "G2 표시 갱신 실패 · 휴대폰에서 답변을 확인하세요.",
      );
    })
    .catch(() => {
      if (current(connectionVersion) && version === displayVersion)
        displayStatus("G2 표시 갱신을 확인하지 못했습니다.");
    });
}
function displayStatus(text: string): void {
  if (el("display").textContent !== text) el("display").textContent = text;
}
/** The message position leads the header, so moving between replies with identical text is still visible. */
function g2Header(): string {
  const position =
    selection.startsWith("reply:") && history.index >= 0 ? `답변 ${history.index + 1}/${history.messages.length}` : "";
  return Array.from([position, wakeLabel].filter(Boolean).join(" · ")).slice(0, 70).join("");
}
function showSelectedReply(): void {
  const reply = history.selected;
  if (!reply) return;
  el("reply").textContent = reply.text;
  parts = segments(reply.text);
  part = 0;
  selection = `reply:${reply.message_id}`;
  controls();
  renderDisplay();
}
/** Shows status text in the G2 body in place of a reply. */
function displayText(text: string): void {
  parts = segments(text);
  part = 0;
  selection = `notice:${++notices}`;
  renderDisplay();
}
/** A reply arrived behind the reader while G2 waited for it: the message being read comes back in place of the notice. */
function restoreReader(): void {
  status("Dot 답변 수신 · 읽던 메시지로 돌아갑니다. 새 답변은 다음 메시지로 이동해 확인하세요.");
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
  } else moveMessage(step.message);
}
async function poll(): Promise<void> {
  if (pollRunning || !active || exited || !credentials) return;
  clearTimeout(pollTimer);
  const version = generation;
  pollRunning = true;
  try {
    const result = await request<{ messages: Reply[] }>("/api/device/messages");
    if (!current(version) || !active) return;
    const revision = history.revision;
    const changed = history.receive(result.messages);
    controls();
    if (changed) {
      status("Dot 답변 수신 · G2 표시를 요청합니다.");
      showSelectedReply();
    } else if (history.revision !== revision && selection === replyNotice) restoreReader();
    // New replies behind the reader only change the header position; the body keeps its scroll.
    else if (
      history.revision !== revision ||
      (ready && (!g2.has(2, g2Header()) || !g2.has(1, segmentContent(parts, part), `${selection}#${part}`)))
    )
      renderDisplay();
  } catch (e) {
    if (current(version) && active) report(e);
  } finally {
    pollRunning = false;
    if (!exited && active && credentials) pollTimer = setTimeout(() => void poll(), current(version) ? 2500 : 0);
  }
}
function queueMic(action: () => Promise<void>): void {
  micQueue = micQueue.then(action).catch(report).finally(controls);
}
function showNotice(text: string): void {
  status(text);
  displayText(text);
}
function showPartial(text: string): void {
  el("partial").hidden = !text;
  el("partial").textContent = text ? `실시간 인식 (미확정): ${text}` : "";
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
    stream: openSonioxStream({
      credential: () => key,
      signal: entry.controller.signal,
      // Phone-only running text; G2, history and submission wait for the final transcript.
      onPartial: (text) => {
        if (voiceLive(voice)) showPartial(text);
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
}
async function finishVoice(voice: LiveVoice): Promise<void> {
  const { version, id } = voice;
  if (!current(version) || !active) return discardVoice(voice);
  status("음성 전사 마무리 중 · Soniox 최종 결과 대기");
  displayText("음성 전사 마무리 중 · 아직 전송 전");
  let kept = false;
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
            ? "전사 완료 · 내용을 확인한 뒤 전송하세요."
            : "전사 완료 · 입력 중이던 내용 뒤에 전사 결과를 붙였습니다. 확인한 뒤 전송하세요.",
        );
        displayText("전사 완료 · 휴대폰에서 확인한 뒤 전송하세요.");
        return next.draft;
      },
      send: (text) => sendText(text, version, id),
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
    if (kept)
      throw new Error(
        `${e instanceof Error ? e.message : "전송하지 못했습니다."} 전사 결과를 입력란에 남겼습니다. 확인한 뒤 다시 전송하세요.`,
      );
    if (!(e instanceof SonioxTranscriptionError)) throw e;
    // Cancellation by a key change or Hey dots off still replaces the "transcribing" notice on G2.
    if (current(version) && active) showNotice(sttMessage(e));
  } finally {
    transcriptions.delete(voice.entry);
    showPartial("");
  }
}
function startRecording(): void {
  if (!ready || !credentials || recordingWanted || recording || busy || !active || !bridge) return;
  if (!sonioxKey.value) return showNotice(NO_KEY);
  if (el<HTMLTextAreaElement>("text").value.trim()) return showNotice(DRAFT_PENDING);
  recordingWanted = true;
  syncWake();
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
      if (wakeMicOpen) {
        recordingWanted = false;
        withdraw();
        throw new Error("이전 마이크 중지를 확인한 뒤 다시 시도하세요.");
      }
      if (!(await bridge!.audioControl(true, AudioInputSource.Glasses))) {
        recordingWanted = false;
        withdraw();
        throw new Error("G2 마이크를 시작하지 못했습니다.");
      }
      recording = true;
      wakeNotice("마이크 켜짐 · 수동 녹음 중");
      if (!current(version) || !recordingWanted || !active) return;
      status("녹음 중 · Soniox 실시간 전사 중 · 중지하면 최종 결과를 전송합니다.");
      displayText("녹음 중 · 손을 떼면 전사 후 전송합니다.");
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
      const ok = await bridge!.audioControl(false, AudioInputSource.Glasses);
      if (!ok) {
        discardVoice(voice);
        status("마이크 중지를 확인하지 못했습니다. Even 앱에서 종료하세요.");
        return;
      }
      recording = false;
      wakeNotice("마이크 꺼짐 · 음성 처리 중");
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
el("wake-enabled").onchange = syncWake;
async function sendText(text: string, version: number, id: string): Promise<void> {
  if (!current(version) || !active) return;
  const replyRevision = history.revision;
  status("서버로 전송 중 · 아직 저장 확인 전");
  const result = await request<{ status: string }>("/api/device/utterances", "POST", utteranceBody(id, text));
  if (!current(version) || !active) return;
  const message =
    result.status === "accepted"
      ? "서버 저장 및 Dot 콜백 수신 확인 · 답변을 기다립니다."
      : "서버에 저장됨 · Dot 수신과 답변은 아직 확인되지 않았습니다.";
  // A reply can arrive while the submission HTTP response is still in flight.
  if (history.canShowSubmission(replyRevision)) {
    status(result.status === "replied" ? "서버에 답변 있음 · 답변을 불러옵니다." : message);
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
      if (current(version))
        status(`${e instanceof Error ? e.message : "전송하지 못했습니다."} 입력한 내용은 입력란에 남아 있습니다.`);
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
/** Pairing results stay next to the pairing form as well as in the page status. */
function pairNotice(text: string): void {
  el("pair-status").textContent = text;
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
        ? "서버 주소 형식이 올바르지 않습니다. https://로 시작하는 주소를 입력하세요."
        : (e as Error).message,
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
  pairNotice("서버에 연결하는 중");
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
        throw new Error(
          controller.signal.aborted
            ? "서버가 15초 안에 응답하지 않았습니다. 주소와 네트워크를 확인하세요."
            : "서버에 연결하지 못했습니다. 주소와 네트워크를 확인하세요.",
        );
      }
      if (!response.ok)
        throw new Error(
          response.status === 400 || response.status === 401 || response.status === 404
            ? `연결 코드가 맞지 않거나 만료되었습니다 (${response.status}). 새 코드를 받아 다시 입력하세요.`
            : `서버 연결 실패 (${response.status}) · 잠시 뒤 다시 시도하세요.`,
        );
      const result = (await response.json()) as { token: string };
      if (!current(version)) return;
      if (!result.token) throw new Error("서버가 연결 토큰을 반환하지 않았습니다.");
      const saved = { origin, token: result.token };
      if (!(await saveCredentials(JSON.stringify(saved))))
        throw new Error("연결 정보를 저장하지 못했습니다. 새 코드로 다시 연결하세요.");
      if (!current(version)) return;
      credentials = saved;
      el<HTMLInputElement>("code").value = "";
      history.clear();
      pairNotice("서버 연결됨 · Dot에서 MCP 연결과 구독도 완료하세요.");
      void poll();
    } catch (e) {
      if (!current(version)) return;
      credentials = previous;
      const message = e instanceof Error ? e.message : "연결하지 못했습니다.";
      pairNotice(previous ? `${message} 기존 서버 연결은 유지합니다.` : message);
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
        el("soniox-status").textContent = e instanceof Error ? e.message : "키를 적용하지 못했습니다.";
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
    el("soniox-status").textContent = "Even 앱 연결을 확인한 뒤 키를 입력하세요.";
    return;
  }
  if (keyBusy) return;
  const input = el<HTMLInputElement>("soniox-key");
  const value = input.value;
  // The key leaves the DOM as soon as it is read, whether or not it is accepted.
  input.value = "";
  el("soniox-status").textContent = "키 적용 중";
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
  el("soniox-status").textContent = "저장 설정 변경 중";
  keyResult(sonioxKey.remember(el<HTMLInputElement>("soniox-remember").checked));
};
el("soniox-clear").onclick = () => {
  if (!bridge) return;
  el<HTMLInputElement>("soniox-remember").checked = false;
  // The clear button hides once removal is confirmed; focus stays on the key field.
  el("soniox-key").focus();
  el("soniox-status").textContent = "키 지우는 중";
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
  el("reply").textContent = "연결을 해제했습니다.";
  displayText("연결을 해제했습니다.");
  controls();
  void saveCredentials("")
    .then((ok) =>
      status(
        ok
          ? "이 기기의 저장된 토큰을 지웠습니다. 서버에서도 기기를 해제하면 토큰이 폐기됩니다."
          : "토큰 삭제를 확인하지 못했습니다. Even 앱 저장 정보를 확인하세요.",
      ),
    )
    .catch(report);
};
function pause(): void {
  active = false;
  syncWake();
  clearTimeout(pollTimer);
  for (const request of requests) request.abort();
  abortTranscriptions(() => true);
  stopRecording(true);
  controls();
}
function resume(): void {
  if (exited || !pageLoaded) return;
  active = true;
  // G2 may have dropped the page while hidden, so resend the current text once.
  g2.forget();
  syncWake();
  controls();
  void poll();
  renderDisplay();
}
// Phone visibility is not the glasses session lifecycle. Packaged Even Hub apps can keep
// running with the phone locked; only pagehide or a host exit tears down the session.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && !active) resume();
  else if (!ready) pause();
});
window.addEventListener("pagehide", () => {
  pageLoaded = false;
  pause();
});
window.addEventListener("pageshow", () => {
  pageLoaded = true;
  resume();
});
// Outside the Even app the bridge never appears; say so instead of waiting silently.
const bridgeWait = setTimeout(() => {
  if (!bridge) status("Even 앱을 찾지 못했습니다. Even 앱의 Lens MCP for G2에서 열어 주세요.");
}, 10000);
// Fences startup restoration from the start, before any await.
const startup = generation;
void (async () => {
  bridge = await waitForEvenAppBridge();
  clearTimeout(bridgeWait);
  controls();
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
          content: "Lens MCP for G2 · 휴대폰에서 서버를 연결하세요.",
        }),
        new TextContainerProperty({
          containerID: 2,
          containerName: "microphone",
          xPosition: 8,
          yPosition: 8,
          width: 560,
          height: 32,
          content: "마이크 꺼짐",
        }),
      ],
    }),
  );
  if (result !== 0) throw new Error("G2 시작 화면을 만들지 못했습니다. Even 앱에서 다시 여세요.");
  ready = true;
  active = pageLoaded;
  controls();
  bridge.onEvenHubEvent((event) => {
    if (event.audioEvent && event.audioEvent.source !== AudioInputSource.Phone && wakeMicOpen && wakeAllowed())
      wakeDetector?.append(event.audioEvent.audioPcm);
    if (event.audioEvent && event.audioEvent.source !== AudioInputSource.Phone && recordingWanted && recording) {
      const frame = event.audioEvent.audioPcm;
      if (frame.length % 2) {
        stopRecording(true);
        status("잘못된 오디오 프레임을 받았습니다.");
        return;
      }
      const count = Math.min(frame.length, 960000 - bytes);
      // Frames go to Soniox as they arrive; the stream copies anything it has to hold while connecting.
      manualVoice?.stream.write(frame.subarray(0, count));
      bytes += count;
      if (bytes >= 960000) stopRecording(false);
    }
    const type = event.sysEvent?.eventType ?? event.textEvent?.eventType ?? event.listEvent?.eventType;
    if (type === OsEventTypeList.SYSTEM_EXIT_EVENT || type === OsEventTypeList.ABNORMAL_EXIT_EVENT) {
      pause();
      exited = true;
      cancelRequests();
      return;
    }
    if (!active) return;
    if (type === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      // Root-page exit must use the host's confirmation; cancelling leaves this session intact.
      void bridge!
        .shutDownPageContainer(1)
        .then((ok) => {
          if (!ok && !exited) status("G2 종료 확인창을 열지 못했습니다. 다시 두 번 탭하세요.");
        })
        .catch(() => {
          if (!exited) status("G2 종료 확인창을 열지 못했습니다. 다시 두 번 탭하세요.");
        });
      return;
    }
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
      status("저장된 Soniox 키를 불러오지 못했습니다. 키를 다시 입력하거나 키 지우기를 누르세요.");
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
      }
    } catch {
      status("저장된 연결 설정이 올바르지 않습니다. 새 코드로 연결하세요.");
    }
  }
  controls();
  status(credentials ? "저장된 서버 연결을 사용합니다." : "G2 준비됨 · 서버 주소와 연결 코드를 입력하세요.");
  syncWake();
  void poll();
})().catch((e) => {
  // A failed startup still lets the user pair instead of leaving the form disabled.
  restored = true;
  controls();
  report(e);
});
keyNotice();
controls();
// Hey dots defaults on; until its prerequisites are met the status names the missing one instead of the page's placeholder.
syncWake();
