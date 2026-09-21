/**
 * Codeword spotting.
 *
 * Rather than training a custom keyword-spotter in 3 days, this runs
 * continuous on-device speech-to-text and checks each transcript against
 * the user's codeword. Swap SpeechRecognitionSource's implementation for
 * whatever library you land on (e.g. @react-native-voice/voice) — the
 * matching logic below doesn't care.
 */

export interface SpeechRecognitionSource {
  /** Start continuous transcription. Fires onTranscript with each recognized utterance. */
  start(onTranscript: (text: string) => void): Promise<void>;
  stop(): Promise<void>;
  /** True when this recognizer must be the sole owner of the microphone. */
  usesMicrophoneExclusively?: boolean;
}

export interface CodewordSpotterConfig {
  /** Exact phrase the user set as their codeword, e.g. "pineapple express". */
  codeword: string;
  /** Allow the codeword to appear anywhere in a longer sentence, not just alone. */
  matchWithinSentence: boolean;
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/[^\w\s]/g, '');
}

export class CodewordSpotterService {
  private source: SpeechRecognitionSource;
  private config: CodewordSpotterConfig;
  private isRunning = false;

  constructor(source: SpeechRecognitionSource, config: CodewordSpotterConfig) {
    this.source = source;
    this.config = config;
  }

  async start(onCodewordSpoken: () => void): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    await this.source.start((rawTranscript) => {
      if (!this.isRunning) return;
      if (this.matches(rawTranscript)) {
        onCodewordSpoken();
      }
    });
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    await this.source.stop();
  }

  updateCodeword(codeword: string): void {
    this.config = { ...this.config, codeword };
  }

  private matches(transcript: string): boolean {
    const normalizedTranscript = normalize(transcript);
    const normalizedCodeword = normalize(this.config.codeword);

    if (!normalizedCodeword) return false;

    return this.config.matchWithinSentence
      ? normalizedTranscript.includes(normalizedCodeword)
      : normalizedTranscript === normalizedCodeword;
  }

}
