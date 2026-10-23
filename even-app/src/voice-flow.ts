/** A single recording can submit at most once, and never into a replaced connection. */
export async function completeVoice(options: {
  transcribe: () => Promise<string>;
  current: () => boolean;
  automatic: () => boolean;
  review: (text: string) => void;
  send: (text: string) => Promise<void>;
}): Promise<void> {
  const text = (await options.transcribe()).trim();
  if (!options.current()) return;
  if (!text) throw new Error("인식된 음성이 없습니다. 다시 말해주세요.");
  options.review(text);
  if (options.automatic() && options.current()) await options.send(text);
}
