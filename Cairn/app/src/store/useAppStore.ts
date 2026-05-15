/**
 * Cairn Global App Store (Zustand)
 * Single source of truth for UI mode and app-wide state.
 */
import { create } from 'zustand';

export type UIMode = 'guided' | 'simple';
export type ActivityMode = 'hiking' | 'running';
export type TrackingState = 'idle' | 'tracking' | 'paused';

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

  // Auth mock
  isLoggedIn: boolean;
  setLoggedIn: (v: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  uiMode: 'guided',      // Default: guided (说明模式) for new users
  setUIMode: (mode) => set({ uiMode: mode }),

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
}));
