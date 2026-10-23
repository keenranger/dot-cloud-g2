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

/** The only voice payload sent to the relay: transcribed text and its stable utterance id, never audio or keys. */
export function utteranceBody(id: string, text: string): string {
  return JSON.stringify({ id, text });
}

export interface Draft {
  id: string;
  text: string;
}

/**
 * The relay rejects a reused utterance id with different text, so an id only survives an identical resend.
 * Edited text after an unconfirmed send is a new utterance with a new id.
 */
export function draftFor(draft: Draft | undefined, text: string, newId: () => string): Draft {
  return draft?.text === text ? draft : { id: newId(), text };
}
