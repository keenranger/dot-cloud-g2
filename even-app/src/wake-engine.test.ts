import test from "node:test";
import assert from "node:assert/strict";
import { WakeEngine, type WakeEvent } from "./wake-engine.ts";
function fixture(detectAt = 50, lastTimestamp = 0.5) {
  let ready = false,
    frames = 0,
    frees = 0,
    end = false,
    speech = false;
  const events: WakeEvent[] = [];
  // Live post-cue audio is kept apart so lifecycle assertions stay about wake/clip; `all` keeps the true order.
  const audio: Uint8Array[] = [];
  const all: WakeEvent[] = [];
  const engine = new WakeEngine(
    {
      createStream: () => ({
        acceptWaveform: () => {
          frames++;
          ready = frames === detectAt;
        },
        free: () => {
          frees++;
        },
      }),
      isReady: () => ready,
      decode: () => {
        ready = false;
      },
      getResult: () => ({ keyword: "HEY_DOT", start_time: 0, timestamps: [0.1, 0.2, 0.4, lastTimestamp] }),
      free: () => {},
    },
    {
      acceptWaveform: () => {},
      isDetected: () => speech,
      isEmpty: () => !end,
      reset: () => {
        end = false;
        speech = false;
      },
      free: () => {},
    },
    (e) => {
      all.push(e);
      if (e.type === "audio") audio.push(e.pcm);
      else events.push(e);
    },
  );
  const feed = (seconds: number, value = 123) => {
    const b = new Uint8Array(640);
    const v = new DataView(b.buffer);
    for (let i = 0; i < 320; i++) v.setInt16(i * 2, value, true);
    for (let i = 0; i < seconds * 50; i++) engine.append(b);
  };
  engine.listen();
  return {
    engine,
    events,
    audio,
    all,
    feed,
    speech: () => {
      speech = true;
    },
    end: () => {
      end = true;
    },
    frees: () => frees,
  };
}

test("wake cue trims earlier audio, preserves decoder-latency speech, and ends on silence", () => {
  const f = fixture();
  f.feed(1);
  assert.deepEqual(f.events, [{ type: "wake" }]);
  assert.equal(f.frees(), 1);
  f.speech();
  f.feed(0.5, 456);
  f.end();
  f.feed(0.04, 0);
  assert.equal(f.events.length, 2);
  const event = f.events[1];
  assert.equal(event.type, "clip");
  if (event.type !== "clip") return;
  assert.ok(event.wav);
  assert.ok(event.seconds >= 0.8 && event.seconds <= 0.84);
  assert.equal(new DataView(event.wav.buffer).getInt16(44, true), 123);
  f.feed(2);
  assert.equal(f.events.length, 2);
  f.engine.dispose();
});

test("wake with no following speech expires without a clip", () => {
  const f = fixture();
  f.feed(8);
  assert.equal(f.events.length, 2);
  assert.equal(f.events[1].type, "clip");
  assert.equal("wav" in f.events[1], false);
  f.engine.dispose();
});

test("held speech ignores the automatic endpoint, discard and max length stay bounded", () => {
  const f = fixture();
  f.feed(1);
  f.engine.hold();
  f.speech();
  f.end();
  f.feed(3);
  assert.equal(f.events.length, 1);
  f.engine.finish(true);
  assert.equal("wav" in f.events[1], false);
  f.engine.dispose();
  const g = fixture();
  g.feed(1);
  g.engine.hold();
  g.feed(35);
  const e = g.events[1];
  assert.equal(e.type, "clip");
  if (e.type === "clip") {
    assert.equal(e.seconds, 30);
    assert.equal(e.wav?.length, 960044);
  }
  g.engine.dispose();
});

test("cancel erases an utterance and rejects malformed frames", () => {
  const f = fixture();
  f.feed(1);
  f.engine.cancel();
  f.feed(2);
  assert.equal(f.events.length, 1);
  assert.throws(() => f.engine.append(new Uint8Array(3)));
  assert.throws(() => f.engine.append(new Uint8Array(32002)));
  f.engine.dispose();
});

test("out-of-window keyword timestamps never copy pre-wake audio into the utterance", () => {
  for (const [frames, last] of [
    [200, 0.5],
    [50, 4],
  ]) {
    const f = fixture(frames, last);
    f.feed(frames / 50, 123);
    f.speech();
    f.feed(0.5, 456);
    f.end();
    f.feed(0.04, 0);
    const event = f.events[1];
    assert.equal(event.type, "clip");
    if (event.type === "clip") {
      assert.ok(event.wav);
      assert.ok(event.seconds < 0.56);
      assert.equal(new DataView(event.wav.buffer).getInt16(44, true), 456);
    }
    f.engine.dispose();
  }
});

const streamed = (audio: Uint8Array[]) => Buffer.concat(audio);

test("live audio starts only after the cue, excludes the cue and pre-wake audio, and equals the clip", () => {
  const f = fixture();
  f.feed(1);
  assert.deepEqual(f.events, [{ type: "wake" }]);
  assert.equal(f.audio.length, 0, "no audio is released before or with the cue");
  f.speech();
  f.feed(0.1, 456);
  assert.ok(f.audio.length > 0, "speech audio is released while the utterance continues");
  assert.equal(f.all.at(-1)?.type, "audio");
  f.feed(0.4, 456);
  f.end();
  f.feed(0.04, 0);
  const clip = f.events.at(-1);
  assert.equal(clip?.type, "clip");
  if (clip?.type !== "clip" || !clip.wav) return;
  const audio = streamed(f.audio);
  assert.deepEqual(audio, Buffer.from(clip.wav.subarray(44)), "streamed bytes are exactly the post-cue clip");
  // Cue ends at 0.7 s of the first second: only the 0.3 s decoder-latency tail precedes the new speech.
  assert.equal(new DataView(audio.buffer, audio.byteOffset).getInt16(0, true), 123);
  assert.equal(new DataView(audio.buffer, audio.byteOffset).getInt16(9600, true), 456);
  assert.ok(f.all.findIndex((e) => e.type === "audio") > f.all.findIndex((e) => e.type === "wake"));
  assert.ok(f.all.findLastIndex((e) => e.type === "audio") < f.all.findIndex((e) => e.type === "clip"));
  f.engine.dispose();
});

test("post-cue audio is withheld until local VAD hears speech; no-speech and cancel release nothing", () => {
  const f = fixture();
  f.feed(1);
  f.feed(2, 7);
  assert.equal(streamed(f.audio).length, 0);
  f.speech();
  f.feed(0.02, 8);
  const audio = streamed(f.audio);
  assert.ok(audio.length > 2 * 32000, "withheld post-cue audio is released in order once speech is seen");
  assert.equal(new DataView(audio.buffer, audio.byteOffset).getInt16(9600, true), 7);
  f.engine.dispose();

  const quiet = fixture();
  quiet.feed(8);
  assert.equal(streamed(quiet.audio).length, 0);
  assert.equal(quiet.events.at(-1)?.type, "clip");
  quiet.engine.dispose();

  const cancelled = fixture();
  cancelled.feed(1);
  cancelled.feed(1, 9);
  cancelled.engine.cancel();
  cancelled.speech();
  cancelled.feed(1, 9);
  assert.equal(streamed(cancelled.audio).length, 0);
  cancelled.engine.dispose();
});

test("held capture streams up to the 30 s clip limit and out-of-window cues stream no pre-wake audio", () => {
  const g = fixture();
  g.feed(1);
  g.engine.hold();
  g.feed(35);
  assert.equal(streamed(g.audio).length, 960000);
  g.engine.dispose();
  const f = fixture(200, 0.5);
  f.feed(4, 123);
  f.speech();
  f.feed(0.5, 456);
  const audio = streamed(f.audio);
  assert.ok(audio.length > 0);
  assert.equal(new DataView(audio.buffer, audio.byteOffset).getInt16(0, true), 456);
  f.engine.dispose();
});
