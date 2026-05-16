/**
 * useMarkerStore — local marker (flag) persistence.
 *
 * Markers are stored per-region. No NZ hardcoding in this file —
 * regionCode is always passed by the caller (comes from getCurrentRegion()).
 *
 * Storage key: cairn_markers
 * Schema: Marker[]  (JSON serialized)
 */
import { create } from 'zustand';
import { storage } from './storage';
import { generateId } from '../utils/geo';
import type { MarkerType } from '../data/mockData';

export type MarkerPermission = 'personal' | 'group' | 'public';

export interface Marker {
  id: string;
  type: MarkerType;
  regionCode: string;      // e.g. 'nz' — never hardcoded at call site
  lat: number;
  lng: number;
  note: string;
  authorId: string;        // 'local' until Firebase Auth implemented
  createdAt: number;       // Unix ms
  permission: MarkerPermission;
  // Display helpers (derived at render time from MARKER_META)
  sessionId?: string;      // which tracking session this was planted in
}

const STORAGE_KEY = 'cairn_markers';

interface MarkerState {
  markers: Marker[];
  addMarker: (marker: Omit<Marker, 'id' | 'createdAt'>) => Marker;
  deleteMarker: (id: string) => void;
  clearMarkers: () => void;
  getMarkersForRegion: (regionCode: string) => Marker[];
  hydrate: () => Promise<void>;
}

export const useMarkerStore = create<MarkerState>((set, get) => ({
  markers: [],

  addMarker: (data) => {
    const marker: Marker = {
      ...data,
      id: generateId(),
      createdAt: Date.now(),
    };
    set((s) => {
      const next = [...s.markers, marker];
      storage.setItem(STORAGE_KEY, JSON.stringify(next));
      return { markers: next };
    });
    return marker;
  },

  deleteMarker: (id) => {
    set((s) => {
      const next = s.markers.filter((m) => m.id !== id);
      storage.setItem(STORAGE_KEY, JSON.stringify(next));
      return { markers: next };
    });
  },

  clearMarkers: () => {
    storage.removeItem(STORAGE_KEY);
    set({ markers: [] });
  },

  getMarkersForRegion: (regionCode) => {
    return get().markers.filter((m) => m.regionCode === regionCode);
  },

  hydrate: async () => {
    const raw = await storage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const markers: Marker[] = JSON.parse(raw);
        set({ markers });
      } catch {
        // corrupted storage — reset
        storage.removeItem(STORAGE_KEY);
      }
    }
  },
}));
