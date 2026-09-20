import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, Pressable } from 'react-native';
import { ListeningPulse } from './ListeningPulse';
import { ManualTriggerButton } from './ManualTriggerButton';
import { LocationProvider } from '../services/location';
import { color, type, space } from '../theme/tokens';

interface HomeScreenProps {
  userId: string;
  locationProvider: LocationProvider;
  /**
   * DEMO/DEBUG ONLY. Fires the real scream/codeword alarm flow
   * (IncidentManager.triggerAlarm) directly, bypassing mic detection
   * entirely. Wired to a 3s long-press on the wordmark so it's invisible
   * in normal use but gives you a guaranteed way to show the alarm +
   * countdown + biometric-cancel flow live even if the mic/backend
   * classification pipeline is still flaky. Remove before a real (non-demo)
   * release — this is not something an end user should be able to trigger.
   */
  onDemoTrigger?: () => void;
  onOpenSettings?: () => void;
}

export function HomeScreen({ userId, locationProvider, onDemoTrigger, onOpenSettings }: HomeScreenProps) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.top}>
        <Pressable onLongPress={onDemoTrigger} delayLongPress={3000}>
          <Text style={styles.wordmark}>Sakhi</Text>
        </Pressable>
        <Pressable onPress={onOpenSettings} hitSlop={12}>
          <Text style={styles.settings}>⚙ Profile</Text>
        </Pressable>
      </View>

      <View style={styles.hero}>
        <ListeningPulse />
        <Text style={styles.status}>Listening</Text>
        <Text style={styles.subStatus}>Say your codeword any time to trigger the alarm</Text>
      </View>

      <View style={styles.bottom}>
        <ManualTriggerButton userId={userId} locationProvider={locationProvider} />
        <Text style={styles.manualHint}>For a lower-stakes situation — no countdown, no alarm</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: color.canvas,
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: space.xl,
  },
  top: {
    paddingTop: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wordmark: {
    ...type.title,
    color: color.ink,
  },
  settings: {
    ...type.label,
    color: color.white,
    backgroundColor: color.guardian,
    borderRadius: 18,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    overflow: 'hidden',
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: {
    ...type.title,
    color: color.guardian,
    marginTop: space.lg,
  },
  subStatus: {
    ...type.body,
    color: color.ink,
    opacity: 0.6,
    textAlign: 'center',
    marginTop: space.xs,
    maxWidth: 260,
  },
  bottom: {
    alignItems: 'center',
  },
  manualHint: {
    ...type.label,
    color: color.ink,
    opacity: 0.5,
    marginTop: space.sm,
    textAlign: 'center',
  },
});
