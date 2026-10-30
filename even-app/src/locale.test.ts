import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PAGE_TEXT,
  PLACEHOLDERS,
  edgeText,
  failureText,
  idleText,
  messageText,
  parseLanguage,
  setLanguage,
  splitMarkers,
  sttText,
  t,
  wakeBlocked,
} from "./locale.ts";
import { SonioxTranscriptionError } from "./soniox-transcriber.ts";
import { WAKE_BLOCKED, type WakeBlocker } from "./wake-gate.ts";

const HANGUL = /[ㄱ-ㆎ가-힣]/;
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
/** The text inside the element with `id` in index.html, with inline tags removed and whitespace collapsed. */
function shipped(id: string): string | undefined {
  const match = new RegExp(`<(\\w+)[^>]*\\bid="${id}"[^>]*>([\\s\\S]*?)</\\1`).exec(html);
  return match?.[2]
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

test("only an explicit Korean choice selects Korean", () => {
  assert.equal(parseLanguage("ko"), "ko");
  for (const raw of ["", "en", "ko-KR", "KO", null, undefined, "{}"]) assert.equal(parseLanguage(raw), "en");
});

test("index.html ships the English page text, and every Korean entry is Korean", () => {
  assert.match(html, /<html lang="en">/);
  for (const [id, [en, ko]] of Object.entries({ ...PAGE_TEXT, ...PLACEHOLDERS })) {
    assert.equal(shipped(id), en, id);
    assert.ok(!HANGUL.test(en), `${id} English`);
    assert.ok(HANGUL.test(ko) || /^[\x20-\x7e]+$/.test(ko), `${id} Korean`);
  }
});

test("external links name their destination and open safely", () => {
  for (const id of ["dashboard-link", "soniox-console-link"]) {
    const tag = new RegExp(`<a[^>]*id="${id}"[^>]*>`).exec(html)?.[0] ?? "";
    assert.match(tag, /target="_blank"/, id);
    assert.match(tag, /rel="noopener noreferrer"/, id);
  }
  assert.match(html, /href="https:\/\/console\.soniox\.com\/"/);
  assert.match(shipped("soniox-console-link") ?? "", /opens the Soniox Console in your browser/);
});

test("every runtime message has English and Korean forms", () => {
  try {
    const states = [false, true].flatMap((restored) =>
      [false, true].flatMap((connected) => [false, true].map((transcriber) => ({ restored, connected, transcriber }))),
    );
    const kinds = [
      "credential",
      "provider",
      "timeout",
      "connection",
      "invalid-audio",
      "no-audio",
      "protocol",
      "aborted",
      "overflow",
    ] as const;
    const messages = () => [
      ...(Object.keys(WAKE_BLOCKED) as WakeBlocker[]).map(wakeBlocked),
      ...(["timeout", "cancelled", "network"] as const).flatMap((kind) => [
        failureText(kind, false),
        failureText(kind, true),
      ]),
      ...kinds.flatMap((kind) =>
        [undefined, 401, 500].map((code) => sttText(new SonioxTranscriptionError(kind, code))),
      ),
      ...states.map(idleText),
      edgeText(0, 1),
      edgeText(2, -1),
      edgeText(2, 1),
      splitMarkers().continues,
      splitMarkers().continued,
      t("en", "한"),
    ];
    setLanguage("en");
    for (const text of messages()) assert.ok(text && !HANGUL.test(text), text);
    setLanguage("ko");
    for (const text of messages()) assert.ok(HANGUL.test(text), text);
  } finally {
    setLanguage("en");
  }
});

test("each translated helper error is still thrown by its module", () => {
  const sources = ["protocol.ts", "voice-flow.ts", "soniox-key.ts", "audio.ts"]
    .map((file) => readFileSync(new URL(file, import.meta.url), "utf8"))
    .join("\n");
  const thrown = [...sources.matchAll(/new Error\("([^"]*[가-힣][^"]*)"\)/g)].map((m) => m[1]);
  assert.ok(thrown.length >= 5);
  for (const text of thrown) {
    const english = messageText(text);
    assert.notEqual(english, text, `${text} has an English form`);
    assert.ok(!HANGUL.test(english), english);
  }
  setLanguage("ko");
  try {
    assert.equal(messageText(thrown[0]), thrown[0]);
  } finally {
    setLanguage("en");
  }
});
