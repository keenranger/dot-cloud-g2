import { RelayError } from "./core";

export const MAX_AUDIO_BYTES = 1_920_044; // At most 60 seconds of 16 kHz mono PCM16 plus WAV header.
export function pcmWav(pcm: Uint8Array) {
  if (!pcm.length || pcm.length % 2 || pcm.length > 1_920_000)
    throw new RelayError(400, "Audio must be 1 to 60 seconds of PCM16 mono at 16000 Hz");
  const wav = new Uint8Array(44 + pcm.length);
  const view = new DataView(wav.buffer);
  const tag = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) wav[offset + i] = value.charCodeAt(i);
  };
  tag(0, "RIFF");
  view.setUint32(4, wav.length - 8, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true);
  view.setUint32(28, 32000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  tag(36, "data");
  view.setUint32(40, pcm.length, true);
  wav.set(pcm, 44);
  return wav;
}
export function validateWav(bytes: Uint8Array) {
  const tag = (offset: number, length: number) => new TextDecoder().decode(bytes.subarray(offset, offset + length));
  if (bytes.length < 44 || tag(0, 4) !== "RIFF" || tag(8, 4) !== "WAVE") throw new RelayError(400, "Invalid WAV audio");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let format = false;
  let dataSize = 0;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const size = view.getUint32(offset + 4, true);
    if (offset + 8 + size > bytes.length) throw new RelayError(400, "Invalid WAV chunk");
    if (tag(offset, 4) === "fmt ") {
      format =
        size >= 16 &&
        view.getUint16(offset + 8, true) === 1 &&
        view.getUint16(offset + 10, true) === 1 &&
        view.getUint32(offset + 12, true) === 16000 &&
        view.getUint16(offset + 22, true) === 16;
    }
    if (tag(offset, 4) === "data") dataSize += size;
    offset += 8 + size + (size % 2);
  }
  if (!format || !dataSize || dataSize % 2 || dataSize > 1_920_000)
    throw new RelayError(400, "Use PCM16 mono WAV at 16000 Hz, at most 60 seconds");
  return bytes;
}
