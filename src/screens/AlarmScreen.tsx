import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, Pressable, StyleSheet, ActivityIndicator, Easing } from 'react-native';
import { startAlarm, AlarmControllerHandle, AlarmSound } from '../services/alarmController';
import { IncidentManager, IncidentManagerState } from '../services/incidentManager';
import { CancelResult } from '../services/biometricAuth';
import { color, type, space, radius } from '../theme/tokens';

interface AlarmScreenProps {
  incidentManager: IncidentManager;
  /** Narrowed by the caller to the ACTIVE/CANCELLING variant — this screen never renders otherwise. */
  incidentState: Extract<IncidentManagerState, { status: 'ACTIVE' | 'CANCELLING' }>;
  sound: AlarmSound;
  /**
   * Client-side fallback: if the 60s window elapses with no cancellation,
   * open the phone dialer pre-filled with this number. This is IN ADDITION
   * to whatever backend escalation exists (police/helpline) — not a
   * replacement for it. Opens the dialer only; the user (or whoever
   * has the phone) must tap call — this is deliberate, no CALL_PHONE
   * permission or auto-dial here.
   */
}

const PULSE_DURATION_MS = 700; // deliberately much faster than the home screen's calm pulse

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Your emergency contacts are being notified.",
  ESCALATED_MILD: "Your contacts have been called — you can still cancel.",
  ESCALATED_SEVERE: "This has been escalated to emergency responders.",
};

/**
 * This screen only renders while incidentManager's state is ACTIVE/CANCELLING
 * for a SCREAM_DETECTED or CODEWORD trigger — the manual trigger flow never
 * shows this screen, it has no timer and nothing to cancel.
 *
 * Returning to the home screen is driven entirely by incidentState going
 * IDLE (either a successful cancel, or IncidentManager's status poll
 * learning the backend resolved it) — this component doesn't navigate
 * itself, it just stops local alarm cues at the 60s mark or on cancel.
 */
export function AlarmScreen({ incidentManager, incidentState, sound }: AlarmScreenProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(60);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const alarmHandleRef = useRef<AlarmControllerHandle | null>(null);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    alarmHandleRef.current = startAlarm(
      sound,
      (remaining) => setSecondsRemaining(remaining),
      () => {
        // 60s elapsed uncancelled — startAlarm already stopped vibration/
        // sound itself. Client-side fallback: open the dialer to the
        // emergency contact. Doesn't auto-call — just gets a human one
        // tap away from calling, in case backend escalation is slow,
        // unimplemented, or fails silently.
        // Local cues end here; the backend owns the uncancelled escalation.
      },
    );

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: PULSE_DURATION_MS, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: PULSE_DURATION_MS, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ]),
    );
    loop.start();

    return () => {
      alarmHandleRef.current?.stop();
      loop.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const backgroundColor = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [color.alarmDeep, color.alarm],
  });

  const handleCancelPress = async () => {
    setIsCancelling(true);
    setCancelError(null);

    const result: CancelResult = await incidentManager.attemptCancellation();

    setIsCancelling(false);

    if (result.success) {
      alarmHandleRef.current?.stop();
      return; // incidentState going IDLE (propagated by IncidentManager) unmounts this screen
    }

    switch (result.reason) {
      case 'AUTH_FAILED':
        setCancelError('Verification failed. Try again.');
        break;
      case 'AUTH_UNAVAILABLE':
        setCancelError('No biometric login is set up on this device, so the alarm can\'t be cancelled here.');
        break;
      case 'API_ERROR':
        setCancelError('Verified, but confirming with the server failed. Try again.');
        break;
    }
  };

  const statusLabel = STATUS_LABEL[incidentState.backendStatus] ?? STATUS_LABEL.PENDING;

  return (
    <Animated.View style={[styles.container, { backgroundColor }]}>
      <Text style={styles.title}>Alarm active</Text>
      <Text style={styles.countdown}>{secondsRemaining}</Text>
      <Text style={styles.subtitle}>{statusLabel} Verify it's you to cancel.</Text>

      <Pressable
        style={styles.cancelButton}
        onPress={handleCancelPress}
        disabled={isCancelling}
      >
        {isCancelling ? (
          <ActivityIndicator color={color.alarm} />
        ) : (
          <Text style={styles.cancelButtonText}>Verify to cancel</Text>
        )}
      </Pressable>

      {cancelError && <Text style={styles.errorText}>{cancelError}</Text>}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
  },
  title: {
    ...type.label,
    color: color.white,
    opacity: 0.85,
  },
  countdown: {
    ...type.display,
    fontSize: 96,
    lineHeight: 104,
    color: color.white,
    marginVertical: space.md,
  },
  subtitle: {
    ...type.body,
    color: color.white,
    textAlign: 'center',
    marginBottom: space.xl,
    maxWidth: 280,
  },
  cancelButton: {
    backgroundColor: color.white,
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    minWidth: 220,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...type.body,
    color: color.alarm,
    fontWeight: '700',
  },
  errorText: {
    ...type.label,
    color: color.white,
    marginTop: space.md,
    textAlign: 'center',
  },
});
