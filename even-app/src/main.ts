import {
  AudioInputSource,
  CreateStartUpPageContainer,
  OsEventTypeList,
  TextContainerProperty,
  TextContainerUpgrade,
  waitForEvenAppBridge,
  type EvenAppBridge,
} from "@evenrealities/even_hub_sdk";
import { pages, relayOrigin } from "./protocol.ts";
import "./style.css";
import { completeVoice, draftFor, utteranceBody, type Draft } from "./voice-flow.ts";
import { SonioxTranscriptionError, openSonioxStream, sttMessage, type SonioxStream } from "./soniox-transcriber.ts";
import { SonioxKey } from "./soniox-key.ts";
import { MessageHistory, type Reply } from "./message-history.ts";
import { loadWakeDetector, type WakeDetector } from "./wake-detector.ts";
import { canListen, finishWakeClip } from "./wake-gate.ts";
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const status = (text: string) => {
  el("status").textContent = text;
};
const storageKey = "dot-cloud-device-v1";
let bridge: EvenAppBridge | undefined;
let ready = false;
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
let selectedPages = ["연결 후 길게 누른 채 말하세요."];
let page = 0;
const history = new MessageHistory();
let recording = false;
let recordingWanted = false;
let micQueue = Promise.resolve();
let bytes = 0;
let recordingTimer: ReturnType<typeof setTimeout> | undefined;
let busy = false;
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
function wakeAllowed(): boolean {
  return canListen({
    enabled: el<HTMLInputElement>("wake-enabled").checked,
    active: active && !exited,
    ready,
    connected: !!credentials,
    transcriber: !!sonioxKey.value,
    busy,
    manual: recordingWanted || recording,
    draft: !!el<HTMLTextAreaElement>("text").value.trim(),
  });
}
function wakeNotice(text: string): void {
  el("wake-status").textContent = text;
  wakeLabel = text;
  if (ready) renderDisplay();
}
function syncWake(): void {
  if (!wakeAllowed()) {
    wakeEpoch++;
    wakeDetector?.cancel();
    wakeNotice(
      wakeMicOpen
        ? "마이크 중지 요청 중"
        : !el<HTMLInputElement>("wake-enabled").checked
          ? "Hey dots 꺼짐 · 마이크를 열지 않습니다."
          : !sonioxKey.value
            ? "Hey dots 사용 불가 · Soniox 키가 없어 마이크를 열지 않습니다."
            : "Hey dots 감지 일시 중지 · 녹음, 처리 또는 작성 중에는 듣지 않습니다.",
    );
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
      }
      wakeNotice(
        !el<HTMLInputElement>("wake-enabled").checked
          ? "Hey dots 꺼짐 · 마이크 꺼짐"
          : !sonioxKey.value
            ? "Hey dots 사용 불가 · Soniox 키 없음 · 마이크 꺼짐"
            : "Hey dots 일시 중지 · 마이크 꺼짐",
      );
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
            selectedPages = ["Hey dots 감지됨 · 질문을 말하세요."];
            page = 0;
            renderDisplay();
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
                    else {
                      selectedPages = ["질문을 기다립니다. Hey dots 또는 길게 누르기로 말하세요."];
                      page = 0;
                      renderDisplay();
                    }
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
  el<HTMLButtonElement>("record").disabled =
    !ready || !credentials || !sonioxKey.value || busy || recordingWanted || recording || !active;
  el<HTMLButtonElement>("stop").disabled = !recordingWanted && !recording;
  el<HTMLButtonElement>("send").disabled =
    !credentials || busy || recordingWanted || !el<HTMLTextAreaElement>("text").value.trim();
  el("disconnect").hidden = !credentials;
  el<HTMLButtonElement>("prev-message").disabled = history.index <= 0;
  el<HTMLButtonElement>("next-message").disabled = history.index < 0 || history.index >= history.messages.length - 1;
  el("message-position").textContent = history.messages.length
    ? `${history.index + 1} / ${history.messages.length}개 메시지`
    : "아직 받은 메시지가 없습니다.";
}
async function request<T>(path: string, method = "GET", body?: BodyInit, type = "application/json"): Promise<T> {
  const saved = credentials;
  if (!saved) throw new Error("먼저 서버에 연결하세요.");
  const version = generation;
  const controller = new AbortController();
  requests.add(controller);
  const timeout = setTimeout(() => controller.abort(), 45000);
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
  const content = `${page + 1}/${selectedPages.length}\n${selectedPages[page]}`;
  el("display").textContent = ready ? "G2 표시 요청 중" : "G2 연결 전 · 휴대폰에서 읽을 수 있습니다.";
  displayQueue = displayQueue
    .then(async () => {
      if (!ready || !bridge || !active || !current(connectionVersion) || version !== displayVersion) return;
      const header = wakeLabel.slice(0, 70);
      const headerOk = await bridge.textContainerUpgrade(
        new TextContainerUpgrade({
          containerID: 2,
          containerName: "microphone",
          contentOffset: 0,
          contentLength: header.length,
          content: header,
        }),
      );
      if (!current(connectionVersion) || version !== displayVersion) return;
      const ok = await bridge.textContainerUpgrade(
        new TextContainerUpgrade({
          containerID: 1,
          containerName: "reply",
          contentOffset: 0,
          contentLength: content.length,
          content,
        }),
      );
      if (!current(connectionVersion) || version !== displayVersion) return;
      el("display").textContent =
        ok && headerOk ? "G2가 표시 갱신을 확인했습니다." : "G2 표시 갱신 실패 · 휴대폰에서 답변을 확인하세요.";
    })
    .catch(() => {
      if (current(connectionVersion) && version === displayVersion)
        el("display").textContent = "G2 표시 갱신을 확인하지 못했습니다.";
    });
}
function showSelectedReply(): void {
  const reply = history.selected;
  if (!reply) return;
  el("reply").textContent = reply.text;
  selectedPages = pages(reply.text);
  page = 0;
  controls();
  renderDisplay();
}
function moveMessage(delta: number): void {
  if (history.move(delta)) showSelectedReply();
}
function turn(delta: number): void {
  if ((delta < 0 && page === 0) || (delta > 0 && page === selectedPages.length - 1)) {
    if (history.move(delta)) {
      showSelectedReply();
      if (delta < 0) {
        page = selectedPages.length - 1;
        renderDisplay();
      }
      return;
    }
  }
  page = Math.max(0, Math.min(selectedPages.length - 1, page + delta));
  renderDisplay();
}
async function poll(): Promise<void> {
  if (pollRunning || !active || exited || !credentials) return;
  const version = generation;
  pollRunning = true;
  try {
    const result = await request<{ messages: Reply[] }>("/api/device/messages");
    if (!current(version) || !active) return;
    const changed = history.receive(result.messages);
    controls();
    if (changed) {
      status("Dot 답변 수신 · G2 표시를 요청합니다.");
      showSelectedReply();
    }
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
  selectedPages = pages(text);
  page = 0;
  renderDisplay();
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
  selectedPages = ["음성 전사 마무리 중 · 아직 전송 전"];
  page = 0;
  renderDisplay();
  try {
    await completeVoice({
      transcribe: () => voice.stream.end(),
      current: () => voiceLive(voice),
      automatic: () => el<HTMLInputElement>("auto-send").checked,
      review: (text) => {
        el<HTMLTextAreaElement>("text").value = text;
        draft = { id, text };
        status("전사 완료 · 자동 전송을 끈 경우 내용을 확인한 뒤 전송하세요.");
      },
      send: (text) => sendText(text, version, id),
    });
  } catch (e) {
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
    selectedPages = ["녹음 중 · 손을 떼면 전사 후 전송합니다."];
    page = 0;
    renderDisplay();
    recordingTimer = setTimeout(() => stopRecording(false), 30000);
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
        syncWake();
      }
    }
  });
}
el("record").onclick = startRecording;
el("stop").onclick = () => stopRecording(false);
el("prev").onclick = () => turn(-1);
el("next").onclick = () => turn(1);
el("prev-message").onclick = () => moveMessage(-1);
el("next-message").onclick = () => moveMessage(1);
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
    if (result.status !== "replied") {
      selectedPages = pages(message);
      page = 0;
      renderDisplay();
    } else void poll();
  }
  el<HTMLTextAreaElement>("text").value = "";
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
      if (current(version)) report(e);
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
el<HTMLFormElement>("pair").onsubmit = (event) => {
  event.preventDefault();
  if (busy || !bridge) return;
  void (async () => {
    const origin = relayOrigin(el<HTMLInputElement>("origin").value.trim());
    const code = el<HTMLInputElement>("code").value.trim();
    cancelRequests();
    stopRecording(true);
    credentials = undefined;
    syncWake();
    busy = true;
    controls();
    const version = generation;
    const controller = new AbortController();
    requests.add(controller);
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(origin + "/api/device/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`연결 실패 (${response.status}) · 새 코드를 확인하세요.`);
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
      status("서버 연결됨 · Dot에서 MCP 연결과 구독도 완료하세요.");
      void poll();
    } finally {
      clearTimeout(timeout);
      requests.delete(controller);
      if (current(version)) {
        busy = false;
        controls();
        syncWake();
      }
    }
  })().catch(report);
};
el<HTMLFormElement>("soniox").onsubmit = (event) => {
  event.preventDefault();
  if (!bridge) return status("Even 앱 연결을 확인한 뒤 키를 입력하세요.");
  const input = el<HTMLInputElement>("soniox-key");
  const value = input.value;
  // The key leaves the DOM as soon as it is read, whether or not it is accepted.
  input.value = "";
  void sonioxKey.apply(value, el<HTMLInputElement>("soniox-remember").checked).then(
    () => keyNotice(),
    (e) => {
      keyNotice();
      report(e);
    },
  );
};
el("soniox-key").onkeydown = (event) => {
  if (event.isComposing && event.key === "Enter") event.preventDefault();
};
el("soniox-remember").onchange = () => {
  // With no key yet, the choice simply applies when a key is entered.
  if (!bridge || !sonioxKey.value) return;
  void sonioxKey.remember(el<HTMLInputElement>("soniox-remember").checked).then(() => keyNotice(), report);
};
el("soniox-clear").onclick = () => {
  if (!bridge) return;
  el<HTMLInputElement>("soniox-remember").checked = false;
  void sonioxKey.clear().then(() => keyNotice(), report);
};
el("disconnect").onclick = () => {
  cancelRequests();
  stopRecording(true);
  credentials = undefined;
  syncWake();
  busy = false;
  history.clear();
  el("reply").textContent = "연결을 해제했습니다.";
  selectedPages = ["연결을 해제했습니다."];
  page = 0;
  renderDisplay();
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
  if (exited) return;
  active = true;
  syncWake();
  controls();
  void poll();
  renderDisplay();
}
document.addEventListener("visibilitychange", () => (document.hidden ? pause() : resume()));
window.addEventListener("pagehide", pause);
window.addEventListener("pageshow", resume);
void (async () => {
  bridge = await waitForEvenAppBridge();
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
          content: "Dot Cloud · 휴대폰에서 서버를 연결하세요.",
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
    if (type === OsEventTypeList.LONG_PRESS_EVENT) startRecording();
    if (type === OsEventTypeList.LONG_PRESS_RELEASE_EVENT) stopRecording(false);
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
  const restoreVersion = generation;
  const saved = await bridge.getLocalStorage(storageKey);
  if (!current(restoreVersion)) return;
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
})().catch(report);
keyNotice();
controls();
