import React, { useEffect, useState } from 'react';
import { Text, StyleSheet, SafeAreaView } from 'react-native';

import { useSakhiRuntime } from './src/hooks/useSakhiRuntime';
import { AlarmScreen } from './src/screens/AlarmScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { ProfileSetupScreen } from './src/screens/ProfileSetupScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { loadSession, StoredSession } from './src/native/session';
import { color, type as textType } from './src/theme/tokens';

// TODO (Day 1 leftovers): these all throw until you've picked and wired up
// real libraries for audio streaming, speech recognition, biometrics,
// location, and alarm sound. See src/native/index.ts.
import {
  audioLevelSource,
  speechRecognitionSource,
  biometricAuthenticator,
  locationProvider,
  alarmSound,
} from './src/native';
import { startSakhiBackgroundService, stopSakhiBackgroundService } from './src/native/backgroundService';

export default function App() {
  const [session, setSession] = useState<StoredSession | null | undefined>(undefined); // undefined = still loading
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    void loadSession().then(setSession);
  }, []);

  if (session === undefined) {
    return (
      <SafeAreaView style={styles.center}>
        <Text>Loading…</Text>
      </SafeAreaView>
    );
  }

  if (session === null) {
    return (
      <ProfileSetupScreen
        onComplete={(userId, codeword, inferencePreference, emergencyContactPhone) =>
          setSession({ userId, codeword, inferencePreference, emergencyContactPhone })
        }
      />
    );
  }

  if (showSettings) {
    return (
      <SettingsScreen
        session={session}
        onSaved={(nextSession) => {
          setSession(nextSession);
          setShowSettings(false);
        }}
        onClose={() => setShowSettings(false)}
      />
    );
  }

  return (
    <SakhiApp
      key={`${session.userId}:${session.codeword}`}
      userId={session.userId}
      codeword={session.codeword}
      inferencePreference={session.inferencePreference}
      emergencyContactPhone={session.emergencyContactPhone}
      onOpenSettings={() => setShowSettings(true)}
    />
  );
}

/** Only mounted once a real userId/codeword exist, so useSakhiRuntime never runs with placeholders. */
function SakhiApp({ userId, codeword, inferencePreference, onOpenSettings }: StoredSession & { onOpenSettings(): void }) {
  const { incidentManager, incidentState, permissionsGranted, permissionError } =
    useSakhiRuntime({
      userId,
      codeword,
      // Read from the session ProfileSetupScreen saved — single source of
      // truth, rather than a value guessed independently here too.
      inferencePreference,
      audioLevelSource,
      speechRecognitionSource,
      biometricAuthenticator,
      locationProvider,
    });

  useEffect(() => {
    if (!permissionsGranted) return;
    void startSakhiBackgroundService();
    return () => {
      void stopSakhiBackgroundService();
    };
  }, [permissionsGranted]);

  if (permissionError) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>{permissionError}</Text>
      </SafeAreaView>
    );
  }

  if (!permissionsGranted) {
    return (
      <SafeAreaView style={styles.center}>
        <Text>Setting up Sakhi…</Text>
      </SafeAreaView>
    );
  }

    if (incidentState.status === 'ACTIVE' || incidentState.status === 'CANCELLING') {
    return (
      <AlarmScreen
        incidentManager={incidentManager}
        incidentState={incidentState}
        sound={alarmSound}
      />
    );
  }

  return (
    <HomeScreen
      userId={userId}
      locationProvider={locationProvider}
      onDemoTrigger={() => void incidentManager.triggerAlarm('CODEWORD')}
      onOpenSettings={onOpenSettings}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: color.canvas },
  errorText: { ...textType.body, textAlign: 'center', color: color.alarm },
});
