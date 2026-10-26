export interface Reply {
  message_id: string;
  text: string;
  createdAt: string;
  utterance_id?: string;
  /** An acknowledgement the model wrote before working, or the final answer; a reply without a stage is final. */
  stage?: "ack" | "final";
}
/** The utterance a final answer completes; acknowledgements and proactive messages complete none. */
const answers = (item: Reply): string | undefined => (item.stage === "ack" ? undefined : item.utterance_id);

/** Preserve the reader's place while retaining a bounded, deduplicated reply history. */
export class MessageHistory {
  private items: Reply[] = [];
  private selectedId: string | undefined;
  revision = 0;
  private readonly capacity: number;
  constructor(capacity = 100) {
    this.capacity = capacity;
  }
  get messages(): readonly Reply[] {
    return this.items;
  }
  get index(): number {
    return this.items.findIndex((item) => item.message_id === this.selectedId);
  }
  get selected(): Reply | undefined {
    return this.items[this.index];
  }
  /**
   * A final answer supersedes its utterance's acknowledgement, whether it arrives in the same batch or later: a kept
   * acknowledgement leaves and the final joins the end, and an acknowledgement is never added after its final. A
   * reader on the acknowledgement moves to its final; a reader elsewhere keeps their place.
   */
  receive(batch: readonly Reply[]): boolean {
    const old = this.selected;
    const following = !old || this.index === this.items.length - 1;
    const answered = new Set([...this.items, ...batch].map(answers).filter(Boolean));
    const superseded = (item: Reply) => item.stage === "ack" && answered.has(item.utterance_id);
    const known = new Set(this.items.map((item) => item.message_id));
    const additions = batch.filter((item) => {
      if (known.has(item.message_id) || this.expired(item) || superseded(item)) return false;
      known.add(item.message_id);
      return true;
    });
    if (!additions.length) return false;
    const replaced = old && superseded(old) ? additions.find((item) => answers(item) === old.utterance_id) : undefined;
    this.items = [...this.items.filter((item) => !superseded(item)), ...additions].slice(-this.capacity);
    if (following) this.selectedId = this.items.at(-1)?.message_id;
    else if (replaced) this.selectedId = replaced.message_id;
    else if (!this.items.some((item) => item.message_id === this.selectedId))
      this.selectedId = this.items[0]?.message_id;
    this.revision++;
    return this.selected?.message_id !== old?.message_id;
  }
  move(delta: number): boolean {
    const next = Math.max(0, Math.min(this.items.length - 1, this.index + delta));
    const id = this.items[next]?.message_id;
    if (!id || id === this.selectedId) return false;
    this.selectedId = id;
    return true;
  }
  canShowSubmission(startRevision: number): boolean {
    return this.revision === startRevision;
  }
  /** The owner conversation revision last applied; undefined until a relay response carries one. */
  conversation: number | undefined;
  /** Counts observed owner deletions, so an in-flight submission can tell one happened while it waited. */
  erasures = 0;
  /**
   * Applies a poll's `conversation_revision` before its messages. A higher revision means the owner deleted the
   * conversation, so every cached reply and the reading position go; a lower one belongs to a response older than one
   * already applied, which must be dropped whole. Until the first valid revision, a response without one (a relay
   * predating the field) keeps the append-only behavior; after it, such a response is dropped whole, since it could
   * carry replies the owner has since deleted. The first revision above zero may follow a deletion made while this
   * history was filled by a legacy relay, so it is treated as one; zero only sets the baseline. Deletion is never
   * inferred from IDs missing in a capped batch.
   */
  observe(value: unknown): "current" | "erased" | "stale" | "invalid" {
    const valid = typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
    if (this.conversation === undefined) {
      if (!valid) return "current";
      this.conversation = value;
      if (value === 0) return "current";
      // Only announce a deletion when something was shown; a submission in flight is fenced either way.
      return this.erase() ? "erased" : "current";
    }
    if (!valid) return "invalid";
    if (value < this.conversation) return "stale";
    const erased = value > this.conversation && (this.erase(), true);
    this.conversation = value;
    return erased ? "erased" : "current";
  }
  /** Drops every reply and the reading position, and fences submissions in flight; reports whether any reply went. */
  private erase(): boolean {
    const had = this.items.length > 0;
    this.items = [];
    this.selectedId = undefined;
    this.revision++;
    this.erasures++;
    return had;
  }
  /** The newest relay retention cutoff applied, in epoch ms; replies created at or before it have expired. */
  private cutoff = -Infinity;
  private expired(item: Reply): boolean {
    const created = Date.parse(item.createdAt);
    return !Number.isNaN(created) && created <= this.cutoff;
  }
  /**
   * Applies a poll's `retention_cutoff` and drops the known replies it has expired. The cutoff never moves back, so an
   * older response cannot bring an expired reply back, and a reply whose timestamp cannot be read is kept.
   */
  expire(value: unknown): boolean {
    const at = typeof value === "string" ? Date.parse(value) : Number.NaN;
    if (!Number.isNaN(at) && at > this.cutoff) this.cutoff = at;
    const kept = this.items.filter((item) => !this.expired(item));
    if (kept.length === this.items.length) return false;
    this.items = kept;
    // An expired reader position moves to the oldest reply still kept, which is nearest to it.
    if (!this.items.some((item) => item.message_id === this.selectedId)) this.selectedId = this.items[0]?.message_id;
    this.revision++;
    return true;
  }
  /** Forgets everything, including the revision and cutoff baselines, for a new or removed connection. */
  clear(): void {
    this.items = [];
    this.selectedId = undefined;
    this.conversation = undefined;
    this.cutoff = -Infinity;
    this.revision++;
  }
}
