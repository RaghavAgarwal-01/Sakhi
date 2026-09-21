/**
 * Keeps the app process alive in the background so audioMonitor/codewordSpotter
 * (already running via useSakhiRuntime) don't get killed when the screen locks
 * or the user switches apps.
 *
 * Uses react-native-background-actions: on Android it promotes the app to a
 * foreground service with a persistent notification (required — Android 9+
 * blocks mic access for background apps with no foreground service at all).
 * On iOS it's best-effort only; the real requirement there is native config
 * this file cannot provide — see the NOT DONE list below.
 *
 *   npm install react-native-background-actions
 *
 * NOT DONE — requires editing native project files directly, not JS:
 *   iOS:     ios/Sakhi/Info.plist needs
 *              <key>UIBackgroundModes</key>
 *              <array><string>audio</string></array>
 *            This is what actually keeps iOS from suspending the app —
 *            react-native-background-actions alone won't do it on iOS.
 *            (Using the "audio" background mode for a safety app rather than
 *            actual playback may draw App Store review scrutiny — flag this
 *            to whoever owns the iOS build/submission.)
 *   Android: android/app/src/main/AndroidManifest.xml needs the
 *            FOREGROUND_SERVICE and FOREGROUND_SERVICE_MICROPHONE permissions
 *            (the latter is required on Android 14+/API 34) alongside
 *            RECORD_AUDIO and ACCESS_FINE_LOCATION.
 */

import BackgroundService from 'react-native-background-actions';

const KEEP_ALIVE_TICK_MS = 5000;

const backgroundOptions = {
  taskName: 'SakhiGuardian',
  taskTitle: 'Sakhi is listening',
  taskDesc: 'Monitoring for your safety in the background',
  taskIcon: { name: 'ic_launcher', type: 'mipmap' },
  color: '#B00020',
  linkingURI: 'sakhi://alarm', // deep link back into the app if the user taps the notification
  parameters: { delay: KEEP_ALIVE_TICK_MS },
};

// This task does nothing but stay alive — it exists only to hold the
// foreground service notification open. The actual monitoring logic lives
// in useSakhiRuntime and keeps running on the same JS thread as long as the
// process itself isn't killed.
async function keepAliveTask(taskData?: { delay: number }): Promise<void> {
  const delay = taskData?.delay ?? KEEP_ALIVE_TICK_MS;
  await new Promise<void>((resolve) => {
    const loop = async () => {
      while (BackgroundService.isRunning()) {
        await new Promise<void>((resolve) => setTimeout(resolve, delay));
      }
      resolve();
    };
    void loop();
  });
}

export async function startSakhiBackgroundService(): Promise<void> {
  if (BackgroundService.isRunning()) return;
  await BackgroundService.start(keepAliveTask, backgroundOptions);
}

export async function stopSakhiBackgroundService(): Promise<void> {
  if (!BackgroundService.isRunning()) return;
  await BackgroundService.stop();
}
