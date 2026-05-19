/**
 * useTrackingStore — live GPS tracking session management.
 *
 * Architecture:
 *   - foreground: watchPositionAsync gives instant updates while app is active
 *   - background: startLocationUpdatesAsync + TaskManager keeps tracking on lock screen
 *   - dedupe: timestamps prevent double-counting when both fire at the same time
 *   - dynamic sampling: every 60s checks battery + movement, restarts background task
 *     if interval should change
 *
 * Web fallback: timer works, GPS values show '--'.
 */
import { create } from 'zustand';
import { haversineM, calculateElevationGain, generateId, getSamplingInterval, classifyMovement } from '../utils/geo';
import { getCurrentRegion } from '../config/regions';
import { useSessionStore } from './useSessionStore';
import type { TrackPoint, ActivityMode } from './useSessionStore';
import type { Coordinate } from '../utils/geo';
import { debugLogger } from '../services/debugLogger';
import { batteryMonitor } from '../services/batteryMonitor';
import { networkMonitor } from '../services/networkMonitor';
import { sessionRecorder } from '../services/sessionRecorder';
import { telemetryUploader } from '../services/telemetryUploader';
import {
  BACKGROUND_LOCATION_TASK,
  registerBackgroundTask,
  drainBackgroundLocations,
  persistBackgroundContext,
} from '../services/backgroundLocationTask';

// Lazy import expo-location to avoid crash on web
let Location: typeof import('expo-location') | null = null;
let locationSubscription: { remove: () => void } | null = null;
let durationInterval: ReturnType<typeof setInterval> | null = null;
let drainInterval: ReturnType<typeof setInterval> | null = null;
let dynamicSamplingInterval: ReturnType<typeof setInterval> | null = null;
let lastSamplingIntervalMs = 3000;
let backgroundTaskActive = false;

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
  lastCoordinateTime: number | null;  // unix ms of last GPS fix
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
  lastCoordinateTime: null,
  altitudeHistory: [] as (number | null)[],
};

export const useTrackingStore = create<TrackingState>((set, get) => ({
  ...initialState,

  setActivityMode: (mode) => set({ activityMode: mode }),

  startTracking: async () => {
    set({ status: 'requesting', sessionId: generateId(), startedAt: Date.now() });

    // Reset module-level state from any previous session
    lastSamplingIntervalMs = 3000;

    // Start debug logger session (no-op if disabled)
    const dbgSessionId = debugLogger.startSession({ activity_mode: get().activityMode });
    sessionRecorder.start();

    // Persist context for background TaskManager (survives process kill)
    persistBackgroundContext(dbgSessionId, debugLogger.isEnabled()).catch(() => {});

    // Start battery + network monitors (non-blocking)
    batteryMonitor.start().catch(() => {});
    networkMonitor.start().catch(() => {});

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
      // Foreground permission for normal use
      const fg = await loc.requestForegroundPermissionsAsync();
      if (fg.status !== 'granted') {
        set({ status: 'tracking', locationAvailable: false });
        return;
      }

      // Background permission for lock-screen tracking — best effort, app keeps
      // working even if user denies (just no background updates).
      let backgroundGranted = false;
      try {
        const bg = await loc.requestBackgroundPermissionsAsync();
        backgroundGranted = bg.status === 'granted';
      } catch {
        // Background permission not available on this build (e.g. web, simulator).
      }

      set({ status: 'tracking', locationAvailable: true });

      // ── Foreground subscription (instant updates while app is active) ──
      locationSubscription = await loc.watchPositionAsync(
        {
          accuracy: loc.Accuracy.BestForNavigation,
          timeInterval: lastSamplingIntervalMs,
          distanceInterval: 5,
        },
        (position) => {
          debugLogger.log({
            // Use GPS-fix timestamp when available — gives correct ordering
            // even if the JS event loop delayed the callback.
            ts: position.timestamp || Date.now(),
            event: 'gps_fix',
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            accuracy_m: position.coords.accuracy ?? null,
            altitude_m: position.coords.altitude ?? null,
            altitude_accuracy_m: position.coords.altitudeAccuracy ?? null,
            speed_mps: position.coords.speed ?? null,
            heading_deg: position.coords.heading ?? null,
            raw_or_filtered: 'raw',
            source: 'foreground',
          });

          const coord: Coordinate = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            alt: position.coords.altitude,
            accuracy: position.coords.accuracy ?? null,
          };
          get().addTrackPoint(coord);
        },
        (error) => {
          debugLogger.logError(error, 'watchPositionAsync:foreground');
        },
      );

      // ── Background TaskManager (lock-screen continuity) ──
      if (backgroundGranted) {
        const taskRegistered = await registerBackgroundTask();
        if (taskRegistered) {
          try {
            const already = await loc.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
            if (already) {
              await loc.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
            }
            await loc.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
              accuracy: loc.Accuracy.BestForNavigation,
              timeInterval: lastSamplingIntervalMs,
              distanceInterval: 5,
              showsBackgroundLocationIndicator: true,
              foregroundService: {
                notificationTitle: 'Cairn is tracking',
                notificationBody: 'Recording your route in the background.',
                notificationColor: '#5d7c46',
              },
            });
            backgroundTaskActive = true;
          } catch (err) {
            debugLogger.logError(err, 'startTracking:startBackground');
          }
        }
      }

      // ── Background drain loop (poll task queue every 1s) ──
      drainInterval = setInterval(() => {
        if (get().status !== 'tracking') return;
        const drained = drainBackgroundLocations();
        for (const c of drained) {
          // Dedupe: skip if coords are essentially the same as the last point.
          // Compare lat/lng to ~1e-6 deg ≈ 0.1m. Foreground updates put a fix
          // into the store every few seconds; if background fires the same
          // coords (e.g. iOS replays a stale fix) we drop it.
          const last = get().lastCoordinate;
          if (
            last &&
            Math.abs(c.latitude - last.lat) < 1e-6 &&
            Math.abs(c.longitude - last.lng) < 1e-6
          ) {
            continue;
          }

          get().addTrackPoint({
            lat: c.latitude,
            lng: c.longitude,
            alt: c.altitude,
            accuracy: c.accuracy ?? null,
          });
        }
      }, 1000);

      // ── Dynamic sampling — restart background+foreground if interval should change ──
      dynamicSamplingInterval = setInterval(async () => {
        if (get().status !== 'tracking') return;
        const lastCoord = get().lastCoordinate;
        const speed = lastCoord ? estimateSpeed(get().trackPoints) : 0;
        const movement = classifyMovement(speed);
        const batteryLevel = batteryMonitor.getCurrentLevel();
        const batteryLow = batteryLevel !== null && batteryLevel < 0.2;
        const desiredMs = getSamplingInterval(movement, batteryLow);

        if (Math.abs(desiredMs - lastSamplingIntervalMs) >= 500) {
          lastSamplingIntervalMs = desiredMs;

          // Restart foreground subscription with new interval
          if (locationSubscription && Location) {
            try {
              locationSubscription.remove();
              locationSubscription = await Location.watchPositionAsync(
                {
                  accuracy: Location.Accuracy.BestForNavigation,
                  timeInterval: desiredMs,
                  distanceInterval: 5,
                },
                (position) => {
                  debugLogger.log({
                    ts: position.timestamp || Date.now(),
                    event: 'gps_fix',
                    lat: position.coords.latitude,
                    lon: position.coords.longitude,
                    accuracy_m: position.coords.accuracy ?? null,
                    altitude_m: position.coords.altitude ?? null,
                    altitude_accuracy_m: position.coords.altitudeAccuracy ?? null,
                    speed_mps: position.coords.speed ?? null,
                    heading_deg: position.coords.heading ?? null,
                    raw_or_filtered: 'raw',
                    source: 'foreground',
                  });
                  get().addTrackPoint({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    alt: position.coords.altitude,
                    accuracy: position.coords.accuracy ?? null,
                  });
                },
              );
            } catch (err) {
              debugLogger.logError(err, 'dynamicSampling:fgRestart');
            }
          }

          // Restart background TaskManager
          if (backgroundTaskActive && Location) {
            try {
              await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
              await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
                accuracy: Location.Accuracy.BestForNavigation,
                timeInterval: desiredMs,
                distanceInterval: 5,
                showsBackgroundLocationIndicator: true,
                foregroundService: {
                  notificationTitle: 'Cairn is tracking',
                  notificationBody: 'Recording your route in the background.',
                  notificationColor: '#5d7c46',
                },
              });
            } catch (err) {
              debugLogger.logError(err, 'dynamicSampling:restart');
            }
          }
        }
      }, 60_000);
    } catch (err) {
      debugLogger.logError(err, 'startTracking');
      set({ locationAvailable: false });
    }
  },

  stopTracking: () => {
    // Foreground subscription
    try { locationSubscription?.remove(); } catch { /* web: no-op */ }
    locationSubscription = null;

    // Background task
    if (backgroundTaskActive && Location) {
      Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => {});
      backgroundTaskActive = false;
    }

    if (durationInterval) {
      clearInterval(durationInterval);
      durationInterval = null;
    }
    if (drainInterval) {
      clearInterval(drainInterval);
      drainInterval = null;
    }
    if (dynamicSamplingInterval) {
      clearInterval(dynamicSamplingInterval);
      dynamicSamplingInterval = null;
    }

    // Stop monitors. We do this asynchronously but the order matters:
    // batteryMonitor's final session_end sample must be logged before
    // debugLogger.endSession flushes, otherwise it's lost.
    networkMonitor.stop();
    sessionRecorder.stop();
    // Chain battery stop → debugLogger end → upload
    batteryMonitor.stop()
      .catch(() => {})
      .finally(() => {
        debugLogger.endSession().then((endedId) => {
          if (endedId) {
            telemetryUploader.upload(endedId).catch(() => {});
          }
        }).catch(() => {});
        persistBackgroundContext(null, false).catch(() => {});
      });

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
    if (backgroundTaskActive && Location) {
      Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => {});
      backgroundTaskActive = false;
    }
    set({ status: 'paused' });
  },

  resumeTracking: async () => {
    // Re-subscribe to location
    const loc = await getLocation();
    if (loc && get().locationAvailable) {
      locationSubscription = await loc.watchPositionAsync(
        { accuracy: loc.Accuracy.BestForNavigation, timeInterval: 3000, distanceInterval: 5 },
        (position) => {
          debugLogger.log({
            ts: position.timestamp || Date.now(),
            event: 'gps_fix',
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            accuracy_m: position.coords.accuracy ?? null,
            altitude_m: position.coords.altitude ?? null,
            altitude_accuracy_m: position.coords.altitudeAccuracy ?? null,
            speed_mps: position.coords.speed ?? null,
            heading_deg: position.coords.heading ?? null,
            raw_or_filtered: 'raw',
            source: 'foreground',
          });
          get().addTrackPoint({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            alt: position.coords.altitude,
            accuracy: position.coords.accuracy ?? null,
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
        lastCoordinateTime: Date.now(),
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
    if (backgroundTaskActive && Location) {
      Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => {});
      backgroundTaskActive = false;
    }
    if (durationInterval) {
      clearInterval(durationInterval);
      durationInterval = null;
    }
    if (drainInterval) {
      clearInterval(drainInterval);
      drainInterval = null;
    }
    if (dynamicSamplingInterval) {
      clearInterval(dynamicSamplingInterval);
      dynamicSamplingInterval = null;
    }

    // Stop monitors and end debug session (best effort)
    batteryMonitor.stop().catch(() => {});
    networkMonitor.stop();
    sessionRecorder.stop();
    debugLogger.endSession().catch(() => {});
    persistBackgroundContext(null, false).catch(() => {});

    lastSamplingIntervalMs = 3000;
    set({ ...initialState });
  },
}));

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Estimate current speed (m/s) from the last few track points.
 * Returns 0 if insufficient data.
 */
function estimateSpeed(points: TrackPoint[]): number {
  if (points.length < 2) return 0;
  const recent = points.slice(-5);
  let totalDist = 0;
  let totalTimeMs = 0;
  for (let i = 1; i < recent.length; i++) {
    totalDist += haversineM(recent[i - 1], recent[i]);
    totalTimeMs += recent[i].t - recent[i - 1].t;
  }
  if (totalTimeMs <= 0) return 0;
  return (totalDist / totalTimeMs) * 1000; // m/s
}
