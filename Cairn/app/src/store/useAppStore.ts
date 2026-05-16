/**
 * Cairn Global App Store (Zustand)
 * Single source of truth for UI mode and app-wide state.
 */
import { create } from 'zustand';
import { storage } from './storage';
import { getMe } from '../services/authService';

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

  hydrate: async () => {
    const saved = await storage.getItem(STORAGE_KEY_UI_MODE);
    if (saved === 'beginner' || saved === 'expert') {
      set({ uiMode: saved });
    }
    // Restore auth state from stored JWT
    try {
      const user = await getMe();
      if (user) {
        set({ isLoggedIn: true, user });
      }
    } catch {
      // Network unavailable — stay logged out, user will sign in manually
    }
    set({ hydrated: true });
  },
}));
