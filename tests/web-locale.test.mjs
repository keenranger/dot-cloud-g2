import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  AUTONYMS,
  LOCALES,
  detectLocale,
  formatDay,
  langTag,
  parseAcceptLanguage,
  parseLocale,
  resolveLocale,
} from "../lib/locale.ts";
import {
  LANGUAGES,
  detectLanguage,
  AUTONYMS as COMPANION_AUTONYMS,
  langTag as companionLangTag,
} from "../even-app/src/locale.ts";
import "./helpers/ts-resolve.mjs";

// Loaded after the resolver above is registered: the copy imports its siblings without extensions.
const { copy, localePath, policyPath } = await import("../app/i18n/dashboard.ts");
const { ISSUES_URL, REPO_URL } = await import("../app/i18n/product.ts");

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the site offers the same eight languages, names and tags as the companion", () => {
  assert.deepEqual([...LOCALES], [...LANGUAGES]);
  assert.deepEqual(AUTONYMS, COMPANION_AUTONYMS);
  for (const code of LOCALES) assert.equal(langTag(code), companionLangTag(code));
});

test("browser language detection matches the companion for regional, script and unknown tags", () => {
  const cases = [
    [["ko-KR", "en-US"]],
    [["en-US", "ko-KR"]],
    [["de-AT"]],
    [["es-419"]],
    [["fr-CA", "en"]],
    [["it-CH"]],
    [["pt-BR", "ja-JP"]],
    [["zh-TW", "ja"]],
    [["zh-HK"]],
    [["zh-MO", "ko"]],
    [["zh-Hant-TW", "en"]],
    [["zh-Hans-HK"]],
    [["zh-CN"]],
    [["zh"]],
    [["zh_SG"]],
    [["ZH-hans"]],
    [["nl", "sv"]],
    [[]],
    [[""]],
    [["x-klingon", "ja"]],
  ];
  for (const [tags] of cases) assert.equal(detectLocale(tags), detectLanguage(tags), JSON.stringify(tags));
});

test("Accept-Language is ordered by quality, with q=0 and wildcards ignored", () => {
  assert.deepEqual(parseAcceptLanguage("ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7"), ["ko-KR", "ko", "en-US", "en"]);
  assert.deepEqual(parseAcceptLanguage("en;q=0.5, ja;q=0.9, de"), ["de", "ja", "en"]);
  assert.deepEqual(parseAcceptLanguage("fr;q=0, *;q=0.5, it"), ["it"]);
  assert.deepEqual(parseAcceptLanguage("es;q=abc, de;q=1.5, ja"), ["ja"]);
  assert.deepEqual(parseAcceptLanguage(""), []);
  assert.deepEqual(parseAcceptLanguage(null), []);
  // Equal qualities keep the browser's order.
  assert.deepEqual(parseAcceptLanguage("de;q=0.8, fr;q=0.8"), ["de", "fr"]);
});

test("an explicit address wins, then the saved choice, then the browser languages, then English", () => {
  const korean = "ko-KR,ko;q=0.9,en-US;q=0.8";
  assert.equal(resolveLocale({ acceptLanguage: korean }), "ko");
  assert.equal(resolveLocale({ cookie: "ja", acceptLanguage: korean }), "ja");
  assert.equal(resolveLocale({ query: "de", cookie: "ja", acceptLanguage: korean }), "de");
  assert.equal(resolveLocale({ query: ["fr", "de"], cookie: "ja" }), "fr");
  assert.equal(resolveLocale({}), "en");
  assert.equal(resolveLocale({ acceptLanguage: "zh-TW,zh;q=0.1" }), "zh");
  assert.equal(resolveLocale({ acceptLanguage: "zh-TW" }), "en");
  assert.equal(resolveLocale({ acceptLanguage: "pt-BR,es;q=0.5" }), "es");
});

test("only exact language codes count as an address or saved choice; auto and other values fall through", () => {
  for (const bad of ["auto", "KO", "ko-KR", "zh-Hans", "zh-TW", "xx", "", " ko", "en;", undefined, null, []]) {
    assert.equal(parseLocale(bad), undefined, String(bad));
    assert.equal(resolveLocale({ query: bad, cookie: bad, acceptLanguage: "it-IT" }), "it", String(bad));
  }
  for (const code of LOCALES) assert.equal(parseLocale(code), code);
});

test("every language has every piece of site copy, and none is left empty", () => {
  assert.deepEqual(Object.keys(copy).sort(), [...LOCALES].sort());
  const shape = (value) =>
    value && typeof value === "object"
      ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, Array.isArray(v) ? v.length : shape(v)]))
      : typeof value;
  const empty = (value, path) => {
    if (typeof value === "string") assert.ok(value.trim(), `${path} is empty`);
    else if (typeof value === "function") assert.ok(String(value("2", "x", 2, 2, 2)).trim(), `${path}() is empty`);
    else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) empty(v, `${path}.${k}`);
  };
  for (const code of LOCALES) {
    assert.deepEqual(shape(copy[code]), shape(copy.en), code);
    empty(copy[code], code);
    assert.equal(copy[code].languageName, AUTONYMS[code]);
  }
});

test("translated copy is not English left in place", () => {
  const keys = [
    ["page", "signInTitle"],
    ["page", "apply"],
    ["page", "supportGuide"],
    ["dashboard", "keyHelp"],
    ["dashboard", "deleteConfirm"],
    ["dashboard", "speechPrivacy"],
    ["notFound", "title"],
    ["error", "title"],
  ];
  for (const code of LOCALES.filter((c) => c !== "en"))
    for (const [group, key] of keys)
      assert.notEqual(copy[code][group][key], copy.en[group][key], `${code}.${group}.${key}`);
});

test("the relay contract names stay verbatim in every Dot setup message", () => {
  for (const code of LOCALES) {
    const prompt = copy[code].dashboard.dotPrompt("https://relay.example/mcp");
    for (const token of [
      "utterance.created",
      '"g2"',
      "reply_to_g2",
      "acknowledge_g2_utterance",
      "utterance_id",
      "https://relay.example/mcp",
    ])
      assert.ok(prompt.includes(token), `${code} prompt lacks ${token}`);
  }
});

test("the policies' effective day is the same day in every language and time zone", () => {
  const original = process.env.TZ;
  const expected = {
    "en-US": "October 26, 2026",
    "de-DE": "26. Oktober 2026",
    "ko-KR": "2026년 10월 26일",
    "ja-JP": "2026年10月26日",
    "zh-CN": "2026年10月26日",
  };
  try {
    for (const tz of ["UTC", "Pacific/Kiritimati", "America/Adak", "Asia/Seoul"]) {
      process.env.TZ = tz;
      for (const [dateLocale, text] of Object.entries(expected))
        assert.equal(formatDay("2026-10-26", dateLocale), text, tz);
      for (const code of LOCALES) assert.match(formatDay("2026-10-26", copy[code].dateLocale), /26/, `${code} ${tz}`);
    }
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});

test("language-keeping paths carry only the language code", () => {
  for (const code of LOCALES) {
    assert.equal(localePath(code), `/?lang=${code}`);
    assert.equal(policyPath("privacy", code), `/privacy?lang=${code}`);
    assert.equal(policyPath("terms", code), `/terms?lang=${code}`);
  }
});

test("support links are the fixed public repository and issue list, opened safely", () => {
  assert.equal(REPO_URL, "https://github.com/keenranger/dot-cloud-g2");
  assert.equal(ISSUES_URL, "https://github.com/keenranger/dot-cloud-g2/issues");
  const source = read("app/components/support-links.tsx");
  assert.match(source, /target="_blank"/);
  assert.match(source, /rel="noopener noreferrer"/);
  assert.match(source, /referrerPolicy="no-referrer"/);
  // Nothing from the visitor, page or session is put in the destination.
  assert.match(source, /href=\{REPO_URL\}/);
  assert.match(source, /href=\{ISSUES_URL\}/);
  assert.doesNotMatch(source, /href=\{`|\?|encodeURIComponent|searchParams/);
  for (const page of ["app/page.tsx", "app/components/policy-page.tsx", "app/not-found.tsx", "app/error.tsx"])
    assert.match(read(page), /<SupportLinks\b/, `${page} lacks support links`);
});

test("the language form is a labelled native select of the eight languages with an explicit Apply button", () => {
  const source = read("app/components/language-switch.tsx");
  assert.match(source, /<form[^>]*method="get"/);
  assert.match(source, /<select[^>]*name="lang"/);
  assert.match(source, /<label[^>]*htmlFor=/);
  assert.match(source, /type="submit"/);
  assert.match(source, /LOCALES\.map/);
  // A choice is applied only by the button, never on change.
  assert.doesNotMatch(source, /onChange/);
});

// --- Policies -------------------------------------------------------------------------------------------------------

const policyFiles = (name) =>
  Object.fromEntries(LOCALES.filter((c) => c !== "en").map((code) => [code, read(`app/${name}/i18n/${code}.tsx`)]));
const body = (source) => source.slice(source.indexOf("<>"), source.lastIndexOf("</>"));
const structure = (source) => {
  const text = body(source);
  return {
    sections: [...text.matchAll(/aria-labelledby="([^"]+)"/g)].map((m) => m[1]),
    headings: [...text.matchAll(/<h2 id="([^"]+)"/g)].map((m) => m[1]),
    items: (text.match(/<li>|<li\b/g) ?? []).length,
    lists: (text.match(/<ul>/g) ?? []).length,
    paragraphs: (text.match(/<p>/g) ?? []).length,
    mail: (text.match(/mailto:\$\{CONTACT_EMAIL\}/g) ?? []).length,
    relay: (text.match(/\{RELAY_ORIGIN\}/g) ?? []).length,
    links: [...text.matchAll(/<Link href=\{policyPath\("(\w+)"/g)].map((m) => m[1]),
  };
};
// Facts each translation must keep: limits, figures and named systems.
const privacyFacts = [
  "30",
  "100",
  "20,000|20.000|20 000|20000|2万|2만",
  "03:00",
  "SHA-256",
  "AES-256-GCM",
  "stt-rt.soniox.com",
  "Asia/Seoul",
  "UTC",
  "Hey dots",
];
const termsFacts = ["2.2.10", "Hey dots"];

for (const [name, facts] of [
  ["privacy", privacyFacts],
  ["terms", termsFacts],
]) {
  test(`every ${name} translation keeps the English sections, lists, contacts and figures`, () => {
    const english = read(`app/${name}/page.tsx`);
    const reference = structure(
      english.replace(/<Link href="\/(privacy|terms)\?lang=en">/g, '<Link href={policyPath("$1"'),
    );
    assert.ok(reference.sections.length > 0);
    for (const [code, source] of Object.entries(policyFiles(name))) {
      assert.deepEqual(structure(source), reference, `${name} ${code}`);
      // JSX joins wrapped lines with a space, so compare the text as rendered.
      const text = body(source).replace(/\s+/g, " ");
      for (const fact of facts)
        assert.ok(
          fact.split("|").some((f) => text.includes(f)),
          `${name} ${code} lacks ${fact}`,
        );
    }
  });
}

test("the localized policies quote their own language's button labels from the site copy", () => {
  for (const [code, source] of Object.entries(policyFiles("privacy"))) {
    for (const key of ["showKey", "createNewKey", "revokeKey", "revokeAll", "deleteForever"])
      assert.match(source, new RegExp(`\\{d\\.${key}\\}`), `privacy ${code} does not quote ${key}`);
    assert.doesNotMatch(body(source), /lang="ko"/, `privacy ${code} still quotes Korean labels`);
  }
});

test("the canonical English policy text is unchanged", () => {
  const privacy = read("app/privacy/page.tsx");
  const terms = read("app/terms/page.tsx");
  for (const sentence of [
    "Lens MCP for G2 is an independent project published by <strong>keenranger</strong>.",
    "30 days after a message, transcript or reply was created (UTC), the relay no",
    "permanently deletes up to 20,000 records that are past the 30-day cutoff; anything beyond that waits for a",
    'Creating a new key (“<span lang="ko">새 키 만들기</span>”) replaces the old one at once; withdrawing it (“',
    '“<span lang="ko">내 모든 기기 연결 해제</span>” removes the key and disconnects all of your devices.',
    "The relay cannot delete what has already been sent to ChatGPT or Soniox, or what was already shown on your",
  ])
    assert.ok(privacy.includes(sentence), sentence);
  for (const sentence of [
    "G2 glasses and a phone with a compatible Even app (version 2.2.10 or later).",
    "Treat your connection key like a password. Anyone who has it can pair a new device to your account until you",
    "This project is not affiliated with or endorsed by Even Realities, OpenAI or Soniox. Their names are used only",
  ])
    assert.ok(terms.includes(sentence), sentence);
  for (const source of [privacy, terms]) {
    assert.doesNotMatch(source, /prevail|legal advice/i);
    assert.match(source, /<>\n/);
  }
  assert.match(read("app/components/policy-page.tsx"), /EFFECTIVE_DATE = "2026-10-26"/);
  assert.match(read("app/components/policy-page.tsx"), /CONTACT_EMAIL = "kghnkl0103@gmail.com"/);
});

test("no translation adds a prevailing-language clause or legal-advice claim", () => {
  const all = [
    ...Object.values(policyFiles("privacy")),
    ...Object.values(policyFiles("terms")),
    read("app/components/policy-page.tsx"),
    ...readdirSync(new URL("../app/i18n/copy/", import.meta.url)).map((f) => read(`app/i18n/copy/${f}`)),
  ].join("\n");
  assert.doesNotMatch(all, /prevail|maßgeblich|prévaut|prevalece|prevale|以英文|英語版が優先|영문.*우선/i);
});

test("every owned page resolves the visitor's language and keeps it in its links", () => {
  for (const page of ["app/page.tsx", "app/privacy/page.tsx", "app/terms/page.tsx", "app/not-found.tsx"])
    assert.match(read(page), /requestLocale\(/, `${page} does not resolve the language`);
  const frame = read("app/components/policy-page.tsx");
  assert.doesNotMatch(frame, /"\/\?lang=en"/);
  assert.match(frame, /localePath\(locale\)/);
  // The error boundary receives an error but never shows it.
  const error = read("app/error.tsx");
  assert.doesNotMatch(error, /error\.(message|digest|stack)|\{error\}/);
});
