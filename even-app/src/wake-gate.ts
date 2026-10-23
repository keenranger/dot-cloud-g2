export interface WakeConditions {
  enabled: boolean;
  active: boolean;
  ready: boolean;
  connected: boolean;
  /** A Soniox key is configured; without it a post-cue clip could not be transcribed. */
  transcriber: boolean;
  busy: boolean;
  manual: boolean;
  draft: boolean;
}
/** The first condition that keeps the microphone closed, in the order a user would resolve them; none means listening. */
export type WakeBlocker = "enabled" | "active" | "ready" | "connected" | "transcriber" | "manual" | "busy" | "draft";
export function wakeBlocker(state: WakeConditions): WakeBlocker | undefined {
  if (!state.enabled) return "enabled";
  if (!state.active) return "active";
  if (!state.ready) return "ready";
  if (!state.connected) return "connected";
  if (!state.transcriber) return "transcriber";
  if (state.manual) return "manual";
  if (state.busy) return "busy";
  if (state.draft) return "draft";
  return undefined;
}
/** Listening is on by default and never competes with a pending clip, draft, or manual recording. */
export function canListen(state: WakeConditions): boolean {
  return !wakeBlocker(state);
}
/** Why the microphone stays closed, so a default-on setting never looks like it is listening when it is not. */
export const WAKE_BLOCKED: Record<WakeBlocker, string> = {
  enabled: "Hey dots 꺼짐 · 마이크를 열지 않습니다.",
  active: "Hey dots 대기 · 앱이 화면에 있을 때만 듣습니다.",
  ready: "Hey dots 대기 · G2 화면이 준비되면 마이크를 엽니다.",
  connected: "Hey dots 대기 · 서버에 연결하면 마이크를 엽니다.",
  transcriber: "Hey dots 사용 불가 · Soniox 키가 없어 마이크를 열지 않습니다.",
  manual: "Hey dots 일시 중지 · 수동 녹음 중에는 듣지 않습니다.",
  busy: "Hey dots 일시 중지 · 이전 요청을 처리하는 중입니다.",
  draft: "Hey dots 일시 중지 · 작성 중인 내용을 전송하거나 지우면 다시 듣습니다.",
};

/** Empty or withdrawn captures restore the reading view without touching the network. */
export async function finishWakeClip(options: {
  clip?: Uint8Array;
  canUpload: () => boolean;
  upload: (clip: Uint8Array) => Promise<void>;
  restore: () => void;
}): Promise<void> {
  if (!options.clip || !options.canUpload()) {
    options.restore();
    return;
  }
  await options.upload(options.clip);
}
