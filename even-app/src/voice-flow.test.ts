import { test } from "node:test";
import assert from "node:assert/strict";
import { completeVoice, draftFor, requestFailure, transcriptField, type Draft } from "./voice-flow.ts";
test("a voice clip automatically submits once without a phone action", async () => {
  const actions: string[] = [];
  await completeVoice({
    transcribe: async () => "  안녕  ",
    current: () => true,
    automatic: () => true,
    review: (text) => {
      actions.push(`review:${text}`);
    },
    send: async (text) => {
      actions.push(`send:${text}`);
    },
  });
  assert.deepEqual(actions, ["review:안녕", "send:안녕"]);
});
test("disconnect during transcription prevents both stale draft and submission", async () => {
  let connected = true;
  let resolve!: (text: string) => void;
  const pending = new Promise<string>((done) => {
    resolve = done;
  });
  const actions: string[] = [];
  const work = completeVoice({
    transcribe: () => pending,
    current: () => connected,
    automatic: () => true,
    review: () => {
      actions.push("review");
    },
    send: async () => {
      actions.push("send");
    },
  });
  connected = false;
  resolve("stale");
  await work;
  assert.deepEqual(actions, []);
});
test("review preference keeps transcript without sending and empty STT cannot submit", async () => {
  const actions: string[] = [];
  const options = {
    transcribe: async () => "hello",
    current: () => true,
    automatic: () => false,
    review: (text: string) => {
      actions.push(text);
    },
    send: async () => {
      actions.push("send");
    },
  };
  await completeVoice(options);
  assert.deepEqual(actions, ["hello"]);
  await assert.rejects(completeVoice({ ...options, automatic: () => true, transcribe: async () => " " }));
  assert.deepEqual(actions, ["hello"]);
});

// Mirrors lib/relay/core.ts submit: a known id replays only for identical text, otherwise 409.
function relay() {
  const stored = new Map<string, string>();
  return (id: string, text: string, receiptLost = false): number => {
    const existing = stored.get(id);
    if (existing === undefined) stored.set(id, text);
    else if (existing !== text) return 409;
    if (receiptLost) throw new Error("network: response lost after the relay stored it");
    return 200;
  };
}

test("after a lost receipt an edited retry gets a new id while an unchanged retry keeps it", () => {
  let n = 0;
  const newId = () => `id-${++n}`;
  const submit = relay();
  let draft: Draft | undefined = { id: "id-voice", text: "회의 3시" };
  // The relay stored the original body but its receipt never reached the phone.
  assert.throws(() => submit(draft!.id, draft!.text, true));

  const unchanged = draftFor(draft, "회의 3시", newId);
  assert.equal(unchanged.id, "id-voice", "an identical resend must stay idempotent");
  assert.equal(submit(unchanged.id, unchanged.text), 200);

  draft = unchanged;
  const edited = draftFor(draft, "회의 4시", newId);
  assert.notEqual(edited.id, "id-voice");
  assert.equal(submit("id-voice", "회의 4시"), 409, "reusing the original id for edited text is rejected");
  assert.equal(submit(edited.id, edited.text), 200);
  assert.equal(draftFor(edited, "회의 4시", newId).id, edited.id);
  assert.equal(draftFor(undefined, "새 메시지", newId).id, "id-2");
});

test("a draft typed while the voice is finalized is kept with automatic sending on and off", async () => {
  for (const automatic of [true, false]) {
    let field = "";
    let finish!: (text: string) => void;
    const sent: string[] = [];
    const done = completeVoice({
      transcribe: () => new Promise<string>((resolve) => (finish = resolve)),
      current: () => true,
      automatic: () => automatic,
      review: (text) => {
        field = transcriptField(field, text, automatic).value;
      },
      send: async (text) => {
        sent.push(text);
      },
    });
    // The user types after the recording started, before Soniox returns the final transcript.
    field = "직접 쓴 질문";
    finish("음성 질문");
    await done;
    if (automatic) {
      assert.deepEqual(sent, ["음성 질문"]);
      assert.equal(field, "직접 쓴 질문");
    } else {
      assert.deepEqual(sent, []);
      assert.equal(field, "직접 쓴 질문\n음성 질문");
    }
  }
});

test("an empty or identical field takes the transcript as the voice draft", () => {
  assert.deepEqual(transcriptField("", "음성", false), { value: "음성", draft: true });
  assert.deepEqual(transcriptField("  ", "음성", true), { value: "음성", draft: true });
  assert.deepEqual(transcriptField("음성", "음성", false), { value: "음성", draft: true });
  assert.deepEqual(transcriptField("메모 ", "음성", false), { value: "메모\n음성", draft: false });
});

test("a failed automatic send keeps both the typed draft and the transcript, without resending", async () => {
  let field = "";
  let finish!: (text: string) => void;
  const sent: string[] = [];
  const done = completeVoice({
    transcribe: () => new Promise<string>((resolve) => (finish = resolve)),
    current: () => true,
    automatic: () => true,
    review: (text) => {
      const next = transcriptField(field, text, true);
      field = next.value;
      return next.draft;
    },
    send: async (text) => {
      sent.push(text);
      throw new Error("서버 요청 실패 (500)");
    },
    keep: (text) => {
      field = transcriptField(field, text, false).value;
    },
  });
  field = "직접 쓴 질문";
  finish("음성 질문");
  await assert.rejects(done, /500/);
  assert.deepEqual(sent, ["음성 질문"]);
  assert.equal(field, "직접 쓴 질문\n음성 질문");
});

test("a transcript already in the field is not appended again when the automatic send fails", async () => {
  let field = "";
  let kept = 0;
  await assert.rejects(
    completeVoice({
      transcribe: async () => "음성 질문",
      current: () => true,
      automatic: () => true,
      review: (text) => {
        const next = transcriptField(field, text, true);
        field = next.value;
        return next.draft;
      },
      send: async () => {
        throw new DOMException("The operation was aborted.", "AbortError");
      },
      keep: () => {
        kept++;
      },
    }),
  );
  assert.equal(kept, 0);
  assert.equal(field, "음성 질문");
});
test("a request without a response is described in Korean and a submission's outcome is left unknown", () => {
  for (const kind of ["timeout", "cancelled", "network"] as const) {
    const poll = requestFailure(kind, false);
    const send = requestFailure(kind, true);
    assert.doesNotMatch(send, /[A-Za-z]/, kind);
    assert.ok(send.startsWith(poll), kind);
    assert.match(send, /저장 여부는 확인되지 않았습니다/, kind);
    assert.doesNotMatch(poll, /저장/, kind);
  }
  assert.match(requestFailure("cancelled", true), /취소/);
  assert.match(requestFailure("network", true), /네트워크/);
});
