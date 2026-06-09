/**
 * NativeLocation — Capacitor plugin for cached country-level location.
 *
 * Android: FusedLocationProviderClient.lastLocation (battery-efficient)
 *          + Android Geocoder for reverse geocoding.
 * iOS:     CLLocationManager with kCLLocationAccuracyKilometer
 *          + CLGeocoder for reverse geocoding.
 *
 * Results are cached for 30 minutes. Subsequent calls within the TTL
 * resolve instantly from cache (fromCache: true) with zero GPS radio usage.
 * Falls back to Kampala, Uganda (default location for EAC region).
 */
import { registerPlugin } from '@capacitor/core';

export interface NativeLocationResult {
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
  fromCache: boolean;
}

export interface NativeLocationPlugin {
  getCachedCountry(): Promise<NativeLocationResult>;
  clearCache(): Promise<void>;
}

const NativeLocation = registerPlugin<NativeLocationPlugin>('NativeLocation');
export { NativeLocation };
