export const SONIOX_KEY_STORAGE = "dot-cloud-soniox-key-v1";
// Same RFC 7230 token rule the transcriber enforces for the subprotocol value.
const TOKEN = /^[A-Za-z0-9!#$%&'*+.^_`|~-]{8,512}$/;

/** Only the Even Hub SDK storage; there is deliberately no browser storage fallback. */
export interface KeyStorage {
  getLocalStorage(key: string): Promise<string>;
  setLocalStorage(key: string, value: string): Promise<boolean>;
}

export type KeyPersistence = "memory" | "remembered" | "unconfirmed";

/**
 * Holds the user's own Soniox key in memory by default. It is written to SDK storage only after an
 * explicit opt-in, and turning that off, replacing or clearing the key overwrites the stored copy.
 * Error messages never include the key.
 */
export class SonioxKey {
  private key: string | undefined;
  private queue: Promise<unknown> = Promise.resolve();
  remembered = false;
  /** The last storage read or write failed, so a previously remembered key may still be stored. */
  unconfirmed = false;
  /** Bumped on every key change so in-flight transcriptions can tell their key was replaced. */
  revision = 0;

  private readonly storage: () => KeyStorage;
  private readonly onChange: () => void;

  constructor(storage: () => KeyStorage, onChange: () => void = () => {}) {
    this.storage = storage;
    this.onChange = onChange;
  }

  get value(): string | undefined {
    return this.key;
  }

  /** Loads a previously remembered key unless the user already changed the key meanwhile. */
  restore(): Promise<boolean> {
    const revision = this.revision;
    return this.serial(async () => {
      let saved: string;
      try {
        saved = (await this.storage().getLocalStorage(SONIOX_KEY_STORAGE)) || "";
      } catch (e) {
        if (revision === this.revision) this.unconfirmed = true;
        throw e;
      }
      if (revision !== this.revision || !saved) return false;
      if (!TOKEN.test(saved)) {
        const ok = await this.storage()
          .setLocalStorage(SONIOX_KEY_STORAGE, "")
          .catch(() => false);
        // An unremoved malformed value is still a stored secret the user must be able to clear.
        if (revision === this.revision) this.unconfirmed = !ok;
        return false;
      }
      this.set(saved);
      this.remembered = true;
      return true;
    });
  }

  apply(raw: string, remember: boolean): Promise<KeyPersistence> {
    const key = raw.trim();
    if (!TOKEN.test(key))
      return Promise.reject(new Error("Soniox 키 형식이 올바르지 않습니다. 콘솔에서 복사한 키 전체를 붙여 넣으세요."));
    this.set(key);
    return this.persist(remember);
  }

  /** Remembers or forgets the current in-memory key without changing it. */
  remember(remember: boolean): Promise<KeyPersistence> {
    return this.persist(remember && this.key !== undefined);
  }

  clear(): Promise<boolean> {
    this.set(undefined);
    return this.persist(false).then((result) => result !== "unconfirmed");
  }

  private set(key: string | undefined): void {
    this.key = key;
    this.revision++;
    this.onChange();
  }

  private persist(remember: boolean): Promise<KeyPersistence> {
    const revision = this.revision;
    const state = (): KeyPersistence => (this.unconfirmed ? "unconfirmed" : this.remembered ? "remembered" : "memory");
    return this.serial(async () => {
      // A newer key change has its own write queued behind this one; only that write may publish state.
      if (revision !== this.revision) return state();
      const value = remember && this.key ? this.key : "";
      const ok = await this.storage()
        .setLocalStorage(SONIOX_KEY_STORAGE, value)
        .catch(() => false);
      if (revision !== this.revision) return state();
      // A failed write leaves the stored copy unknown: it is neither remembered nor confirmed removed.
      this.remembered = ok && value !== "";
      this.unconfirmed = !ok;
      return state();
    });
  }

  private serial<T>(action: () => Promise<T>): Promise<T> {
    const result = this.queue.catch(() => undefined).then(action);
    this.queue = result;
    return result;
  }
}
