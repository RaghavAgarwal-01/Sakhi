import AsyncStorage from '@react-native-async-storage/async-storage';
import { InferencePreference } from '../types/api';

// npm install @react-native-async-storage/async-storage

const KEYS = {
  userId: 'sakhi:userId',
  codeword: 'sakhi:codeword',
  inferencePreference: 'sakhi:inferencePreference',
  emergencyContactPhone: 'sakhi:emergencyContactPhone',
} as const;

export interface StoredSession {
  userId: string;
  codeword: string;
  inferencePreference: InferencePreference;
  /**
   * Kept locally (not just sent to the backend) so the alarm screen can
   * auto-dial this number on-device if the 60s countdown elapses
   * uncancelled — a client-side fallback alongside whatever backend
   * escalation exists.
   */
  emergencyContactPhone: string;
}

export async function loadSession(): Promise<StoredSession | null> {
  const [userId, codeword, inferencePreference, emergencyContactPhone] = await Promise.all([
    AsyncStorage.getItem(KEYS.userId),
    AsyncStorage.getItem(KEYS.codeword),
    AsyncStorage.getItem(KEYS.inferencePreference),
    AsyncStorage.getItem(KEYS.emergencyContactPhone),
  ]);

  if (!userId || !codeword) return null;
  // Fall back to CLOUD for sessions saved before this field existed.
  return {
    userId,
    codeword,
    inferencePreference: (inferencePreference as InferencePreference | null) ?? 'CLOUD',
    emergencyContactPhone: emergencyContactPhone ?? '',
  };
}

export async function saveSession(session: StoredSession): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(KEYS.userId, session.userId),
    AsyncStorage.setItem(KEYS.codeword, session.codeword),
    AsyncStorage.setItem(KEYS.inferencePreference, session.inferencePreference),
    AsyncStorage.setItem(KEYS.emergencyContactPhone, session.emergencyContactPhone),
  ]);
}