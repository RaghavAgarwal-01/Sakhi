import { Vibration } from 'react-native';

/**
 * Vibration is built into RN, but sound needs an asset + a player library
 * (expo-av, react-native-sound, etc.) — kept behind an interface so you can
 * wire whichever one you pick without touching the timing logic below.
 */
export interface AlarmSound {
  playLoop(): Promise<void>;
  stop(): Promise<void>;
}

// Repeats [wait, vibrate] in ms. RN's Vibration.vibrate(pattern, repeat=true)
// loops this pattern until Vibration.cancel() is called.
const VIBRATION_PATTERN = [0, 800, 400];
const ALARM_DURATION_MS = 60_000;
const TICK_INTERVAL_MS = 1000;

export interface AlarmControllerHandle {
  stop(): void;
}

/**
 * Starts continuous vibration + beep. Calls onTick every second with seconds
 * remaining, and onComplete when the 60s window elapses naturally (i.e. it
 * was never cancelled). Returns a handle so the caller can stop it early on
 * successful biometric cancellation.
 */
export function startAlarm(
  sound: AlarmSound,
  onTick: (secondsRemaining: number) => void,
  onComplete: () => void,
): AlarmControllerHandle {
  Vibration.vibrate(VIBRATION_PATTERN, true);
  void sound.playLoop();

  let secondsRemaining = ALARM_DURATION_MS / 1000;
  onTick(secondsRemaining);

  const tickHandle = setInterval(() => {
    secondsRemaining -= 1;
    onTick(Math.max(secondsRemaining, 0));
  }, TICK_INTERVAL_MS);

  const completeHandle = setTimeout(() => {
    cleanup();
    onComplete();
  }, ALARM_DURATION_MS);

  let stopped = false;
  function cleanup(): void {
    if (stopped) return;
    stopped = true;
    clearInterval(tickHandle);
    clearTimeout(completeHandle);
    Vibration.cancel();
    void sound.stop();
  }

  return {
    stop: cleanup,
  };
}
