/**
 * useTrackingStore — live GPS tracking session management.
 *
 * Wraps expo-location for real GPS on device.
 * Graceful web fallback: timer works, GPS values show '--'.
 *
 * Distance: Haversine accumulation in meters.
 * Elevation: Sum of positive altitude deltas.
 * Duration: Real elapsed seconds via setInterval.
 */
import { create } from 'zustand';
import { haversineM, calculateElevationGain, generateId } from '../utils/geo';
import { getCurrentRegion } from '../config/regions';
import { useSessionStore } from './useSessionStore';
import type { TrackPoint, ActivityMode } from './useSessionStore';
import type { Coordinate } from '../utils/geo';

// Lazy import expo-location to avoid crash on web
let Location: typeof import('expo-location') | null = null;
let locationSubscription: { remove: () => void } | null = null;
let durationInterval: ReturnType<typeof setInterval> | null = null;

async function getLocation() {
  if (!Location) {
    try {
      Location = await import('expo-location');
    } catch {
      return null;
    }
  }
  return Location;
}

export type TrackingStatus = 'idle' | 'requesting' | 'tracking' | 'paused';

interface TrackingState {
  status: TrackingStatus;
  sessionId: string | null;
  activityMode: ActivityMode;
  startedAt: number | null;
  durationS: number;
  distanceM: number;
  elevationGainM: number;
  trackPoints: TrackPoint[];
  markerIds: string[];         // markers planted during this session
  locationAvailable: boolean;  // false on web/simulator
  lastCoordinate: Coordinate | null;
  altitudeHistory: (number | null)[];

  // Actions
  setActivityMode: (mode: ActivityMode) => void;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
  pauseTracking: () => void;
  resumeTracking: () => void;
  addTrackPoint: (coord: Coordinate) => void;
  linkMarker: (markerId: string) => void;
  reset: () => void;
}

const initialState = {
  status: 'idle' as TrackingStatus,
  sessionId: null,
  activityMode: 'hiking' as ActivityMode,
  startedAt: null,
  durationS: 0,
  distanceM: 0,
  elevationGainM: 0,
  trackPoints: [],
  markerIds: [],
  locationAvailable: false,
  lastCoordinate: null,
  altitudeHistory: [] as (number | null)[],
};

export const useTrackingStore = create<TrackingState>((set, get) => ({
  ...initialState,

  setActivityMode: (mode) => set({ activityMode: mode }),

  startTracking: async () => {
    set({ status: 'requesting', sessionId: generateId(), startedAt: Date.now() });

    // Start real-time duration counter
    durationInterval = setInterval(() => {
      if (get().status === 'tracking') {
        set((s) => ({ durationS: s.durationS + 1 }));
      }
    }, 1000);

    const loc = await getLocation();
    if (!loc) {
      // Web fallback: tracking works with timer only, no GPS
      set({ status: 'tracking', locationAvailable: false });
      return;
    }

    try {
      const { status } = await loc.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        set({ status: 'tracking', locationAvailable: false });
        return;
      }

      set({ status: 'tracking', locationAvailable: true });

      locationSubscription = await loc.watchPositionAsync(
        {
          accuracy: loc.Accuracy.BestForNavigation,
          timeInterval: 3000,       // update every 3s
          distanceInterval: 5,      // or every 5m movement
        },
        (position) => {
          const coord: Coordinate = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            alt: position.coords.altitude,
          };
          get().addTrackPoint(coord);
        },
      );
    } catch {
      // Location failed — continue with timer only
      set({ locationAvailable: false });
    }
  },

  stopTracking: () => {
    // Clean up subscriptions (wrapped — expo-location .remove() throws on web)
    try { locationSubscription?.remove(); } catch { /* web: no-op */ }
    locationSubscription = null;
    if (durationInterval) {
      clearInterval(durationInterval);
      durationInterval = null;
    }

    const s = get();
    if (s.sessionId && s.startedAt) {
      const region = getCurrentRegion();
      useSessionStore.getState().addSession({
        id: s.sessionId,
        activityMode: s.activityMode,
        regionCode: region.code,
        startedAt: s.startedAt,
        endedAt: Date.now(),
        durationS: s.durationS,
        distanceM: s.distanceM,
        elevationGainM: s.elevationGainM,
        trackPoints: s.trackPoints,
        markerIds: s.markerIds,
      });
    }

    set({ ...initialState });
  },

  pauseTracking: () => {
    try { locationSubscription?.remove(); } catch { /* web: no-op */ }
    locationSubscription = null;
    set({ status: 'paused' });
  },

  resumeTracking: async () => {
    // Re-subscribe to location
    const loc = await getLocation();
    if (loc && get().locationAvailable) {
      locationSubscription = await loc.watchPositionAsync(
        { accuracy: loc.Accuracy.BestForNavigation, timeInterval: 3000, distanceInterval: 5 },
        (position) => {
          get().addTrackPoint({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            alt: position.coords.altitude,
          });
        },
      );
    }
    set({ status: 'tracking' });
  },

  addTrackPoint: (coord) => {
    set((s) => {
      const point: TrackPoint = { ...coord, t: Date.now() };
      const newPoints = [...s.trackPoints, point];

      // Accumulate distance
      let addedDistance = 0;
      if (s.lastCoordinate) {
        addedDistance = haversineM(s.lastCoordinate, coord);
        // Ignore implausible jumps > 200m in 3s (GPS glitch)
        if (addedDistance > 200) addedDistance = 0;
      }

      // Accumulate elevation
      const newAltHistory = [...s.altitudeHistory, coord.alt ?? null];
      const elevationGainM = calculateElevationGain(newAltHistory);

      return {
        trackPoints: newPoints,
        lastCoordinate: coord,
        distanceM: s.distanceM + addedDistance,
        elevationGainM,
        altitudeHistory: newAltHistory,
      };
    });
  },

  linkMarker: (markerId) => {
    set((s) => ({ markerIds: [...s.markerIds, markerId] }));
  },

  reset: () => {
    locationSubscription?.remove();
    locationSubscription = null;
    if (durationInterval) {
      clearInterval(durationInterval);
      durationInterval = null;
    }
    set({ ...initialState });
  },
}));
