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
test("a higher conversation revision drops cached replies; same revisions never do, lower or missing ones are dropped", () => {
  const history = new MessageHistory();
  assert.equal(history.observe(4), "current", "a first revision above zero with nothing cached shows no deletion");
  history.receive([reply("a"), reply("b")]);
  history.move(-1);
  assert.equal(history.observe(4), "current");
  for (const value of [undefined, null, -1, 4.5, "5"])
    assert.equal(history.observe(value), "invalid", `once a revision is known, ${value} is dropped`);
  assert.equal(history.messages.length, 2);
  assert.equal(history.observe(3), "stale", "an older snapshot is rejected");
  assert.equal(history.messages.length, 2);
  const before = history.revision;
  const erasures = history.erasures;
  assert.equal(history.observe(5), "erased");
  assert.equal(history.messages.length, 0);
  assert.equal(history.index, -1, "no reading position survives");
  assert.equal(history.erasures, erasures + 1);
  assert.equal(
    history.canShowSubmission(before),
    false,
    "a submission started before the deletion shows no waiting state",
  );
  assert.equal(history.observe(4), "stale", "a response read before the deletion cannot bring replies back");
  // A capped batch that omits earlier IDs is not a deletion.
  history.receive([reply("c")]);
  assert.equal(history.observe(5), "current");
  history.receive([reply("d")]);
  assert.deepEqual(
    history.messages.map((item) => item.message_id),
    ["c", "d"],
  );
  assert.equal(history.selected?.message_id, "d", "replies after the deletion are followed again");
  history.clear();
  assert.equal(history.conversation, undefined, "a new connection starts a new baseline");
  assert.equal(history.observe(undefined), "current", "before any revision, a relay without the field appends");
  assert.equal(history.observe(1), "current");
});
test("the first revision above zero clears replies cached from a legacy relay and fences submissions; zero does not", () => {
  const legacy = new MessageHistory();
  assert.equal(legacy.observe(undefined), "current");
  legacy.receive([reply("a")]);
  const before = legacy.revision;
  assert.equal(legacy.observe(2), "erased");
  assert.equal(legacy.messages.length, 0);
  assert.equal(legacy.canShowSubmission(before), false);
  const empty = new MessageHistory();
  const started = empty.revision;
  const erasures = empty.erasures;
  assert.equal(empty.observe(1), "current", "nothing was shown, so no deletion is announced");
  assert.equal(
    empty.canShowSubmission(started),
    false,
    "a submission sent to the legacy relay claims no waiting state",
  );
  assert.notEqual(empty.erasures, erasures);
  const zero = new MessageHistory();
  zero.receive([reply("a")]);
  const kept = zero.revision;
  assert.equal(zero.observe(0), "current");
  assert.equal(zero.messages.length, 1, "zero means no deletion has happened");
  assert.equal(zero.canShowSubmission(kept), true);
});
test("a retention cutoff drops only known replies it has expired, never moves back, and keeps unreadable timestamps", () => {
  const history = new MessageHistory();
  const at = (id: string, createdAt: string) => ({ message_id: id, text: id, createdAt });
  history.receive([
    at("old", "2026-09-20T00:00:00.000Z"),
    at("legacy", "not a timestamp"),
    at("edge", "2026-09-24T00:00:00.000Z"),
    at("new", "2026-10-20T00:00:00.000Z"),
  ]);
  history.move(-3);
  assert.equal(history.selected?.message_id, "old");
  assert.equal(history.expire(undefined), false, "a relay without the field prunes nothing");
  assert.equal(history.expire("garbage"), false);
  const revision = history.revision;
  assert.equal(history.expire("2026-09-24T00:00:00.000Z"), true);
  assert.deepEqual(
    history.messages.map((item) => item.message_id),
    ["legacy", "new"],
    "a reply created at the cutoff has expired, as on the relay",
  );
  assert.equal(history.selected?.message_id, "legacy", "an expired reader position moves to the oldest kept reply");
  assert.notEqual(history.revision, revision);
  assert.equal(history.expire("2026-09-01T00:00:00.000Z"), false, "an older cutoff changes nothing");
  history.receive([at("old", "2026-09-20T00:00:00.000Z"), at("late", "2026-10-21T00:00:00.000Z")]);
  assert.deepEqual(
    history.messages.map((item) => item.message_id),
    ["legacy", "new", "late"],
    "an expired reply in a later batch is not brought back",
  );
  history.clear();
  history.receive([at("old", "2026-09-20T00:00:00.000Z")]);
  assert.equal(history.messages.length, 1, "a new connection starts without a cutoff");
});
const staged = (utterance: string, stage: "ack" | "final", createdAt = "2026-10-26T00:00:00Z") => ({
  message_id: `${stage === "ack" ? "ack" : "reply"}_${utterance}`,
  utterance_id: utterance,
  stage,
  text: `${stage} ${utterance}`,
  createdAt,
});
test("a final answer replaces its acknowledgement, which never comes back after it", () => {
  const history = new MessageHistory();
  history.receive([reply("a")]);
  assert.equal(history.receive([staged("u", "ack")]), true);
  assert.equal(history.selected?.message_id, "ack_u");
  assert.equal(history.receive([staged("u", "ack"), staged("u", "final")]), true);
  assert.deepEqual(
    history.messages.map((item) => item.message_id),
    ["a", "reply_u"],
  );
  assert.equal(history.selected?.message_id, "reply_u");
  // A late or replayed acknowledgement is not shown again.
  assert.equal(history.receive([staged("u", "ack")]), false);
  assert.deepEqual(
    history.messages.map((item) => item.message_id),
    ["a", "reply_u"],
  );
});
test("an acknowledgement and its final in one batch show only the final", () => {
  const history = new MessageHistory();
  assert.equal(history.receive([staged("u", "ack"), staged("u", "final")]), true);
  assert.deepEqual(
    history.messages.map((item) => item.message_id),
    ["reply_u"],
  );
  // A final carried without a stage (an older relay) supersedes an acknowledgement too.
  history.receive([staged("v", "ack")]);
  history.receive([{ message_id: "reply_v", utterance_id: "v", text: "legacy", createdAt: "2026-10-26T00:00:01Z" }]);
  assert.deepEqual(
    history.messages.map((item) => item.message_id),
    ["reply_u", "reply_v"],
  );
});
test("a reader on an older reply keeps it while an acknowledgement gives way to its final", () => {
  const history = new MessageHistory();
  history.receive([reply("a"), staged("u", "ack")]);
  history.move(-1);
  assert.equal(history.receive([staged("u", "final")]), false);
  assert.equal(history.selected?.message_id, "a");
  assert.deepEqual(
    history.messages.map((item) => item.message_id),
    ["a", "reply_u"],
  );
});
test("a reader on an acknowledgement behind newer messages moves to its final", () => {
  const history = new MessageHistory();
  history.receive([staged("u", "ack"), reply("b")]);
  history.move(-1);
  assert.equal(history.selected?.message_id, "ack_u");
  assert.equal(history.receive([staged("u", "final")]), true);
  assert.equal(history.selected?.message_id, "reply_u");
  assert.deepEqual(
    history.messages.map((item) => item.message_id),
    ["b", "reply_u"],
  );
});
test("acknowledgements of different utterances are kept apart", () => {
  const history = new MessageHistory();
  history.receive([staged("u", "ack"), staged("v", "ack")]);
  history.receive([staged("v", "final")]);
  assert.deepEqual(
    history.messages.map((item) => item.message_id),
    ["ack_u", "reply_v"],
  );
});
