/**
 * Session service — sync local sessions to backend.
 * Silent on network failure (offline-first design).
 */
import { authenticatedFetch } from './apiService';

export interface SessionPayload {
  type: 'hiking' | 'running';
  start_time: string;   // ISO date string
  end_time: string;     // ISO date string
  distance_m: number;
  duration_s: number;
  // User-assigned activity name. Optional. When absent, the client will
  // synthesise a "Hike — DD/MM/YYYY" default at display time.
  name?: string | null;
  route_points?: Array<{ lat: number; lng: number; timestamp: string }>;
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
  created_at: string;
}

/**
 * POST a completed session to the backend.
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
