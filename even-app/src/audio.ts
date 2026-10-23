export const SAMPLE_RATE = 16_000;
export const MAX_RECORDING_SECONDS = 30;

// Even Hub supplies mono signed 16-bit little-endian PCM at 16 kHz.
export class PcmRecording {
  private chunks: Uint8Array[] = [];
  byteLength = 0;
  readonly maxBytes: number;

  constructor(seconds = MAX_RECORDING_SECONDS) {
    if (!Number.isFinite(seconds) || seconds <= 0) throw new Error("Invalid duration");
    this.maxBytes = Math.floor(seconds * SAMPLE_RATE) * 2;
  }

  append(frame: Uint8Array): boolean {
    if (frame.byteLength % 2) throw new Error("PCM frame must contain complete 16-bit samples");
    const available = this.maxBytes - this.byteLength;
    const size = Math.min(available, frame.byteLength);
    if (size > 0) {
      this.chunks.push(frame.slice(0, size)); // The SDK may reuse its input buffer.
      this.byteLength += size;
    }
    return this.byteLength < this.maxBytes;
  }

  get duration(): number {
    return this.byteLength / (SAMPLE_RATE * 2);
  }

  clear(): void {
    this.chunks = [];
    this.byteLength = 0;
  }

  toWav(): Uint8Array {
    const result = new Uint8Array(44 + this.byteLength);
    const view = new DataView(result.buffer);
    const label = (offset: number, value: string) => {
      for (let i = 0; i < value.length; i++) result[offset + i] = value.charCodeAt(i);
    };
    label(0, "RIFF");
    view.setUint32(4, 36 + this.byteLength, true);
    label(8, "WAVE");
    label(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, SAMPLE_RATE, true);
    view.setUint32(28, SAMPLE_RATE * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    label(36, "data");
    view.setUint32(40, this.byteLength, true);
    let offset = 44;
    for (const chunk of this.chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }
}

/**
 * Returns the PCM payload of a mono PCM16 16 kHz WAV by walking its RIFF chunks rather than assuming a
 * 44-byte header. Anything else is rejected so only the expected format reaches the transcriber.
 */
export function wavPcm(wav: Uint8Array): Uint8Array {
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const label = (offset: number) => String.fromCharCode(...wav.subarray(offset, offset + 4));
  const invalid = () => new Error("녹음 데이터 형식이 올바르지 않습니다.");
  if (wav.byteLength < 12 || label(0) !== "RIFF" || label(8) !== "WAVE") throw invalid();
  let format = false;
  for (let offset = 12; offset + 8 <= wav.byteLength; ) {
    const id = label(offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (body + size > wav.byteLength) throw invalid();
    if (id === "fmt ") {
      if (
        size < 16 ||
        view.getUint16(body, true) !== 1 ||
        view.getUint16(body + 2, true) !== 1 ||
        view.getUint32(body + 4, true) !== SAMPLE_RATE ||
        view.getUint16(body + 12, true) !== 2 ||
        view.getUint16(body + 14, true) !== 16
      )
        throw invalid();
      format = true;
    } else if (id === "data") {
      if (!format || size === 0 || size % 2) throw invalid();
      return wav.subarray(body, body + size);
    }
    offset = body + size + (size % 2); // Chunks are word aligned.
  }
  throw invalid();
}
