import { DISPLAY_LIMIT } from "./protocol.ts";

/** Labels say the running text is unconfirmed: nothing on G2 reads it as the final transcript or a sent message. */
export const CAPTION_LIVE = "실시간 인식 (미확정)";
export const CAPTION_FINISHING = "전사 마무리 중 · 미확정 · 아직 전송 전";
const lowSurrogate = (code: number) => code >= 0xdc00 && code <= 0xdfff;

/**
 * The G2 body for running speech: a one-line label, then the whole text. Only text beyond the one-update limit loses
 * its oldest part, behind a leading ellipsis, so the words being spoken stay visible; a surrogate pair stays whole.
 */
export function captionBody(label: string, text: string): string {
  const head = `${label}\n`;
  if (head.length + text.length <= DISPLAY_LIMIT) return head + text;
  let start = text.length - (DISPLAY_LIMIT - head.length - 1);
  if (lowSurrogate(text.charCodeAt(start))) start++;
  return `${head}…${text.slice(start)}`;
}
