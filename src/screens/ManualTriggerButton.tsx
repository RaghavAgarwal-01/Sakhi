import React, { useState } from 'react';
import { Pressable, Text, StyleSheet, Alert } from 'react-native';
import { createManualIncident } from '../api/incidents';
import { LocationProvider } from '../services/location';
import { color, type, space, radius } from '../theme/tokens';

interface ManualTriggerButtonProps {
  userId: string;
  locationProvider: LocationProvider;
}

/**
 * Deliberately NOT wired to IncidentManager or the alarm flow: no 60s timer,
 * no biometric cancel, nothing to cancel at all. One tap -> alert family with
 * live location -> done. Marigold, not alarm-red, and radius.md rather than
 * a pill — visually a secondary action, never confusable with the alarm's
 * primary cancel button.
 */
export function ManualTriggerButton({ userId, locationProvider }: ManualTriggerButtonProps) {
  const [isSending, setIsSending] = useState(false);

  const handlePress = async () => {
    if (isSending) return;
    setIsSending(true);

    try {
      const currentLocation = await locationProvider.getCurrentLocation();
      await createManualIncident({ userId, currentLocation });
      Alert.alert('Sent', 'Your family has been alerted with your live location.');
    } catch (err) {
      console.warn('[ManualTriggerButton] failed to send manual alert', err);
      Alert.alert('Couldn\'t send', 'Please try again, or use the emergency alarm.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Pressable style={styles.button} onPress={handlePress} disabled={isSending}>
      <Text style={styles.text}>{isSending ? 'Sending…' : 'Alert my family'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: color.marigold,
    paddingVertical: space.md - 2,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    minWidth: 220,
  },
  text: {
    ...type.body,
    color: color.white,
    fontWeight: '600',
  },
});
