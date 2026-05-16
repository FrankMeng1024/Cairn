/**
 * useRouteStore — Route management store for Phase 2 (E-007).
 *
 * Manages user-created routes, waypoints, and route metadata.
 * Persists to AsyncStorage.
 *
 * Sprint 45 — STORY-00151
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateId } from '../utils/geo';

// ── Types ───────────────────────────────────────────────────────────────────

export interface Waypoint {
  id: string;
  lat: number;
  lng: number;
  label: string;           // e.g. "Hydrate", "Rest stop"
  announceOnArrival: boolean; // TTS broadcast when user reaches this point
  radiusM: number;         // trigger radius in meters (default 30)
}

export interface RoutePoint {
  lat: number;
  lng: number;
  alt?: number | null;
}

export interface Route {
  id: string;
  name: string;
  description?: string;
  createdAt: number;       // timestamp
  updatedAt: number;
  points: RoutePoint[];    // the route polyline
  waypoints: Waypoint[];   // interactive points along route
  distanceM: number;       // total route distance in meters
  elevationGainM: number;  // total elevation gain
  runCount: number;        // how many times user completed this route
  lastRunAt?: number;      // timestamp of last completion
  sharedBy?: string;       // friend name if received from a friend
  isActive: boolean;       // currently selected for navigation
  mutedMarkerIds: string[]; // markers along route that user chose not to broadcast
}

export interface RouteStore {
  routes: Route[];
  activeRouteId: string | null;

  // CRUD
  addRoute: (route: Omit<Route, 'id' | 'createdAt' | 'updatedAt' | 'runCount' | 'isActive' | 'mutedMarkerIds'>) => string;
  updateRoute: (id: string, updates: Partial<Route>) => void;
  deleteRoute: (id: string) => void;

  // Waypoints
  addWaypoint: (routeId: string, waypoint: Omit<Waypoint, 'id'>) => void;
  removeWaypoint: (routeId: string, waypointId: string) => void;

  // Navigation
  setActiveRoute: (id: string | null) => void;
  incrementRunCount: (id: string) => void;

  // Marker muting
  muteMarker: (routeId: string, markerId: string) => void;
  unmuteMarker: (routeId: string, markerId: string) => void;

  // Persistence
  hydrate: () => Promise<void>;
}

const STORAGE_KEY = 'cairn_routes';

// ── Store ───────────────────────────────────────────────────────────────────

export const useRouteStore = create<RouteStore>((set, get) => ({
  routes: [],
  activeRouteId: null,

  addRoute: (routeData) => {
    const id = generateId();
    const now = Date.now();
    const route: Route = {
      ...routeData,
      id,
      createdAt: now,
      updatedAt: now,
      runCount: 0,
      isActive: false,
      mutedMarkerIds: [],
    };
    set((s) => {
      const routes = [...s.routes, route];
      persist(routes);
      return { routes };
    });
    return id;
  },

  updateRoute: (id, updates) => {
    set((s) => {
      const routes = s.routes.map(r =>
        r.id === id ? { ...r, ...updates, updatedAt: Date.now() } : r
      );
      persist(routes);
      return { routes };
    });
  },

  deleteRoute: (id) => {
    set((s) => {
      const routes = s.routes.filter(r => r.id !== id);
      const activeRouteId = s.activeRouteId === id ? null : s.activeRouteId;
      persist(routes);
      return { routes, activeRouteId };
    });
  },

  addWaypoint: (routeId, waypointData) => {
    const waypoint: Waypoint = { ...waypointData, id: generateId() };
    set((s) => {
      const routes = s.routes.map(r =>
        r.id === routeId
          ? { ...r, waypoints: [...r.waypoints, waypoint], updatedAt: Date.now() }
          : r
      );
      persist(routes);
      return { routes };
    });
  },

  removeWaypoint: (routeId, waypointId) => {
    set((s) => {
      const routes = s.routes.map(r =>
        r.id === routeId
          ? { ...r, waypoints: r.waypoints.filter(w => w.id !== waypointId), updatedAt: Date.now() }
          : r
      );
      persist(routes);
      return { routes };
    });
  },

  setActiveRoute: (id) => {
    set((s) => {
      const routes = s.routes.map(r => ({ ...r, isActive: r.id === id }));
      persist(routes);
      return { routes, activeRouteId: id };
    });
  },

  incrementRunCount: (id) => {
    set((s) => {
      const routes = s.routes.map(r =>
        r.id === id
          ? { ...r, runCount: r.runCount + 1, lastRunAt: Date.now(), updatedAt: Date.now() }
          : r
      );
      persist(routes);
      return { routes };
    });
  },

  muteMarker: (routeId, markerId) => {
    set((s) => {
      const routes = s.routes.map(r =>
        r.id === routeId && !r.mutedMarkerIds.includes(markerId)
          ? { ...r, mutedMarkerIds: [...r.mutedMarkerIds, markerId], updatedAt: Date.now() }
          : r
      );
      persist(routes);
      return { routes };
    });
  },

  unmuteMarker: (routeId, markerId) => {
    set((s) => {
      const routes = s.routes.map(r =>
        r.id === routeId
          ? { ...r, mutedMarkerIds: r.mutedMarkerIds.filter(id => id !== markerId), updatedAt: Date.now() }
          : r
      );
      persist(routes);
      return { routes };
    });
  },

  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const routes: Route[] = JSON.parse(stored);
        const activeRoute = routes.find(r => r.isActive);
        set({ routes, activeRouteId: activeRoute?.id ?? null });
      }
    } catch {
      // Ignore parse errors — start fresh
    }
  },
}));

// ── Persistence helper ──────────────────────────────────────────────────────

async function persist(routes: Route[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
  } catch {
    // Silent fail — data in memory, will retry next mutation
  }
}
