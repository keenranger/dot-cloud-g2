export function relayOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("HTTPS 서버의 기본 주소만 입력하세요.");
  }
  return url.origin;
}

// Keep each update well below the SDK's 2,000-character upgrade limit.
export function pages(text: string): string[] {
  const chars = Array.from(text || " ");
  const result: string[] = [];
  for (let i = 0; i < chars.length; i += 240) result.push(chars.slice(i, i + 240).join(""));
  return result;
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
