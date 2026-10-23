import { RelayError } from "@/lib/relay/core";
import { MAX_AUDIO_BYTES, pcmWav, validateWav } from "@/lib/relay/audio";
import { boundedBody, deviceIdentity, failure, json, runtime, deviceCors, deviceOptions } from "@/lib/relay/http";
export async function POST(request: Request) {
  try {
    const { relay, apiKey } = runtime();
    const device = await deviceIdentity(request, relay);
    if (!apiKey) throw new RelayError(503, "Per-user speech transcription credentials are not configured");
    const contentType = request.headers.get("content-type")?.split(";")[0].trim();
    if (contentType !== "audio/wav" && contentType !== "audio/pcm")
      throw new RelayError(415, "Use audio/wav or audio/pcm (PCM16 mono 16000 Hz)");
    await relay.transcriptionAdmission(device);
    const bytes = await boundedBody(request, MAX_AUDIO_BYTES);
    const wav = contentType === "audio/pcm" ? pcmWav(bytes) : validateWav(bytes);
    const form = new FormData();
    form.set("model", "gpt-transcribe");
    form.set("file", new Blob([new Uint8Array(wav)], { type: "audio/wav" }), "speech.wav");
    // Audio is streamed to the provider in-memory only; no DB, R2, or request-body logging.
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new RelayError(502, "Speech provider could not complete transcription");
    }
    const result = JSON.parse(
      new TextDecoder().decode(
        await boundedBody(
          new Request("https://relay.invalid", { method: "POST", body: response.body, duplex: "half" } as RequestInit),
          32_768,
        ),
      ),
    );
    if (typeof result.text !== "string" || result.text.length > 4000)
      throw new RelayError(502, "Speech provider returned an invalid transcript");
    return deviceCors(json({ text: result.text }));
  } catch (error) {
    return deviceCors(failure(error));
  }
}

export const OPTIONS = deviceOptions;
