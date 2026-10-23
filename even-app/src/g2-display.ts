/** Upgrades one G2 text container and resolves to the host's acknowledgement. */
export type TextWriter = (containerID: number, containerName: string, content: string) => Promise<boolean>;

/**
 * Remembers what each G2 text container last acknowledged, so unchanged text is not resent: rewriting the natively
 * scrolled reply body would move the reader back to its top. An entry matches only the same selection key and text,
 * so a different message with identical text is still shown from its start. An acknowledgement is recorded only while
 * no later write to that container and no `forget()` has started, so a resend after resume or a connection change is
 * never suppressed by an older in-flight result.
 */
export class G2Text {
  private readonly shown = new Map<number, string>();
  private readonly writes = new Map<number, number>();
  private sequence = 0;
  private readonly write: TextWriter;

  constructor(write: TextWriter) {
    this.write = write;
  }

  /** Whether `show` would skip this text: it was acknowledged, and no later write, failure or `forget()` intervened. */
  has(containerID: number, content: string, key = ""): boolean {
    return this.shown.get(containerID) === `${key}\u0000${content}`;
  }

  async show(containerID: number, containerName: string, content: string, key = ""): Promise<boolean> {
    if (this.has(containerID, content, key)) return true;
    const stamp = `${key}\u0000${content}`;
    const sequence = ++this.sequence;
    this.writes.set(containerID, sequence);
    // Until this write is acknowledged, the container's text is unknown.
    this.shown.delete(containerID);
    // A rejected header write must not prevent the independent reply container from being attempted.
    // Leave failures uncached so the next reconciliation can recover without a new server message.
    let ok = false;
    try {
      ok = await this.write(containerID, containerName, content);
    } catch {
      // The SDK may reject asynchronously or throw while validating the call.
    }
    if (ok && this.writes.get(containerID) === sequence) this.shown.set(containerID, stamp);
    return ok;
  }

  forget(): void {
    this.writes.clear();
    this.shown.clear();
  }
}
