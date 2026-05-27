/**
 * Session service — sync local sessions to backend.
 * Silent on network failure (offline-first design).
 */
import { authenticatedFetch } from './apiService';

// GPS point shape used by both legacy POST and new incremental flows.
export interface TrackPointLike {
  lat: number;
  lng: number;
  alt?: number | null;
  /** Either ISO string (incremental flow) or epoch ms (legacy flow). */
  t?: number;
  timestamp?: string;
}

export interface SessionPayload {
  type: 'hiking' | 'running';
  start_time: string;   // ISO date string
  end_time: string;     // ISO date string
  distance_m: number;
  duration_s: number;
  // User-assigned activity name. Optional. When absent, the client will
  // synthesise a "Hike — DD/MM/YYYY" default at display time.
  name?: string | null;
  route_points?: TrackPointLike[];
  /** v77: full audit track (incl. stationary drift + low-accuracy fixes,
   *  exclusive of teleport-rejected). Sent with the legacy all-in-one
   *  POST path; modern incremental flow uses finalizeSession PATCH. */
  route_points_raw?: TrackPointLike[] | null;
  flags?: Array<{ lat: number; lng: number; note: string; timestamp: string }>;
}

export interface RemoteSession {
  id: number;
  user_id: number;
  type: 'hiking' | 'running';
  start_time: string;
  end_time: string;
  distance_m: number;
  duration_s: number;
  // Returned by the backend. May be null on legacy rows or when the
  // user never named the activity. Caller should fall back to a
  // type+date default in that case.
  name?: string | null;
  /** Only present on GET /api/sessions/:id (detail). list endpoint omits. */
  route_points?: TrackPointLike[];
  /** v77: full audit track. Detail endpoint returns it; list omits. */
  route_points_raw?: TrackPointLike[] | null;
  flags?: any[] | null;
  created_at: string;
}

/**
 * POST a completed session to the backend (legacy: all-in-one path).
 * Returns the remote session ID, or null on failure (caller continues with local only).
 */
export async function syncSession(payload: SessionPayload): Promise<number | null> {
  try {
    const res = await authenticatedFetch('/api/sessions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data?.session?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Begin an active session — creates an empty row server-side, returns
 * its id so the client can later append points + finalize.
 */
export async function startSession(
  type: 'hiking' | 'running',
  startTime: string,
): Promise<number | null> {
  try {
    const res = await authenticatedFetch('/api/sessions/start', {
      method: 'POST',
      body: JSON.stringify({ type, start_time: startTime }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.id === 'number' ? data.id : null;
  } catch {
    return null;
  }
}

/**
 * Append a batch of GPS points to an active session. Used by the
 * 60-second incremental backup interval during tracking. Silent on
 * failure — the next interval retries the unflushed range.
 */
export async function appendPoints(
  remoteId: number,
  points: TrackPointLike[],
): Promise<boolean> {
  if (points.length === 0) return true;
  try {
    const res = await authenticatedFetch(`/api/sessions/${remoteId}/append-points`, {
      method: 'PATCH',
      body: JSON.stringify({ points }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Finalize a session at stop time: write end_time, distance_m,
 * duration_s, (optional) name, and (optional v77) full raw audit track.
 */
export async function finalizeSession(
  remoteId: number,
  fields: {
    end_time?: string;
    distance_m?: number;
    duration_s?: number;
    name?: string | null;
    route_points_raw?: TrackPointLike[] | null;
  },
): Promise<boolean> {
  try {
    const res = await authenticatedFetch(`/api/sessions/${remoteId}`, {
      method: 'PATCH',
      body: JSON.stringify(fields),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch a single session WITH route_points + flags. Used by the
 * activity-detail view to render the polyline on the map.
 */
export async function fetchSessionDetail(remoteId: number): Promise<RemoteSession | null> {
  try {
    const res = await authenticatedFetch(`/api/sessions/${remoteId}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.session ?? null;
  } catch {
    return null;
  }
}

/**
 * DELETE the session from the backend.
 * Returns true on success, false on failure (caller continues regardless).
 */
export async function deleteRemoteSession(remoteId: number): Promise<boolean> {
  try {
    const res = await authenticatedFetch(`/api/sessions/${remoteId}`, { method: 'DELETE' });
    return res.ok;
  } catch {
    return false;
  }
}
export async function fetchSessions(): Promise<RemoteSession[]> {
  try {
    const res = await authenticatedFetch('/api/sessions');
    if (!res.ok) return [];
    const data = await res.json();
    return data?.sessions ?? [];
  } catch {
    return [];
  }
}
