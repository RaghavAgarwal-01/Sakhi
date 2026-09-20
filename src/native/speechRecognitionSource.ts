import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { SpeechRecognitionSource } from '../services/codewordSpotter';

type SakhiSpeechRecognitionModule = {
  start(): void;
  stop(): void;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
};

const nativeModule = NativeModules.SakhiSpeechRecognition as SakhiSpeechRecognitionModule | undefined;

/** Android built-in SpeechRecognizer bridge, kept behind the app's source interface. */
class AndroidSpeechRecognitionSource implements SpeechRecognitionSource {
  usesMicrophoneExclusively = true;
  private subscription: { remove(): void } | null = null;
  private errorSubscription: { remove(): void } | null = null;

  async start(onTranscript: (text: string) => void): Promise<void> {
    if (Platform.OS !== 'android') {
      console.warn('[SpeechRecognition] Codeword recognition is currently supported on Android only.');
      return;
    }
    if (!nativeModule) {
      throw new Error('SakhiSpeechRecognition native module is unavailable. Rebuild the Android app.');
    }

    this.subscription?.remove();
    const events = new NativeEventEmitter(nativeModule);
    this.subscription = events.addListener('SakhiSpeechTranscript', ({ text }: { text?: string }) => {
      if (text) {
        console.log('[SpeechRecognition] transcript:', text);
        onTranscript(text);
      }
    });
    this.errorSubscription = events.addListener('SakhiSpeechError', ({ code }: { code?: number }) => {
      console.warn('[SpeechRecognition] Android recognizer error:', code);
    });
    nativeModule.start();
  }

  async stop(): Promise<void> {
    this.subscription?.remove();
    this.subscription = null;
    this.errorSubscription?.remove();
    this.errorSubscription = null;
    nativeModule?.stop();
  }
}

export const speechRecognitionSource: SpeechRecognitionSource = new AndroidSpeechRecognitionSource();
