/**
 * Minimal WAV (RIFF/PCM) encoder — just enough to satisfy the /classify
 * endpoint's audioFormat: "wav" requirement from raw 16-bit mono PCM.
 */

export interface WavEncodeOptions {
  sampleRate: number;
  numChannels: number; // 1 = mono
  bitsPerSample: number; // 16
}

export function encodeWav(pcmBytes: Uint8Array, options: WavEncodeOptions): Uint8Array {
  const { sampleRate, numChannels, bitsPerSample } = options;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmBytes.length;

  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const wavBytes = new Uint8Array(44 + dataSize);
  wavBytes.set(new Uint8Array(header), 0);
  wavBytes.set(pcmBytes, 44);
  return wavBytes;
}

function writeString(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}
