import { test } from "node:test";
import assert from "node:assert/strict";
import { ExitRequest, edgeNote, idleBody } from "./g2-guide.ts";
import { G2Text } from "./g2-display.ts";
import { MessageHistory } from "./message-history.ts";
import { boundaryStep } from "./protocol.ts";

test("the idle G2 body names the next setup step in the order the user resolves them", () => {
  assert.match(idleBody({ restored: false, connected: false, transcriber: false }), /확인하는 중/);
  assert.match(idleBody({ restored: true, connected: false, transcriber: true }), /연결 키/);
  const key = idleBody({ restored: true, connected: true, transcriber: false });
  assert.match(key, /Soniox 키/);
  assert.match(key, /직접 입력/);
  const ready = idleBody({ restored: true, connected: true, transcriber: true });
  assert.match(ready, /길게 누른 채/);
  assert.doesNotMatch(ready, /Soniox|연결 키/);
});

test("a G2 scroll past the first, last or no message gets a truthful header note", () => {
  const history = new MessageHistory();
  const at = (delta: number) => boundaryStep(0, 1, delta);
  const empty = at(1);
  assert.ok("message" in empty && !history.move(empty.message));
  assert.equal(edgeNote(history.messages.length, 1), "받은 답변 없음");
  history.receive([
    { message_id: "a", text: "첫", createdAt: "1" },
    { message_id: "b", text: "둘", createdAt: "2" },
  ]);
  assert.equal(history.index, 1);
  assert.equal(history.move(1), false);
  assert.equal(edgeNote(history.messages.length, 1), "마지막 답변입니다");
  assert.equal(history.move(-1), true);
  assert.equal(history.move(-1), false);
  assert.equal(edgeNote(history.messages.length, -1), "첫 답변입니다");
});

test("an edge note rewrites only the header, so the reply body keeps its native scroll position", async () => {
  const writes: number[] = [];
  const g2 = new G2Text(async (id) => {
    writes.push(id);
    return true;
  });
  await g2.show(2, "microphone", "답변 2/2 · 마이크 꺼짐");
  await g2.show(1, "reply", "둘", "reply:b#0");
  writes.length = 0;
  await g2.show(2, "microphone", `답변 2/2 · ${edgeNote(2, 1)} · 마이크 꺼짐`);
  await g2.show(1, "reply", "둘", "reply:b#0");
  assert.deepEqual(writes, [2]);
});

test("a double tap asks once for the host's exit confirmation while a request is pending", async () => {
  const pending: ((ok: boolean) => void)[] = [];
  const exit = new ExitRequest(() => new Promise<boolean>((settle) => pending.push(settle)));
  const first = exit.request();
  assert.equal(await exit.request(), undefined);
  assert.equal(pending.length, 1);
  pending[0](true);
  assert.equal(await first, true);
  // The user may cancel the host dialog without any event; the next double tap asks again.
  const again = exit.request();
  assert.equal(pending.length, 2);
  pending[1](true);
  assert.equal(await again, true);
});

test("a refused or failed exit request is reported and can be retried", async () => {
  let calls = 0;
  const refused = new ExitRequest(async () => {
    calls++;
    return false;
  });
  assert.equal(await refused.request(), false);
  assert.equal(await refused.request(), false);
  assert.equal(calls, 2);
  const failing = new ExitRequest(() => Promise.reject(new Error("bridge")));
  assert.equal(await failing.request(), false);
  assert.equal(await failing.request(), false);
});
