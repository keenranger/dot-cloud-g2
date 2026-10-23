import { test } from "node:test";
import assert from "node:assert/strict";
import { G2Text } from "./g2-display.ts";

/** A mocked bridge whose upgrades resolve only when the test says so. */
class FakeBridge {
  writes: { id: number; content: string; settle: (ok: boolean) => void; fail: () => void }[] = [];
  upgrade = (id: number, _name: string, content: string) =>
    new Promise<boolean>((settle, reject) =>
      this.writes.push({ id, content, settle, fail: () => reject(new Error("bridge")) }),
    );
  /** Acknowledges every pending write and returns how many there were. */
  ack(ok = true): number {
    const pending = this.writes.splice(0);
    for (const write of pending) write.settle(ok);
    return pending.length;
  }
}
async function shown(g2: G2Text, bridge: FakeBridge, id: number, content: string, key = ""): Promise<number> {
  const result = g2.show(id, id === 1 ? "reply" : "microphone", content, key);
  const written = bridge.writes.filter((write) => write.id === id).length;
  bridge.ack();
  await result;
  return written;
}

test("a status change rewrites only the header, so the reply body keeps its native scroll position", async () => {
  const bridge = new FakeBridge();
  const g2 = new G2Text(bridge.upgrade);
  assert.equal(await shown(g2, bridge, 2, "답변 1/2 · 마이크 꺼짐"), 1);
  assert.equal(await shown(g2, bridge, 1, "긴 답변", "reply:a#0"), 1);
  assert.equal(await shown(g2, bridge, 2, "답변 1/2 · 마이크 켜짐 · 수동 녹음 중"), 1);
  assert.equal(await shown(g2, bridge, 1, "긴 답변", "reply:a#0"), 0);
});

test("a different message with identical text is still rewritten from its start", async () => {
  const bridge = new FakeBridge();
  const g2 = new G2Text(bridge.upgrade);
  await shown(g2, bridge, 1, "네", "reply:a#0");
  assert.equal(await shown(g2, bridge, 1, "네", "reply:b#0"), 1);
});

test("forget() during an in-flight update keeps its late acknowledgement from suppressing the resend", async () => {
  const bridge = new FakeBridge();
  const g2 = new G2Text(bridge.upgrade);
  const stale = g2.show(1, "reply", "답변", "reply:a#0");
  // The page is hidden and shown again before G2 acknowledges the first write.
  g2.forget();
  bridge.ack();
  assert.equal(await stale, true);
  assert.equal(await shown(g2, bridge, 1, "답변", "reply:a#0"), 1);
});

test("an older write acknowledged after a newer one does not claim the container", async () => {
  const bridge = new FakeBridge();
  const g2 = new G2Text(bridge.upgrade);
  const first = g2.show(1, "reply", "A", "notice:1");
  const second = g2.show(1, "reply", "B", "notice:2");
  const [older, newer] = bridge.writes.splice(0);
  newer.settle(true);
  await second;
  older.settle(true);
  await first;
  // The container may show either text, so A is not treated as already shown...
  assert.equal(await shown(g2, bridge, 1, "A", "notice:1"), 1);
});

test("a rejected or failed update is retried on the next render", async () => {
  const bridge = new FakeBridge();
  const g2 = new G2Text(bridge.upgrade);
  const failed = g2.show(1, "reply", "답변", "reply:a#0");
  bridge.ack(false);
  assert.equal(await failed, false);
  const thrown = g2.show(1, "reply", "답변", "reply:a#0");
  bridge.writes.splice(0)[0].fail();
  assert.equal(await thrown, false);
  assert.equal(await shown(g2, bridge, 1, "답변", "reply:a#0"), 1);
  assert.equal(await shown(g2, bridge, 1, "답변", "reply:a#0"), 0);
});

test("a throwing header does not prevent the reply write and remains eligible for recovery", async () => {
  const calls: number[] = [];
  const g2 = new G2Text((id) => {
    calls.push(id);
    if (id === 2) throw new Error("host rejected header");
    return Promise.resolve(true);
  });
  assert.equal(await g2.show(2, "microphone", "listening"), false);
  assert.equal(await g2.show(1, "reply", "답변", "reply:a#0"), true);
  assert.deepEqual(calls, [2, 1]);
  assert.equal(g2.has(2, "listening"), false);
  assert.equal(g2.has(1, "답변", "reply:a#0"), true);
});

test("has() reports only text show() would skip: same key, acknowledged, not in flight, failed or forgotten", async () => {
  const bridge = new FakeBridge();
  const g2 = new G2Text(bridge.upgrade);
  assert.equal(g2.has(1, "답변", "reply:a#0"), false);
  await shown(g2, bridge, 1, "답변", "reply:a#0");
  assert.equal(g2.has(1, "답변", "reply:a#0"), true);
  assert.equal(g2.has(1, "답변", "reply:b#0"), false, "a different message with identical text needs a write");
  assert.equal(g2.has(2, "답변", "reply:a#0"), false);
  const pending = g2.show(1, "reply", "다른 답변", "reply:b#0");
  assert.equal(g2.has(1, "답변", "reply:a#0"), false, "an in-flight write leaves the container unknown");
  bridge.ack(false);
  await pending;
  assert.equal(g2.has(1, "다른 답변", "reply:b#0"), false, "a rejected write is retried");
  await shown(g2, bridge, 1, "답변", "reply:a#0");
  g2.forget();
  assert.equal(g2.has(1, "답변", "reply:a#0"), false);
});
