import { useState, useEffect, useCallback } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

export interface UserLocation {
  latitude: number;
  longitude: number;
  country: string | null;
  countryCode: string | null;
}

type LocationStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'error';

/** Kampala, Uganda – used when GPS is unavailable */
const DEFAULT_LOCATION: UserLocation = {
  latitude: 0.3476,
  longitude: 32.5825,
  country: 'Uganda',
  countryCode: 'UG',
};

/**
 * Reverse-geocode lat/lng to a country name using the free Nominatim API.
 * Falls back to the browser Intl API timezone heuristic on failure.
 */
async function reverseGeocode(lat: number, lng: number): Promise<{ country: string; countryCode: string } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=3&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    if (!res.ok) throw new Error('Geocode request failed');
    const data = await res.json();
    if (data?.address?.country) {
      return {
        country: data.address.country,
        countryCode: (data.address.country_code || '').toUpperCase(),
      };
    }
  } catch (err) {
    console.warn('Reverse geocoding failed, falling back to timezone heuristic:', err);
  }
  return null;
}

/**
 * Hook that requests location permission and returns the user's current
 * country based on GPS coordinates + reverse geocoding.
 */
export function useGeolocation() {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const requestLocation = useCallback(async () => {
    setStatus('requesting');
    setError(null);

    try {
      // ── Check / request permission ──────────────────────────────────────
      if (Capacitor.isNativePlatform()) {
        let perm = await Geolocation.checkPermissions();
        if (perm.location === 'prompt' || perm.location === 'prompt-with-rationale') {
          perm = await Geolocation.requestPermissions({ permissions: ['location'] });
        }
        if (perm.location === 'denied') {
          setLocation(DEFAULT_LOCATION);
          setStatus('denied');
          setError('Location permission denied');
          return;
        }
      }

      // ── Get position ────────────────────────────────────────────────────
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: false,
        timeout: 10_000,
      });

      const { latitude, longitude } = position.coords;

      // ── Reverse geocode to country ──────────────────────────────────────
      const geo = await reverseGeocode(latitude, longitude);

      const userLoc: UserLocation = {
        latitude,
        longitude,
        country: geo?.country ?? null,
        countryCode: geo?.countryCode ?? null,
      };

      setLocation(userLoc);
      setStatus('granted');
    } catch (err: any) {
      console.error('Geolocation error:', err);
      // Fall back to Kampala, Uganda
      setLocation(DEFAULT_LOCATION);
      if (err?.code === 1 || err?.message?.includes('denied')) {
        setStatus('denied');
        setError('Location permission denied');
      } else {
        setStatus('error');
        setError(err?.message || 'Failed to get location');
      }
    }
  }, []);

  // Auto-request on mount
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  return { location, status, error, requestLocation };
}
