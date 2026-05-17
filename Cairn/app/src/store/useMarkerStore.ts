/**
 * useMarkerStore — local marker (flag) persistence + backend sync.
 *
 * Architecture:
 * - Local MMKV cache is write-through (every mutation saves locally)
 * - Backend sync is additive: loadFromBackend() merges server markers
 * - Offline tolerance: local mutations queue and sync on next online
 *
 * Field mapping: backend `text` ↔ frontend `note`
 * ID convention: backend returns integer insertId; stored as string
 */
import { create } from 'zustand';
import { storage } from './storage';
import { generateId } from '../utils/geo';
import { authenticatedFetch } from '../services/apiService';
import type { MarkerType } from '../data/mockData';

export type MarkerPermission = 'personal' | 'group' | 'public';

export interface Marker {
  id: string;
  type: MarkerType;
  regionCode: string;      // e.g. 'nz' — frontend concept, not in backend
  lat: number;
  lng: number;
  note: string;            // backend field: text
  authorId: string;        // 'local' for offline; userId for synced
  createdAt: number;       // Unix ms
  permission: MarkerPermission;
  sessionId?: string;      // which tracking session this was planted in
  synced?: boolean;        // true = exists in backend, false = local-only
  alt?: number;
}

const STORAGE_KEY_PREFIX = 'cairn_markers';

function storageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}_${userId}`;
}

/** Convert backend row → frontend Marker */
function fromBackend(row: {
  id: number | string;
  type: string;
  text: string;
  lat: number;
  lng: number;
  alt?: number | null;
  permission: string;
  created_at: string;
}): Marker {
  return {
    id: String(row.id),
    type: row.type as MarkerType,
    regionCode: 'nz',           // default — backend doesn't store this
    lat: row.lat,
    lng: row.lng,
    note: row.text || '',
    alt: row.alt ?? undefined,
    authorId: 'server',
    createdAt: new Date(row.created_at).getTime(),
    permission: (row.permission as MarkerPermission) || 'personal',
    synced: true,
  };
}

interface MarkerState {
  markers: Marker[];
  userId: string | null;
  syncing: boolean;
  addMarker: (marker: Omit<Marker, 'id' | 'createdAt'>) => Promise<Marker>;
  updateMarker: (id: string, updates: Partial<Omit<Marker, 'id' | 'createdAt'>>) => Promise<void>;
  deleteMarker: (id: string) => Promise<void>;
  clearMarkers: () => void;
  getMarkersForRegion: (regionCode: string) => Marker[];
  hydrate: (userId: string) => Promise<void>;
  loadFromBackend: () => Promise<void>;
}

export const useMarkerStore = create<MarkerState>((set, get) => ({
  markers: [],
  userId: null,
  syncing: false,

  addMarker: async (data) => {
    // Optimistic local create
    const localId = generateId();
    const marker: Marker = {
      ...data,
      id: localId,
      createdAt: Date.now(),
      synced: false,
    };
    set((s) => {
      const next = [...s.markers, marker];
      if (s.userId) storage.setItem(storageKey(s.userId), JSON.stringify(next));
      return { markers: next };
    });

    // Sync to backend
    try {
      const res = await authenticatedFetch('/api/markers', {
        method: 'POST',
        body: JSON.stringify({
          type: data.type,
          text: data.note,
          lat: data.lat,
          lng: data.lng,
          alt: data.alt,
          permission: data.permission,
        }),
      });
      if (res.ok) {
        const serverMarker = await res.json();
        // Replace local optimistic id with server id
        set((s) => {
          const next = s.markers.map((m) =>
            m.id === localId
              ? { ...m, id: String(serverMarker.id), synced: true }
              : m
          );
          if (s.userId) storage.setItem(storageKey(s.userId), JSON.stringify(next));
          return { markers: next };
        });
        return { ...marker, id: String(serverMarker.id), synced: true };
      }
    } catch {
      // Network failure — stays as local-only, will retry on next sync
    }
    return marker;
  },

  updateMarker: async (id, updates) => {
    set((s) => {
      const next = s.markers.map((m) => m.id === id ? { ...m, ...updates } : m);
      if (s.userId) storage.setItem(storageKey(s.userId), JSON.stringify(next));
      return { markers: next };
    });

    // Sync to backend (only text and permission are updatable)
    const backendUpdates: Record<string, string> = {};
    if (updates.note !== undefined) backendUpdates.text = updates.note;
    if (updates.permission !== undefined) backendUpdates.permission = updates.permission;
    if (Object.keys(backendUpdates).length === 0) return;

    try {
      await authenticatedFetch(`/api/markers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(backendUpdates),
      });
    } catch {
      // Network failure — local update persisted, backend will be stale until next sync
    }
  },

  deleteMarker: async (id) => {
    set((s) => {
      const next = s.markers.filter((m) => m.id !== id);
      if (s.userId) storage.setItem(storageKey(s.userId), JSON.stringify(next));
      return { markers: next };
    });

    try {
      await authenticatedFetch(`/api/markers/${id}`, { method: 'DELETE' });
    } catch {
      // Network failure — deleted locally, backend sync deferred
    }
  },

  clearMarkers: () => {
    set({ markers: [], userId: null });
  },

  getMarkersForRegion: (regionCode) => {
    return get().markers.filter((m) => m.regionCode === regionCode);
  },

  loadFromBackend: async () => {
    set({ syncing: true });
    try {
      const res = await authenticatedFetch('/api/markers');
      if (!res.ok) return;
      const rows = await res.json();
      const serverMarkers: Marker[] = rows.map(fromBackend);

      set((s) => {
        // Merge: server markers replace any with same id, keep local-only
        const localOnly = s.markers.filter((m) => !m.synced);
        const merged = [
          ...serverMarkers,
          ...localOnly.filter((lo) => !serverMarkers.some((sm) => sm.id === lo.id)),
        ];
        if (s.userId) storage.setItem(storageKey(s.userId), JSON.stringify(merged));
        return { markers: merged, syncing: false };
      });
    } catch {
      set({ syncing: false });
    }
  },

  hydrate: async (userId: string) => {
    // 1. Load from local cache first (instant)
    const key = storageKey(userId);
    const raw = await storage.getItem(key);
    if (raw) {
      try {
        const markers: Marker[] = JSON.parse(raw);
        set({ markers, userId });
      } catch {
        storage.removeItem(key);
        set({ markers: [], userId });
      }
    } else {
      set({ markers: [], userId });
    }
    // 2. Then fetch from backend (async, updates state when done)
    get().loadFromBackend();
  },
}));
