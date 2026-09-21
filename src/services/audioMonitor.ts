/**
 * Background audio monitoring service.
 *
 * Design: this stays low-power by NOT running classification continuously.
 * It sleeps, listens to a cheap volume/decibel metric, and only when that
 * crosses a threshold does it capture a short chunk and hand it off for
 * classification.
 *
 * FIX (post-calibration): the noise floor used to only train on readings
 * below the current threshold. When ambient noise sits close to
 * minAbsoluteDb (as measured: ~54-57dB ambient vs a 55dB floor), that
 * creates a deadlock — ambient readings above threshold never count as
 * "quiet" so the floor never converges to the real baseline, and the
 * threshold stays wrong forever. Floor training is now unconditional
 * (always runs except mid-capture), so it converges to the true ambient
 * average regardless of where the threshold currently sits.
 *
 * TEMP DEBUG: console.log lines trace spike detection + classify results.
 * Remove all lines marked TEMP DEBUG once confirmed working.
 */

export interface AudioLevelSource {
  start(onLevel: (decibels: number) => void): Promise<void>;
  stop(): Promise<void>;
  captureChunk(durationMs: number): Promise<string>;
}

export type AudioClassification = 'SCREAM' | 'CODEWORD' | 'NORMAL';

export interface ClassificationResult {
  classification: AudioClassification;
  confidence: number; // 0..1
}

export type ClassifyAudioChunk = (audioChunkBase64: string) => Promise<ClassificationResult>;

export interface AudioMonitorConfig {
  decibelThreshold: number;
  chunkDurationMs: number;
  cooldownMs: number;
  adaptive: boolean;
  spikeMarginDb: number;
  noiseFloorAlpha: number;
  initialNoiseFloorDb: number;
  /**
   * Safety floor only — a last-resort minimum so the threshold never drops
   * to something absurd (e.g. in a truly silent room). Deliberately set
   * well BELOW measured ambient (54-57dB) now, since the real gating comes
   * from noiseFloorDb + spikeMarginDb, not this constant.
   */
  minAbsoluteDb: number;
}

export const DEFAULT_AUDIO_MONITOR_CONFIG: AudioMonitorConfig = {
  decibelThreshold: 75, // fallback for adaptive: false
  chunkDurationMs: 5000,
  cooldownMs: 8000,
  adaptive: true,
  spikeMarginDb: 12,
  noiseFloorAlpha: 0.03,
  initialNoiseFloorDb: 50,
  minAbsoluteDb: 45,
};

export class AudioMonitorService {
  private source: AudioLevelSource;
  private classify: ClassifyAudioChunk;
  private config: AudioMonitorConfig;

  private isRunning = false;
  private isCapturing = false;
  private lastCaptureAt = 0;
  private noiseFloorDb: number;

  constructor(
    source: AudioLevelSource,
    classify: ClassifyAudioChunk,
    config: AudioMonitorConfig = DEFAULT_AUDIO_MONITOR_CONFIG,
  ) {
    this.source = source;
    this.classify = classify;
    this.config = config;
    this.noiseFloorDb = config.initialNoiseFloorDb;
  }

  async start(onDetected: (result: ClassificationResult) => void): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    await this.source.start((decibels) => {
      this.handleLevel(decibels, onDetected);
    });
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    await this.source.stop();
  }

  getNoiseFloorDb(): number {
    return this.noiseFloorDb;
  }

  private currentThresholdDb(): number {
    if (!this.config.adaptive) return this.config.decibelThreshold;
    return Math.max(this.noiseFloorDb + this.config.spikeMarginDb, this.config.minAbsoluteDb);
  }

  private handleLevel(
    decibels: number,
    onDetected: (result: ClassificationResult) => void,
  ): void {
    if (!this.isRunning) return;

    const threshold = this.currentThresholdDb();
    const isSpike = decibels >= threshold;

    console.log('[SPIKE DEBUG] db:', decibels.toFixed(1), 'threshold:', threshold.toFixed(1), 'floor:', this.noiseFloorDb.toFixed(1), 'isSpike:', isSpike, 'isCapturing:', this.isCapturing); // TEMP DEBUG

    // Train the floor unconditionally (as long as we're not mid-capture) —
    // this is the actual fix. Gating on !isSpike caused a deadlock when
    // ambient noise sits near the threshold.
    if (this.config.adaptive && !this.isCapturing) {
      this.noiseFloorDb =
        this.config.noiseFloorAlpha * decibels + (1 - this.config.noiseFloorAlpha) * this.noiseFloorDb;
    }

    if (this.isCapturing || !isSpike) return;

    const now = Date.now();
    if (now - this.lastCaptureAt < this.config.cooldownMs) return;

    this.lastCaptureAt = now;
    console.log('[SPIKE DEBUG] triggering capture+classify'); // TEMP DEBUG
    void this.captureAndClassify(onDetected);
  }

  private async captureAndClassify(
    onDetected: (result: ClassificationResult) => void,
  ): Promise<void> {
    this.isCapturing = true;
    try {
      const audioBase64 = await this.source.captureChunk(this.config.chunkDurationMs);
      console.log('[SPIKE DEBUG] chunk captured, base64 length:', audioBase64.length); // TEMP DEBUG
      const result = await this.classify(audioBase64);
      console.log('[SPIKE DEBUG] classify result:', JSON.stringify(result)); // TEMP DEBUG
      if (result.classification !== 'NORMAL') {
        onDetected(result);
      }
    } catch (err) {
      console.warn('[AudioMonitorService] capture/classify failed', err);
    } finally {
      this.isCapturing = false;
    }
  }
}