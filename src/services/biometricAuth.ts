/**
 * Biometric authentication — the ONLY way to cancel the 60s alarm.
 *
 * Wrapped behind an interface so you can plug in expo-local-authentication,
 * react-native-biometrics, or whatever's already in the project, without
 * touching the cancellation flow below.
 */

export interface BiometricAuthenticator {
  /** True if fingerprint/Face ID is enrolled and usable on this device. */
  isAvailable(): Promise<boolean>;
  /** Prompts the OS biometric UI. Resolves true only on a successful match. */
  authenticate(promptMessage: string): Promise<boolean>;
}

export type CancelResult =
  | { success: true }
  | { success: false; reason: 'AUTH_FAILED' | 'AUTH_UNAVAILABLE' | 'API_ERROR' };

/**
 * Runs the cancellation flow: prompt biometrics -> on success, call the
 * provided cancelIncident callback (wired to POST /incidents/:id/cancel)
 * -> on success, tell the caller to stop all local alarm cues. Server
 * cancellation is best-effort: a verified user must never be trapped in a
 * sounding alarm because connectivity is unavailable.
 *
 * This function does NOT stop the alarm itself — that's the caller's job
 * (vibration/sound belong to the alarm UI, not auth). It only tells you
 * whether it's safe to do so.
 */
export async function attemptAlarmCancellation(
  authenticator: BiometricAuthenticator,
  cancelIncident: () => Promise<void>,
): Promise<CancelResult> {
  const available = await authenticator.isAvailable();
  if (!available) {
    // No biometrics enrolled: per spec there is no other cancel path, so
    // this device genuinely cannot cancel the alarm. Surface this clearly
    // in the UI rather than silently failing.
    return { success: false, reason: 'AUTH_UNAVAILABLE' };
  }

  const authenticated = await authenticator.authenticate(
    'Confirm it\'s you to cancel the alarm',
  );
  if (!authenticated) {
    return { success: false, reason: 'AUTH_FAILED' };
  }

  try {
    await cancelIncident();
    return { success: true };
  } catch (err) {
    console.warn('[attemptAlarmCancellation] server cancellation failed; stopping local alarm after biometric verification', err);
    return { success: true };
  }
}
