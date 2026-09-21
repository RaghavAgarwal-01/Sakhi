import { LatLng } from '../types/api';

/**
 * Wraps whichever geolocation library you pick (@react-native-community/geolocation,
 * expo-location, etc). Kept as an interface so IncidentManager and the location
 * streaming loop don't depend on a specific library.
 */
export interface LocationProvider {
  getCurrentLocation(): Promise<LatLng>;
  /** Streams position updates for an active incident. Returns an unsubscribe function. */
  watchLocation(onUpdate: (location: LatLng) => void, intervalMs: number): () => void;
}

// TODO: implement with the real geolocation library. Left throwing so a
// missing wire-up fails loudly in dev instead of silently sending stale data.
export const unimplementedLocationProvider: LocationProvider = {
  async getCurrentLocation(): Promise<LatLng> {
    throw new Error('LocationProvider.getCurrentLocation not implemented yet');
  },
  watchLocation(): () => void {
    throw new Error('LocationProvider.watchLocation not implemented yet');
  },
};
