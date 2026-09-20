/**
 * npm install react-native-sound
 *
 * Needs an actual alarm audio file bundled into the native projects —
 * this file can't add the asset itself:
 *   Android: android/app/src/main/res/raw/alarm.mp3 (lowercase, no dashes)
 *   iOS:     add alarm.mp3 to the Xcode project (drag into the project
 *            navigator with "Copy items if needed" checked)
 * Pick something loud and unambiguous — a security-siren-style tone reads
 * more clearly as "emergency" than a generic notification chime.
 */
import Sound from 'react-native-sound';
import { AlarmSound } from '../services/alarmController';

Sound.setCategory('Playback');

const ALARM_FILE = 'alarm.mp3';

class DeviceAlarmSound implements AlarmSound {
  private sound: Sound | null = null;
  private loading: Promise<Sound> | null = null;

  private load(): Promise<Sound> {
    if (this.sound) return Promise.resolve(this.sound);
    if (!this.loading) {
      this.loading = new Promise((resolve, reject) => {
        const loaded = new Sound(ALARM_FILE, Sound.MAIN_BUNDLE, (error) => {
          if (error) {
            this.loading = null;
            reject(error);
            return;
          }
          this.sound = loaded;
          resolve(loaded);
        });
      });
    }
    return this.loading;
  }

  preload(): Promise<Sound> {
    return this.load();
  }

  async playLoop(): Promise<void> {
    const sound = await this.load();
    sound.stop();
    sound.setCurrentTime(0);
    sound.setNumberOfLoops(-1); // loop indefinitely until stop() is called
    sound.play((success) => {
      if (!success) console.warn('[DeviceAlarmSound] playback finished unsuccessfully');
    });
  }

  async stop(): Promise<void> {
    if (!this.sound) return;
    // Keep the decoded sound in memory so a retrigger does not have to load
    // the MP3 again before playback begins.
    this.sound.stop();
  }
}

const deviceAlarmSound = new DeviceAlarmSound();
export const alarmSound: AlarmSound = deviceAlarmSound;

// Start decoding while the app is idle. Alarm playback can then begin
// immediately, rather than waiting for the first alarm-triggered load.
void deviceAlarmSound.preload().catch((err) =>
  console.warn('[DeviceAlarmSound] alarm asset preload failed', err),
);
