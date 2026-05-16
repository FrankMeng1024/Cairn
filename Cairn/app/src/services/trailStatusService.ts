/**
 * DOC Trail Status Service — NZ Department of Conservation data integration.
 *
 * Fetches trail alerts, closures, and hazard warnings for NZ tracks.
 * DOC API: https://api.doc.govt.nz/v2/
 * Requires API key (free registration at doc.govt.nz/developer)
 *
 * Sprint 49 — STORY-00166 (E-009: NZ Real-time Data)
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface TrailAlert {
  id: string;
  trackName: string;
  alertType: 'closure' | 'warning' | 'advisory';
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  startDate?: string;
  endDate?: string;
  region: string;
  lat?: number;
  lng?: number;
  updatedAt: string;
}

export interface TrailStatus {
  trackId: string;
  name: string;
  status: 'open' | 'closed' | 'caution';
  alerts: TrailAlert[];
  region: string;
  difficulty: string;
  lengthKm: number;
}

// ── Configuration ───────────────────────────────────────────────────────────

const DOC_API_BASE = 'https://api.doc.govt.nz/v2';
const DOC_API_KEY = process.env.EXPO_PUBLIC_DOC_API_KEY || '';
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

// ── Cache ───────────────────────────────────────────────────────────────────

interface CachedAlerts {
  alerts: TrailAlert[];
  fetchedAt: number;
  region: string;
}

let alertCache: CachedAlerts | null = null;

// ── API Functions ───────────────────────────────────────────────────────────

/**
 * Fetch trail alerts for a region.
 * Returns cached data if fresh. Gracefully returns empty on failure.
 */
export async function fetchTrailAlerts(region = 'all'): Promise<TrailAlert[]> {
  // Return cache if fresh
  if (alertCache && alertCache.region === region &&
      (Date.now() - alertCache.fetchedAt < CACHE_DURATION_MS)) {
    return alertCache.alerts;
  }

  // If no API key, return empty (non-blocking)
  if (!DOC_API_KEY) {
    return alertCache?.alerts ?? [];
  }

  try {
    const response = await fetch(`${DOC_API_BASE}/tracks/alerts`, {
      headers: {
        'x-api-key': DOC_API_KEY,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) return alertCache?.alerts ?? [];

    const data = await response.json();

    // Transform DOC API response to our format
    const alerts: TrailAlert[] = (data.alerts || data || []).map((item: any) => ({
      id: item.id || `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      trackName: item.trackName || item.name || 'Unknown Track',
      alertType: mapAlertType(item.type || item.alertType),
      title: item.title || item.heading || '',
      description: item.description || item.body || '',
      severity: mapSeverity(item.severity || item.priority),
      startDate: item.startDate || item.dateStart,
      endDate: item.endDate || item.dateEnd,
      region: item.region || region,
      lat: item.latitude || item.lat,
      lng: item.longitude || item.lng,
      updatedAt: item.updatedAt || item.lastModified || new Date().toISOString(),
    }));

    alertCache = { alerts, fetchedAt: Date.now(), region };
    return alerts;
  } catch {
    return alertCache?.alerts ?? [];
  }
}

/**
 * Get alerts relevant to a specific location (within 10km radius).
 */
export function getAlertsNearLocation(
  alerts: TrailAlert[],
  lat: number,
  lng: number,
  radiusKm = 10,
): TrailAlert[] {
  return alerts.filter(alert => {
    if (!alert.lat || !alert.lng) return false;
    const dLat = alert.lat - lat;
    const dLng = alert.lng - lng;
    // Approximate distance in km (flat earth for small distances)
    const distKm = Math.sqrt(dLat * dLat + dLng * dLng) * 111;
    return distKm <= radiusKm;
  });
}

/**
 * Get closure alerts on a specific track name.
 */
export function getTrackClosures(alerts: TrailAlert[], trackName: string): TrailAlert[] {
  const normalized = trackName.toLowerCase();
  return alerts.filter(a =>
    a.alertType === 'closure' &&
    a.trackName.toLowerCase().includes(normalized)
  );
}

/**
 * Get broadcast text for a trail alert (for TTS).
 */
export function getAlertBroadcastText(alert: TrailAlert): string {
  switch (alert.alertType) {
    case 'closure':
      return `Warning: ${alert.trackName} is closed. ${alert.title}`;
    case 'warning':
      return `Caution on ${alert.trackName}: ${alert.title}`;
    case 'advisory':
      return `Advisory for ${alert.trackName}: ${alert.title}`;
  }
}

/**
 * Determine broadcast priority for an alert.
 */
export function getAlertPriority(alert: TrailAlert): 'P0' | 'P1' | 'P2' {
  if (alert.alertType === 'closure') return 'P0';
  if (alert.severity === 'critical' || alert.severity === 'high') return 'P0';
  if (alert.alertType === 'warning') return 'P1';
  return 'P2';
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function mapAlertType(type: string): TrailAlert['alertType'] {
  const t = (type || '').toLowerCase();
  if (t.includes('clos')) return 'closure';
  if (t.includes('warn') || t.includes('hazard')) return 'warning';
  return 'advisory';
}

function mapSeverity(sev: string): TrailAlert['severity'] {
  const s = (sev || '').toLowerCase();
  if (s.includes('crit') || s.includes('extreme')) return 'critical';
  if (s.includes('high') || s.includes('major')) return 'high';
  if (s.includes('med')) return 'medium';
  return 'low';
}
