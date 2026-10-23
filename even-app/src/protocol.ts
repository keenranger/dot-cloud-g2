export function relayOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("HTTPS 서버의 기본 주소만 입력하세요.");
  }
  return url.origin;
}

/** Pairing codes are 64 lowercase hex characters; pasted spaces and keyboard capitalization are tolerated. */
export function pairCode(value: string): string {
  const code = value.replace(/\s+/g, "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(code))
    throw new Error("연결 코드는 서버 대시보드에 표시된 64자리 코드(0-9, a-f) 전체를 붙여 넣으세요.");
  return code;
}

// The SDK documents a 2,000-character `textContainerUpgrade` limit without naming the unit and passes the string
// through unchecked. JavaScript string length (UTF-16 code units) never counts fewer units than characters, so it is
// the bound. A text container with `isEventCapture: 1` scrolls overflowing text natively on G2, so a reply is split
// only when it cannot fit in one update.
export const DISPLAY_LIMIT = 2000;
const CONTINUES = "\n(계속)";
const CONTINUED = "(이어서)\n";
const highSurrogate = (code: number) => code >= 0xd800 && code <= 0xdbff;
/** Split text into the fewest parts that each fit one display update, preferring line, then word breaks. */
export function segments(text: string): string[] {
  const value = text || " ";
  if (value.length <= DISPLAY_LIMIT) return [value];
  const budget = DISPLAY_LIMIT - CONTINUED.length - CONTINUES.length;
  const result: string[] = [];
  let start = 0;
  while (start < value.length) {
    let end = Math.min(value.length, start + budget);
    if (end < value.length) {
      // A surrogate pair stays whole.
      if (highSurrogate(value.charCodeAt(end - 1))) end--;
      // Break after the last newline, else space, in the final quarter rather than mid-word.
      const floor = start + Math.floor((budget * 3) / 4);
      const line = value.lastIndexOf("\n", end - 1);
      const space = value.lastIndexOf(" ", end - 1);
      if (line >= floor) end = line + 1;
      else if (space >= floor) end = space + 1;
    }
    result.push(value.slice(start, end));
    start = end;
  }
  return result;
}
/** The G2 text for one part, marking continuation only when a reply needed more than one update. */
export function segmentContent(parts: readonly string[], index: number): string {
  return `${index > 0 ? CONTINUED : ""}${parts[index]}${index < parts.length - 1 ? CONTINUES : ""}`;
}
/** Where a G2 scroll boundary event leads: the adjacent part of a split reply, else the adjacent message. */
export function boundaryStep(part: number, count: number, delta: number): { part: number } | { message: number } {
  const next = part + delta;
  return next >= 0 && next < count ? { part: next } : { message: delta };
}

export function wav(chunks: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const size = chunks.reduce((n, c) => n + c.length, 0);
  if (!size || size % 2) throw new Error("녹음 데이터가 없거나 형식이 올바르지 않습니다.");
  const out = new Uint8Array(44 + size);
  const view = new DataView(out.buffer);
  const word = (at: number, s: string) =>
    Array.from(s).forEach((c, i) => {
      out[at + i] = c.charCodeAt(0);
    });
  word(0, "RIFF");
  view.setUint32(4, 36 + size, true);
  word(8, "WAVE");
  word(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true);
  view.setUint32(28, 32000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  word(36, "data");
  view.setUint32(40, size, true);
  let offset = 44;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}
