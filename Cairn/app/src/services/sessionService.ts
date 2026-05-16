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
 * GET the user's session list from the backend.
 * Returns empty array on failure.
 */
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
