/**
 * useSessionStore — completed tracking session persistence.
 *
 * Stores completed hiking/running sessions locally.
 * Schema is geo-extensible: sessions are tagged with regionCode.
 * MapHistoryScreen and RoutesScreen read from this store in Sprint 16.
 *
 * Storage key: cairn_sessions
 */
import { create } from 'zustand';
import { storage } from './storage';
import type { Coordinate } from '../utils/geo';
import { authenticatedFetch } from '../services/apiService';
import { deleteRemoteSession } from '../services/sessionService';

export type ActivityMode = 'hiking' | 'running';

export interface TrackPoint extends Coordinate {
  t: number;  // Unix ms timestamp
}

export interface TrackingSession {
  id: string;
  remoteId?: number;           // backend session ID — set after successful sync
  activityMode: ActivityMode;
  regionCode: string;         // geo-extensible: 'nz', 'au', etc.
  startedAt: number;          // Unix ms
  endedAt: number;            // Unix ms
  durationS: number;          // seconds
  distanceM: number;          // meters (convert to km/mi at display layer)
  elevationGainM: number;     // meters
  trackPoints: TrackPoint[];  // GPS breadcrumb trail
  markerIds: string[];        // markers planted during this session
  name?: string;              // user-assigned name (optional, auto-generated if absent)
}

const STORAGE_KEY = 'cairn_sessions';
const MAX_SESSIONS = 100;

interface SessionState {
  sessions: TrackingSession[];
  addSession: (session: TrackingSession) => void;
  deleteSession: (id: string) => void;
  clearSessions: () => void;       // called on logout to remove prior user's data
  getSessions: () => TrackingSession[];
  getSessionsByRegion: (regionCode: string) => TrackingSession[];
  hydrate: () => Promise<void>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],

  addSession: (session) => {
    set((s) => {
      // Prepend newest first, prune oldest beyond MAX_SESSIONS
      const next = [session, ...s.sessions].slice(0, MAX_SESSIONS);
      // Store summary without trackPoints to keep localStorage small;
      // trackPoints stored separately under cairn_trackpoints_{id}
      const summaries = next.map(({ trackPoints: _, ...rest }) => rest);
      storage.setItem(STORAGE_KEY, JSON.stringify(summaries));
      // Store trackPoints separately
      if (session.trackPoints.length > 0) {
        storage.setItem(
          `cairn_trackpoints_${session.id}`,
          JSON.stringify(session.trackPoints),
        );
      }
      return { sessions: next };
    });

    // Sync to backend, capture remote ID
    authenticatedFetch('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({
        type: session.activityMode,
        start_time: new Date(session.startedAt).toISOString(),
        end_time: new Date(session.endedAt).toISOString(),
        distance_m: session.distanceM,
        duration_s: session.durationS,
        route_points: session.trackPoints.length > 0 ? session.trackPoints : null,
        flags: session.markerIds.length > 0 ? session.markerIds : null,
      }),
    }).then(async (res) => {
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      const remoteId = data?.session?.id;
      if (!remoteId) return;
      // Patch remoteId into the stored session
      set((s) => {
        const updated = s.sessions.map((sess) =>
          sess.id === session.id ? { ...sess, remoteId } : sess
        );
        const summaries = updated.map(({ trackPoints: _, ...rest }) => rest);
        storage.setItem(STORAGE_KEY, JSON.stringify(summaries));
        return { sessions: updated };
      });
    }).catch(() => {
      // Network failure — session remains in local store without remoteId
    });
  },

  clearSessions: () => {
    storage.removeItem(STORAGE_KEY);
    set({ sessions: [] });
  },

  deleteSession: (id) => {
    const session = get().sessions.find((s) => s.id === id);
    set((s) => {
      const next = s.sessions.filter((sess) => sess.id !== id);
      const summaries = next.map(({ trackPoints: _, ...rest }) => rest);
      storage.setItem(STORAGE_KEY, JSON.stringify(summaries));
      storage.removeItem(`cairn_trackpoints_${id}`);
      return { sessions: next };
    });
    // Mirror deletion to backend (fire-and-forget)
    if (session?.remoteId) {
      deleteRemoteSession(session.remoteId).catch(() => {});
    }
  },

  getSessions: () => get().sessions,

  getSessionsByRegion: (regionCode) =>
    get().sessions.filter((s) => s.regionCode === regionCode),

  hydrate: async () => {
    const raw = await storage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        // Sessions loaded without trackPoints (loaded on demand)
        const summaries: Omit<TrackingSession, 'trackPoints'>[] = JSON.parse(raw);
        const sessions: TrackingSession[] = summaries.map((s) => ({
          ...s,
          trackPoints: [],
        }));
        set({ sessions });
      } catch {
        storage.removeItem(STORAGE_KEY);
      }
    }
  },
}));

/**
 * Load track points for a specific session on demand.
 */
export async function loadTrackPoints(sessionId: string): Promise<TrackPoint[]> {
  const raw = await storage.getItem(`cairn_trackpoints_${sessionId}`);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as TrackPoint[];
  } catch {
    return [];
  }
}
