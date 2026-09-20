import { useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';

import { AudioMonitorService, DEFAULT_AUDIO_MONITOR_CONFIG, AudioLevelSource } from '../services/audioMonitor';
import { CodewordSpotterService, SpeechRecognitionSource } from '../services/codewordSpotter';
import { IncidentManager, IncidentManagerState } from '../services/incidentManager';
import { BiometricAuthenticator } from '../services/biometricAuth';
import { LocationProvider } from '../services/location';
import { getClassifier } from '../config/inference';
import { updateIncidentLocation } from '../api/incidents';
import { InferencePreference, TriggerType } from '../types/api';
import { DEMO_LOCATION_MODE } from '../config/env';

const LOCATION_STREAM_INTERVAL_MS = 5000;

export interface SakhiRuntimeDeps {
  userId: string;
  codeword: string;
  inferencePreference: InferencePreference;
  audioLevelSource: AudioLevelSource;
  speechRecognitionSource: SpeechRecognitionSource;
  biometricAuthenticator: BiometricAuthenticator;
  locationProvider: LocationProvider;
}

export interface SakhiRuntime {
  incidentManager: IncidentManager;
  incidentState: IncidentManagerState;
  permissionsGranted: boolean;
  permissionError: string | null;
}

/**
 * Requests mic/location permissions once, then wires:
 *   audioMonitor.onScreamDetected  -\
 *                                     -> incidentManager.triggerAlarm()
 *   codewordSpotter.onCodewordSpoken -/
 *
 *   incidentManager ACTIVE -> starts streaming location every 5s
 *   incidentManager back to IDLE -> stops streaming
 *
 * Mount this once near the app root (or inside the foreground/background
 * task when that's wired up) — it owns the full lifecycle so screens just
 * read `incidentState` and call `incidentManager.attemptCancellation()`.
 */
export function useSakhiRuntime(deps: SakhiRuntimeDeps): SakhiRuntime {
  const [incidentState, setIncidentState] = useState<IncidentManagerState>({ status: 'IDLE' });
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const incidentManagerRef = useRef<IncidentManager>(
    new IncidentManager(
      deps.userId,
      () => deps.locationProvider.getCurrentLocation(),
      deps.biometricAuthenticator,
    ),
  );
  const audioMonitorRef = useRef<AudioMonitorService | null>(null);
  const codewordSpotterRef = useRef<CodewordSpotterService | null>(null);
  const stopLocationStreamRef = useRef<(() => void) | null>(null);

  // 1. Request permissions once, then start the two always-on listeners.
  useEffect(() => {
    let cancelled = false;

    async function setup() {
      const granted = await requestRequiredPermissions();
      if (cancelled) return;

      if (!granted) {
        setPermissionError(DEMO_LOCATION_MODE
          ? 'Microphone permission is required for Sakhi to work.'
          : 'Microphone and location permissions are required for Sakhi to work.');
        return;
      }
      setPermissionsGranted(true);

      const incidentManager = incidentManagerRef.current;

      // Android's system recognizer and LiveAudioStream both capture the
      // microphone. Prioritize codeword recognition so the two do not cause
      // recognizer-busy or silent-audio failures on physical devices.
      if (deps.speechRecognitionSource.usesMicrophoneExclusively) {
        codewordSpotterRef.current = new CodewordSpotterService(deps.speechRecognitionSource, {
          codeword: deps.codeword,
          matchWithinSentence: true,
        });
        await codewordSpotterRef.current.start(() => {
          void incidentManager.triggerAlarm('CODEWORD');
        });
        console.log('[useSakhiRuntime] Codeword recognition is active; audio spike monitoring is paused.');
        return;
      }

      audioMonitorRef.current = new AudioMonitorService(
        deps.audioLevelSource,
        getClassifier(deps.inferencePreference, deps.userId),
        DEFAULT_AUDIO_MONITOR_CONFIG,
      );
      await audioMonitorRef.current.start((result) => {
        // The cloud classifier can independently catch a spoken codeword
        // (acoustically, not via speech-to-text) — a useful redundancy
        // against the codewordSpotter's own recognition gaps, so both
        // paths route through the same triggerAlarm call.
        const triggerType: TriggerType = result.classification === 'CODEWORD' ? 'CODEWORD' : 'SCREAM_DETECTED';
        void incidentManager.triggerAlarm(triggerType);
      });

      codewordSpotterRef.current = new CodewordSpotterService(deps.speechRecognitionSource, {
        codeword: deps.codeword,
        matchWithinSentence: true,
      });
      await codewordSpotterRef.current.start(() => {
        void incidentManager.triggerAlarm('CODEWORD');
      });
    }

    void setup().catch((err) => {
      console.warn('[useSakhiRuntime] listener setup failed', err);
      if (!cancelled) {
        setPermissionError('Unable to start codeword listening. Reinstall the Android app and check microphone permission.');
      }
    });

    return () => {
      cancelled = true;
      void audioMonitorRef.current?.stop();
      void codewordSpotterRef.current?.stop();
      stopLocationStreamRef.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Subscribe to incident state, stream location while ACTIVE/CANCELLING.
  useEffect(() => {
    const incidentManager = incidentManagerRef.current;

    const unsubscribe = incidentManager.onStateChange((state) => {
      setIncidentState(state);

      const shouldStream = state.status === 'ACTIVE' || state.status === 'CANCELLING';

      if (shouldStream && state.backendReady && !stopLocationStreamRef.current) {
        const incidentId = state.incidentId;
        stopLocationStreamRef.current = deps.locationProvider.watchLocation((location) => {
          void updateIncidentLocation(incidentId, location).catch((err) =>
            console.warn('[useSakhiRuntime] location update failed', err),
          );
        }, LOCATION_STREAM_INTERVAL_MS);
      }

      if (!shouldStream && stopLocationStreamRef.current) {
        stopLocationStreamRef.current();
        stopLocationStreamRef.current = null;
      }
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    incidentManager: incidentManagerRef.current,
    incidentState,
    permissionsGranted,
    permissionError,
  };
}

async function requestRequiredPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    // iOS permission prompts (mic via Info.plist + AVAudioSession, location
    // via CoreLocation) happen through the native libraries themselves when
    // first used — nothing to request imperatively here.
    return true;
  }

  const permissions: Array<
    typeof PermissionsAndroid.PERMISSIONS.RECORD_AUDIO |
    typeof PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
  > = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
  if (!DEMO_LOCATION_MODE) {
    permissions.push(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  }
  const results = await PermissionsAndroid.requestMultiple(permissions);

  return Object.values(results).every(
    (result) => result === PermissionsAndroid.RESULTS.GRANTED,
  );
}
