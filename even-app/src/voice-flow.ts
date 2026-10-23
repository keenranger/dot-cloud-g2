/**
 * A single recording can submit at most once, and never into a replaced connection. `review` returns whether it put
 * the transcript in the text field; an automatic send of a transcript that is not there hands it to `keep` when the
 * send fails, so the spoken words are not lost. Nothing is resent.
 */
export async function completeVoice(options: {
  transcribe: () => Promise<string>;
  current: () => boolean;
  automatic: () => boolean;
  review: (text: string) => boolean | void;
  send: (text: string) => Promise<void>;
  keep?: (text: string) => void;
}): Promise<void> {
  const text = (await options.transcribe()).trim();
  if (!options.current()) return;
  if (!text) throw new Error("인식된 음성이 없습니다. 다시 말해주세요.");
  const placed = options.review(text);
  if (!options.automatic() || !options.current()) return;
  try {
    await options.send(text);
  } catch (e) {
    if (!placed) options.keep?.(text);
    throw e;
  }
}

/**
 * Where a final transcript goes when the text field may have been edited while the voice was captured or finalized.
 * A draft typed meanwhile is never replaced: with automatic sending the transcript is sent on its own, and for review it
 * is appended after the typed text, which then needs a new utterance id.
 */
export function transcriptField(
  field: string,
  transcript: string,
  automatic: boolean,
): { value: string; draft: boolean } {
  const typed = field.trim();
  if (!typed || typed === transcript) return { value: transcript, draft: true };
  return automatic ? { value: field, draft: false } : { value: `${field.trimEnd()}\n${transcript}`, draft: false };
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

export type RequestFailure = "timeout" | "cancelled" | "network";
/**
 * A relay request that ended without a response, in words the user can act on instead of the transport's own English
 * text such as "The operation was aborted.". A submission may still have reached the relay, so it is never retried.
 */
export function requestFailure(kind: RequestFailure, submission: boolean): string {
  const cause = {
    timeout: "서버가 45초 안에 응답하지 않아 요청을 취소했습니다. 네트워크를 확인하세요.",
    cancelled: "앱이 화면에서 벗어나 서버 요청을 취소했습니다.",
    network: "서버에 연결하지 못했습니다. 네트워크 연결을 확인하세요.",
  }[kind];
  return submission ? `${cause} 서버 저장 여부는 확인되지 않았습니다.` : cause;
}
