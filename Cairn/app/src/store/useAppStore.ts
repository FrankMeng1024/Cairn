/**
 * Cairn Global App Store (Zustand)
 * Single source of truth for UI mode and app-wide state.
 */
import { create } from 'zustand';
import { storage } from './storage';
import { getMe } from '../services/authService';
import { fetchSessions } from '../services/sessionService';
import { useSessionStore, type ActivityMode as SessionActivityMode, type TrackPoint } from './useSessionStore';
import { useMarkerStore } from './useMarkerStore';
import { isPlaywrightBypass } from '../utils/devFlags';

export type UIMode = 'beginner' | 'expert';
export type ActivityMode = 'hiking' | 'running';
export type TrackingState = 'idle' | 'tracking' | 'paused';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
}

const STORAGE_KEY_UI_MODE = 'cairn_ui_mode';

interface AppState {
  // UI Mode — core of STORY-00006
  uiMode: UIMode;
  setUIMode: (mode: UIMode) => void;

  // Activity mode
  activityMode: ActivityMode;
  setActivityMode: (mode: ActivityMode) => void;

  // Tracking state
  trackingState: TrackingState;
  setTrackingState: (state: TrackingState) => void;

  // Mock elapsed tracking data
  trackingDistance: number;    // km
  trackingDuration: number;    // seconds
  incrementTracking: () => void;

  // Auth
  isLoggedIn: boolean;
  setLoggedIn: (v: boolean) => void;
  user: UserProfile | null;
  setUser: (user: UserProfile | null) => void;
  hydrated: boolean;
  sessionExpired: boolean;
  setSessionExpired: (v: boolean) => void;
  logout: () => void;

  // Hydrate persisted settings on app start
  hydrate: () => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  uiMode: 'beginner',    // Default: beginner (Explorer) for new users
  setUIMode: (mode) => {
    set({ uiMode: mode });
    storage.setItem(STORAGE_KEY_UI_MODE, mode);
  },

  activityMode: 'hiking',
  setActivityMode: (mode) => set({ activityMode: mode }),

  trackingState: 'idle',
  setTrackingState: (state) => set({ trackingState: state }),

  trackingDistance: 0,
  trackingDuration: 0,
  incrementTracking: () =>
    set((s) => ({
      trackingDistance: Math.round((s.trackingDistance + 0.01) * 100) / 100,
      trackingDuration: s.trackingDuration + 3,
    })),

  isLoggedIn: false,
  setLoggedIn: (v) => set({ isLoggedIn: v }),
  user: null,
  setUser: (user) => set({ user }),
  hydrated: false,
  sessionExpired: false,
  setSessionExpired: (v) => set({ sessionExpired: v }),

  logout: () => {
    set({ isLoggedIn: false, user: null, sessionExpired: false });
    useSessionStore.getState().clearSessions();
    useMarkerStore.getState().clearMarkers(); // clears in-memory only — localStorage preserved per user
  },

  hydrate: async () => {
    const saved = await storage.getItem(STORAGE_KEY_UI_MODE);
    if (saved === 'beginner' || saved === 'expert') {
      set({ uiMode: saved });
    }

    // Playwright bypass: only allowed in __DEV__ to prevent leaking into production builds.
    // Production builds ignore EXPO_PUBLIC_PLAYWRIGHT_BYPASS even if env leaks in.
    if (isPlaywrightBypass) {
      const playwrightUser: UserProfile = { id: '0', name: 'Playwright', email: 'pw@cairn.nz' };
      set({ isLoggedIn: true, user: playwrightUser, hydrated: true });
      return;
    }

    // Restore auth state from stored JWT
    try {
      const user = await getMe();
      if (user) {
        set({ isLoggedIn: true, user });
        // Load this user's markers + sessions from per-user storage slots
        await useMarkerStore.getState().hydrate(user.id);
        try {
          const remote = await fetchSessions();
          const sessions = remote.map((r) => ({
            id: String(r.id),
            activityMode: r.type as SessionActivityMode,
            regionCode: 'nz',
            startedAt: new Date(r.start_time).getTime(),
            endedAt: new Date(r.end_time).getTime(),
            durationS: r.duration_s,
            distanceM: r.distance_m,
            elevationGainM: 0,
            trackPoints: [] as TrackPoint[],
            markerIds: [] as string[],
          }));
          useSessionStore.setState({ sessions, currentUserId: user.id });
        } catch {
          // Session fetch failed — fall back to user-scoped local cache
          await useSessionStore.getState().hydrate(user.id);
        }
      } else {
        // Not logged in — load from guest slots only
        await useSessionStore.getState().hydrate('guest');
        await useMarkerStore.getState().hydrate('guest');
      }
    } catch {
      // Network unavailable — guest fallback
      await useSessionStore.getState().hydrate('guest');
      await useMarkerStore.getState().hydrate('guest');
    }
    set({ hydrated: true });
  },
}));
