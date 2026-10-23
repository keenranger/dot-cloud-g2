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
/** Listening is opt-in and never competes with a pending clip, draft, or manual recording. */
export function canListen(state: WakeConditions): boolean {
  return (
    state.enabled &&
    state.active &&
    state.ready &&
    state.connected &&
    state.transcriber &&
    !state.busy &&
    !state.manual &&
    !state.draft
  );
}

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
