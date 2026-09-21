/**
 * npm install react-native-biometrics
 *
 * Picked over expo-local-authentication since this is a bare RN project,
 * not Expo. simplePrompt shows the native Face ID / fingerprint UI and
 * resolves { success: boolean }.
 */
import ReactNativeBiometrics from 'react-native-biometrics';
import { BiometricAuthenticator } from '../services/biometricAuth';

const rnBiometrics = new ReactNativeBiometrics();

class DeviceBiometricAuthenticator implements BiometricAuthenticator {
  async isAvailable(): Promise<boolean> {
    const { available, biometryType } = await rnBiometrics.isSensorAvailable();
    // The library reports no modality as undefined.
    // alone — some devices report available:true with a non-biometric type.
    return available && biometryType !== undefined;
  }

  async authenticate(promptMessage: string): Promise<boolean> {
    try {
      const { success } = await rnBiometrics.simplePrompt({ promptMessage });
      return success;
    } catch (err) {
      // User cancelled, or sensor error mid-prompt — treat both as a failed
      // (not thrown) auth so the alarm UI can offer a retry.
      console.warn('[DeviceBiometricAuthenticator] prompt failed', err);
      return false;
    }
  }
}

export const biometricAuthenticator: BiometricAuthenticator = new DeviceBiometricAuthenticator();
