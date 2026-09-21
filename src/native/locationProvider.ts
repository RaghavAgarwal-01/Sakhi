/**
 * npm install @react-native-community/geolocation
 *
 * iOS also needs NSLocationWhenInUseUsageDescription (and
 * NSLocationAlwaysAndWhenInUseUsageDescription if location must keep
 * streaming while backgrounded, which it does here during an active
 * incident) added to Info.plist — same native-config caveat as the
 * background service.
 */
import Geolocation from '@react-native-community/geolocation';
import { LocationProvider } from '../services/location';
import { LatLng } from '../types/api';
import { DEMO_LOCATION, DEMO_LOCATION_MODE } from '../config/env';

// High accuracy (GPS chip) can time out or fail entirely indoors without a
// clear sky view — a real risk for an indoor demo, not just an edge case.
// getCurrentLocation() tries it first with a short timeout, then falls back
// to network/wifi-based location (less precise, but works indoors and
// resolves in seconds) rather than failing outright.
const HIGH_ACCURACY_OPTIONS = { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 };
const FALLBACK_OPTIONS = { enableHighAccuracy: false, timeout: 15000, maximumAge: 30000 };

class DeviceLocationProvider implements LocationProvider {
  getCurrentLocation(): Promise<LatLng> {
    if (DEMO_LOCATION_MODE) {
      // Do not even query the device location service in demo mode.
      return Promise.resolve({ ...DEMO_LOCATION });
    }
    return this.getPosition(HIGH_ACCURACY_OPTIONS).catch((err) => {
      console.warn('[DeviceLocationProvider] high-accuracy fix failed, falling back to network location', err);
      return this.getPosition(FALLBACK_OPTIONS);
    });
  }

  private getPosition(options: typeof HIGH_ACCURACY_OPTIONS): Promise<LatLng> {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        (error) => reject(error),
        options,
      );
    });
  }

  watchLocation(onUpdate: (location: LatLng) => void, intervalMs: number): () => void {
    if (DEMO_LOCATION_MODE) {
      // Re-send the fixed coordinate at the normal live-location cadence;
      // no real GPS reading is taken or exposed to the backend.
      onUpdate({ ...DEMO_LOCATION });
      const timer = setInterval(() => onUpdate({ ...DEMO_LOCATION }), intervalMs);
      return () => clearInterval(timer);
    }

    const watchId = Geolocation.watchPosition(
      (position) => {
        onUpdate({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => console.warn('[DeviceLocationProvider] watch error', error),
      { ...HIGH_ACCURACY_OPTIONS, interval: intervalMs, fastestInterval: intervalMs },
    );

    return () => Geolocation.clearWatch(watchId);
  }
}

export const locationProvider: LocationProvider = new DeviceLocationProvider();
