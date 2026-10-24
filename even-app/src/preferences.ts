import type { KeyStorage } from "./soniox-key.ts";

export const PREFERENCES_STORAGE = "dot-cloud-preferences-v1";

export interface Preferences {
  /** Hey dots local wake listening. */
  wake: boolean;
  /** Send a final transcript without review. */
  autoSend: boolean;
}

/** Both voice conveniences start on, but only while nothing has been saved. */
export const DEFAULT_PREFERENCES: Preferences = { wake: true, autoSend: true };
/** A saved choice that cannot be read may be OFF, so neither the microphone nor an unreviewed send is assumed. */
export const UNKNOWN_PREFERENCES: Preferences = { wake: false, autoSend: false };

/** Defaults for an empty value, the saved choice for a valid one, and undefined for anything that cannot be trusted. */
export function parsePreferences(raw: string): Preferences | undefined {
  if (!raw) return { ...DEFAULT_PREFERENCES };
  try {
    const value = JSON.parse(raw) as Partial<Preferences> | null;
    if (typeof value?.wake === "boolean" && typeof value.autoSend === "boolean")
      return { wake: value.wake, autoSend: value.autoSend };
  } catch {
    // Treated like an unreadable value below.
  }
  return undefined;
}

/** Explicit Hey dots and auto-send choices in Even Hub SDK storage; there is no browser storage fallback. */
export class PreferenceStore {
  private queue: Promise<unknown> = Promise.resolve();
  private revision = 0;
  private readonly storage: () => KeyStorage;

  constructor(storage: () => KeyStorage) {
    this.storage = storage;
  }

  /** The saved choice, defaults when none was saved, or undefined when it could not be read. */
  async restore(): Promise<Preferences | undefined> {
    try {
      return parsePreferences((await this.storage().getLocalStorage(PREFERENCES_STORAGE)) || "");
    } catch {
      return undefined;
    }
  }

  /** Resolves whether the write was confirmed, or undefined when a newer choice superseded it. */
  save(value: Preferences): Promise<boolean | undefined> {
    const revision = ++this.revision;
    const result = this.queue
      .catch(() => undefined)
      .then(async () => {
        const ok = await this.storage()
          .setLocalStorage(PREFERENCES_STORAGE, JSON.stringify(value))
          .catch(() => false);
        return revision === this.revision ? ok : undefined;
      });
    this.queue = result;
    return result;
  }
}
