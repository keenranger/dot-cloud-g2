import { test } from "node:test";
import assert from "node:assert/strict";
import { MessageHistory } from "./message-history.ts";
const reply = (id: string) => ({ message_id: id, text: `reply ${id}`, createdAt: "2026-10-23T00:00:00Z" });
test("a reply arriving before submission settles cannot be replaced by its waiting state", async () => {
  const history = new MessageHistory();
  const ticket = history.revision;
  let settle!: () => void;
  const response = new Promise<void>((resolve) => {
    settle = resolve;
  });
  let screen = "sending";
  const submission = response.then(() => {
    if (history.canShowSubmission(ticket)) screen = "waiting";
  });
  history.receive([reply("a")]);
  screen = history.selected!.text;
  settle();
  await submission;
  assert.equal(screen, "reply a");
});
test("all batch messages remain selectable without duplicate IDs and a reader keeps position", () => {
  const history = new MessageHistory();
  history.receive([reply("a"), reply("b"), reply("c")]);
  assert.equal(history.selected?.message_id, "c");
  history.move(-1);
  history.receive([reply("b"), reply("c"), reply("d"), reply("d")]);
  assert.equal(history.selected?.message_id, "b");
  assert.deepEqual(
    history.messages.map((item) => item.message_id),
    ["a", "b", "c", "d"],
  );
  history.move(-1);
  assert.equal(history.selected?.message_id, "a");
  history.move(1);
  history.move(1);
  history.move(1);
  history.receive([reply("e")]);
  assert.equal(history.selected?.message_id, "e");
});
test("history is bounded and handles eviction of the selected item", () => {
  const history = new MessageHistory(3);
  history.receive([reply("a"), reply("b"), reply("c")]);
  history.move(-2);
  history.receive([reply("d"), reply("e")]);
  assert.deepEqual(
    history.messages.map((item) => item.message_id),
    ["c", "d", "e"],
  );
  assert.equal(history.selected?.message_id, "c");
});
