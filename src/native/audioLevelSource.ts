/**
 * npm install react-native-live-audio-stream base64-js
 *
 * REPLACES an earlier version of this file that used
 * react-native-audio-recorder-player (records AAC/.m4a). That approach
 * couldn't produce the WAV format /classify actually requires without an
 * on-device audio conversion step, and captureChunk had to briefly stop
 * metering to record a separate file. Streaming raw PCM fixes both:
 * metering comes from the same samples being buffered for capture, so
 * there's no gap, and WAV is just those PCM bytes plus a header.
 *
 * How it works: LiveAudioStream emits base64-encoded 16-bit PCM chunks
 * roughly every ~100ms (buffer-size dependent). Each chunk updates a
 * rolling window (keeps the last ~chunkDurationMs worth) and its RMS is
 * used for decibel metering. captureChunk() just reads that rolling
 * window — no new recording needs to start.
 *
 * TEMP DEBUG: two console.log lines added below to diagnose mic input not
 * being picked up at all. Remove both once confirmed working.
 */
import LiveAudioStream from 'react-native-live-audio-stream';
import * as base64js from 'base64-js';
import { AudioLevelSource } from '../services/audioMonitor';
import { encodeWav } from './wav';

const SAMPLE_RATE = 16000; // matches what most audio classification models (e.g. YAMNet) expect
const BITS_PER_SAMPLE = 16;
const CHANNELS = 1;
const ROLLING_WINDOW_MS = 6000; // slightly longer than the 5s chunk so captureChunk always has enough buffered

const streamOptions = {
  sampleRate: SAMPLE_RATE,
  channels: CHANNELS,
  bitsPerSample: BITS_PER_SAMPLE,
  audioSource: 6, // Android: VOICE_RECOGNITION — tuned for speech, less aggressive noise suppression than default
  bufferSize: 4096,
  // Required by the library API; this implementation uses the PCM stream.
  wavFile: 'sakhi-audio.wav',
};

class LiveStreamAudioLevelSource implements AudioLevelSource {
  private rollingBuffer: Uint8Array[] = [];
  private onLevelCallback: ((decibels: number) => void) | null = null;
  private isRunning = false;

  async start(onLevel: (decibels: number) => void): Promise<void> {
    this.isRunning = true;
    this.onLevelCallback = onLevel;
    this.rollingBuffer = [];

    LiveAudioStream.init(streamOptions);
    console.log('[MIC DEBUG] LiveAudioStream initialized, starting...'); // TEMP DEBUG

    LiveAudioStream.on('data', (base64Chunk: string) => {
      if (!this.isRunning) return;
      const bytes = base64js.toByteArray(base64Chunk);
      this.pushToRollingBuffer(bytes);
      const db = computeDecibels(bytes);
      console.log('[MIC DEBUG] chunk received, bytes:', bytes.length, 'db:', db.toFixed(1)); // TEMP DEBUG
      this.onLevelCallback?.(db);
    });

    LiveAudioStream.start();
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    this.onLevelCallback = null;
    LiveAudioStream.stop();
  }

  async captureChunk(durationMs: number): Promise<string> {
    const bytesNeeded = msToByteCount(durationMs);
    const combined = concatBuffers(this.rollingBuffer);
    // Take the most recent `bytesNeeded` bytes — the loud spike that
    // triggered this capture just happened, so recent history is what
    // matters, not audio from the start of the rolling window.
    const pcmSlice = combined.subarray(Math.max(0, combined.length - bytesNeeded));

    const wavBytes = encodeWav(pcmSlice, {
      sampleRate: SAMPLE_RATE,
      numChannels: CHANNELS,
      bitsPerSample: BITS_PER_SAMPLE,
    });

    return base64js.fromByteArray(wavBytes);
  }

  private pushToRollingBuffer(chunk: Uint8Array): void {
    this.rollingBuffer.push(chunk);
    const maxBytes = msToByteCount(ROLLING_WINDOW_MS);
    let total = this.rollingBuffer.reduce((sum, c) => sum + c.length, 0);
    while (total > maxBytes && this.rollingBuffer.length > 1) {
      const removed = this.rollingBuffer.shift();
      total -= removed?.length ?? 0;
    }
  }
}

function msToByteCount(ms: number): number {
  const bytesPerSample = BITS_PER_SAMPLE / 8;
  return Math.round((SAMPLE_RATE * ms) / 1000) * bytesPerSample * CHANNELS;
}

function concatBuffers(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

// RMS of 16-bit signed little-endian PCM -> approximate dBFS, shifted
// positive so it compares intuitively against DEFAULT_AUDIO_MONITOR_CONFIG's
// decibelThreshold ("higher = louder"). Calibrate against real devices —
// the +90 offset is a starting guess, not a measured constant.
function computeDecibels(pcmBytes: Uint8Array): number {
  const sampleCount = pcmBytes.length / 2;
  if (sampleCount === 0) return 0;

  let sumSquares = 0;
  const view = new DataView(pcmBytes.buffer, pcmBytes.byteOffset, pcmBytes.byteLength);
  for (let i = 0; i < sampleCount; i++) {
    const sample = view.getInt16(i * 2, true);
    sumSquares += sample * sample;
  }
  const rms = Math.sqrt(sumSquares / sampleCount);
  if (rms === 0) return 0;

  const dbfs = 20 * Math.log10(rms / 32768);
  return dbfs + 90;
}

export const audioLevelSource: AudioLevelSource = new LiveStreamAudioLevelSource();
