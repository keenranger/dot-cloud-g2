import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  AUTONYMS,
  LANGUAGES,
  SPLIT_MARKERS,
  detectLanguage,
  edgeText,
  failureText,
  idleText,
  langTag,
  messageText,
  msg,
  parseLanguagePreference,
  setLanguage,
  splitMarkers,
  sttText,
  wakeBlocked,
  type Language,
} from "./locale.ts";
import { en } from "./messages/en.ts";
import { segmentContent, segments, DISPLAY_LIMIT } from "./protocol.ts";
import { SonioxTranscriptionError } from "./soniox-transcriber.ts";
import { WAKE_BLOCKED, type WakeBlocker } from "./wake-gate.ts";

const HANGUL = /[ㄱ-ㆎ가-힣]/;
const KANA = /[぀-ヿ]/;
const HAN = /[一-鿿]/;
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
/** The text inside the element with `id` in index.html, with inline tags removed and whitespace collapsed. */
function shipped(id: string): string | undefined {
  const match = new RegExp(`<(\\w+)[^>]*\\bid="${id}"[^>]*>([\\s\\S]*?)</\\1`).exec(html);
  return match?.[2]
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
/** Runs `body` with each language selected, then restores English. */
function each(body: (code: Language) => void): void {
  try {
    for (const code of LANGUAGES) {
      setLanguage(code);
      body(code);
    }
  } finally {
    setLanguage("en");
  }
}
/** Every runtime message the selected language can produce, with sample values for the ones that take any. */
function messages(): [string, string][] {
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
  const m = msg();
  const flat = Object.entries(m).flatMap(([key, value]): [string, string][] => {
    if (typeof value === "string") return [[key, value]];
    // The G2 reply position is the numeric N/M in every language.
    if (typeof value === "function" && !["idle", "edge", "requestFailure", "stt", "replyPosition"].includes(key))
      return [[key, (value as (...args: unknown[]) => string)(1, 2, "")]];
    if (typeof value === "object" && key !== "splitMarkers")
      return Object.entries(value).map(([inner, text]): [string, string] => [`${key}.${inner}`, text as string]);
    return [];
  });
  return [
    ...flat,
    ...(Object.keys(WAKE_BLOCKED) as WakeBlocker[]).map((r): [string, string] => [`wake:${r}`, wakeBlocked(r)]),
    ...(["timeout", "cancelled", "network"] as const).flatMap((kind): [string, string][] => [
      [`failure:${kind}`, failureText(kind, false)],
      [`failure:${kind}:submission`, failureText(kind, true)],
    ]),
    ...kinds.flatMap((kind) =>
      [undefined, 401, 500].map((code): [string, string] => [
        `stt:${kind}:${code}`,
        sttText(new SonioxTranscriptionError(kind, code)),
      ]),
    ),
    ...states.map((s): [string, string] => [`idle:${JSON.stringify(s)}`, idleText(s)]),
    ["edge:0", edgeText(0, 1)],
    ["edge:first", edgeText(2, -1)],
    ["edge:last", edgeText(2, 1)],
    ["markers", splitMarkers().continues + splitMarkers().continued],
  ];
}

test("a saved choice is one of the app's languages; radio-era en and ko stay explicit, a legacy auto is nothing saved", () => {
  for (const code of LANGUAGES) assert.equal(parseLanguagePreference(code), code);
  for (const raw of ["auto", "", "ko-KR", "KO", "pt", "Auto", "{}", null, undefined])
    assert.equal(parseLanguagePreference(raw), undefined);
});

test("the phone's languages pick the first one the app has, by primary subtag, else English", () => {
  const cases: [readonly (string | undefined)[], Language][] = [
    [["de-AT"], "de"],
    [["es-419", "en-US"], "es"],
    [["pt-BR", "fr-CA", "de"], "fr"],
    [["ko_KR"], "ko"],
    [["EN-gb"], "en"],
    [["it-CH"], "it"],
    [["ja-JP"], "ja"],
    [["zh-CN"], "zh"],
    [["zh"], "zh"],
    [["zh-Hans-HK"], "zh"],
    [["nb-NO", "sv-SE"], "en"],
    [[], "en"],
    [[undefined, ""], "en"],
  ];
  for (const [preferred, expected] of cases) assert.equal(detectLanguage(preferred), expected, preferred.join(","));
});

test("Traditional Chinese is not shown in Simplified Chinese; the next preferred language applies", () => {
  for (const tag of ["zh-TW", "zh-HK", "zh-MO", "zh-Hant", "zh-Hant-TW", "zh_TW"])
    assert.equal(detectLanguage([tag, "ja-JP"]), "ja", tag);
  assert.equal(detectLanguage(["zh-Hant"]), "en");
});

test("index.html ships the English page text and a labelled native list of every language in its own name", () => {
  assert.match(html, /<html lang="en">/);
  for (const [id, text] of Object.entries({ ...en.page, ...en.placeholders })) assert.equal(shipped(id), text, id);
  assert.match(html, /<label id="language-label" for="language">/);
  const select = /<select id="language"[^>]*>([\s\S]*?)<\/select>/.exec(html)?.[1] ?? "";
  const options = [...select.matchAll(/<option([^>]*)>([^<]*)<\/option>/g)];
  // Only the app's languages: no automatic option, the page selects the detected language itself.
  assert.equal(options.length, LANGUAGES.length);
  assert.doesNotMatch(select, /auto/i);
  const named = options.map(([, attrs, text]) => ({
    value: /value="([^"]+)"/.exec(attrs)?.[1],
    lang: /lang="([^"]+)"/.exec(attrs)?.[1],
    text,
  }));
  assert.deepEqual(named.map((o) => o.value).sort(), [...LANGUAGES].sort());
  for (const o of named) {
    assert.equal(o.text, AUTONYMS[o.value as Language], o.value);
    assert.equal(o.lang, langTag(o.value as Language), `${o.value} is announced in its own language`);
  }
});

test("every language translates every page text and runtime message", () => {
  setLanguage("en");
  const english = new Map(messages());
  each((code) => {
    for (const [key, text] of messages()) {
      assert.ok(text.trim(), `${code} ${key} is empty`);
      if (code !== "en") assert.notEqual(text, english.get(key), `${code} ${key} is still English`);
      if (code === "ko") assert.ok(HANGUL.test(text), `${code} ${key}: ${text}`);
      else assert.ok(!HANGUL.test(text) || key === "page.language-label", `${code} ${key}: ${text}`);
      if (code === "ja" && !key.startsWith("markers")) assert.ok(KANA.test(text) || HAN.test(text), `${key}: ${text}`);
      if (code === "zh") assert.ok(HAN.test(text) && !KANA.test(text), `${key}: ${text}`);
    }
    // Someone who lands in a language they cannot read still finds the list by its English name.
    if (code !== "en") assert.match(msg().page["language-label"], / · Language$/);
  });
});

test("Korean keeps the modules' own Korean texts", () => {
  setLanguage("ko");
  try {
    for (const reason of Object.keys(WAKE_BLOCKED) as WakeBlocker[])
      assert.equal(wakeBlocked(reason), WAKE_BLOCKED[reason]);
  } finally {
    setLanguage("en");
  }
});

test("a reply split once fits with every language's markers", () => {
  assert.equal(SPLIT_MARKERS.length, LANGUAGES.length);
  const parts = segments("word ".repeat(1200), SPLIT_MARKERS);
  assert.ok(parts.length > 1);
  for (const markers of SPLIT_MARKERS)
    for (let i = 0; i < parts.length; i++)
      assert.ok(segmentContent(parts, i, markers).length <= DISPLAY_LIMIT, JSON.stringify(markers));
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

test("the last section links only to the project's GitHub page and issues, and opens them safely", () => {
  const start = html.indexOf('<section class="group" aria-labelledby="help-title">');
  assert.ok(start > html.indexOf('aria-labelledby="reply-title"'), "help comes after the replies");
  const section = html.slice(start, html.indexOf("</section>", start));
  assert.match(html.slice(start), /^[\s\S]*?<\/section>\s*<\/main>/, "help is the last section");
  assert.match(section, /<h2 id="help-title">/);
  const links = [...section.matchAll(/<a\b([^>]*)>/g)].map(([, attrs]) => ({
    id: /\bid="([^"]+)"/.exec(attrs)?.[1],
    href: /\bhref="([^"]+)"/.exec(attrs)?.[1],
    attrs,
  }));
  // Fixed addresses: nothing about the user, the session or the language is added to them.
  assert.deepEqual(
    links.map(({ id, href }) => [id, href]),
    [
      ["guide-link", "https://github.com/keenranger/dot-cloud-g2"],
      ["help-link", "https://github.com/keenranger/dot-cloud-g2/issues"],
    ],
  );
  for (const { id, attrs } of links) {
    assert.match(attrs, /target="_blank"/, id);
    assert.match(attrs, /rel="noopener noreferrer"/, id);
    assert.match(attrs, /referrerpolicy="no-referrer"/, id);
  }
  assert.match(shipped("guide-link") ?? "", /opens GitHub in your browser/);
  assert.match(shipped("help-link") ?? "", /opens GitHub in your browser/);
  // Each link's name says it opens GitHub, in every language.
  each((code) => {
    for (const id of ["guide-link-note", "help-link-note"] as const)
      assert.match(msg().page[id], /GitHub/, `${code} ${id}`);
  });
});

test("each translated helper error is still thrown by its module", () => {
  const sources = ["protocol.ts", "voice-flow.ts", "soniox-key.ts", "audio.ts"]
    .map((file) => readFileSync(new URL(file, import.meta.url), "utf8"))
    .join("\n");
  const thrown = [...sources.matchAll(/new Error\("([^"]*[가-힣][^"]*)"\)/g)].map((m) => m[1]);
  assert.ok(thrown.length >= 5);
  each((code) => {
    for (const text of thrown) {
      const shown = messageText(text);
      if (code === "ko") assert.equal(shown, text);
      else {
        assert.notEqual(shown, text, `${code}: ${text} has a translation`);
        assert.ok(!HANGUL.test(shown), shown);
      }
    }
    assert.equal(messageText("Some other error"), "Some other error");
  });
});

test("the manifest declares exactly the translated languages, all of them codes Even Hub accepts", () => {
  const manifest = readFileSync(new URL("../scripts/manifest.mjs", import.meta.url), "utf8");
  const declared = JSON.parse(/supported_languages: (\[[^\]]*\])/.exec(manifest)?.[1] ?? "[]");
  assert.deepEqual(declared, [...LANGUAGES]);
  // https://hub.evenrealities.com/docs/ship/packaging lists the valid values.
  for (const code of declared) assert.ok(["en", "de", "fr", "es", "it", "zh", "ja", "ko"].includes(code), code);
});

// The G2 header is one line of a 560px container whose scrollbar and padding take the right edge. On the official
// simulator's framebuffer Hangul, Han and kana advance 17-21px, Latin letters and digits 9-11px, and a space or the
// middle dot about 6px, so the estimate counts the most of each and a character count cannot say what fits.
const WIDE = /[\p{sc=Hangul}\p{sc=Han}\u3000-\u30ff\uff01-\uff60\uffe0-\uffe6]/u;
const g2Width = (text: string) =>
  Array.from(text).reduce((width, char) => width + (WIDE.test(char) ? 21 : char === " " || char === "·" ? 6 : 11), 0);
const G2_HEADER = 548;

test("the G2 header estimate never counts less than a line measured on the simulator's framebuffer", () => {
  // Ink width of whole lines in the official simulator 0.9.5's original RGBA framebuffer.
  const measured: [string, number][] = [
    ["Antwort 3/3 · Hey dots · Soniox-Schlüssel am Telefon eingeben", 548],
    ["Antwort 1/3 · Das ist die erste Antwort · Mikrofon aus", 455],
    ["Réponse 1/3 · C'est la première réponse · Micro coupé", 456],
    ["Antwort 1/3 · Zwischenantwort · Mikrofon aus", 388],
    ["Straße · Español · Italiano.", 217],
    ["답변 3/3 · Hey dots 사용 불가 · Soniox 키가 없어 마이크를 열지", 517],
    ["안녕하세요. 日本語の返信。简体中文回复。Café déjà vu ·", 493],
  ];
  for (const [line, ink] of measured) assert.ok(g2Width(line) >= ink, `${line}: ${g2Width(line)} < ${ink}`);
});

test("every G2 microphone label fits the header after the longest reply position", () => {
  each((code) => {
    const position = msg().replyPosition(100, 100);
    for (const label of [...Object.values(msg().g2Mic), ...Object.values(msg().wakeBlocked)])
      assert.ok(Array.from(label).length <= 48, `${code} ${label}`);
    // A Hey dots reason is also the phone's text; where it does not fit, the header gives way to the bare state.
    for (const label of Object.values(msg().g2Mic))
      assert.ok(g2Width(`${position} · ${label}`) <= G2_HEADER, `${code} ${label}`);
  });
});
test("a G2 gesture note or a reply stage always fits beside the reply position and the bare microphone state", () => {
  each((code) => {
    const position = msg().replyPosition(100, 100);
    const notes = [msg().edge(0, 1), msg().edge(100, -1), msg().edge(100, 1), msg().exitFailed];
    for (const core of Object.values(msg().g2MicCore))
      for (const part of [...notes, msg().ackLabel, msg().finalLabel])
        assert.ok(g2Width(`${position} · ${part} · ${core}`) <= G2_HEADER, `${code} ${part} · ${core}`);
  });
});
