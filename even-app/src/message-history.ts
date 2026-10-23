export interface Reply {
  message_id: string;
  text: string;
  createdAt: string;
  utterance_id?: string;
}

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
  receive(batch: readonly Reply[]): boolean {
    const old = this.selected;
    const following = !old || this.index === this.items.length - 1;
    const known = new Set(this.items.map((item) => item.message_id));
    const additions = batch.filter((item) => {
      if (known.has(item.message_id)) return false;
      known.add(item.message_id);
      return true;
    });
    if (!additions.length) return false;
    this.items = [...this.items, ...additions].slice(-this.capacity);
    if (following) this.selectedId = this.items.at(-1)?.message_id;
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
  clear(): void {
    this.items = [];
    this.selectedId = undefined;
    this.revision++;
  }
}
