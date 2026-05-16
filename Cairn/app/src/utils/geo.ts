/**
 * geo.ts — geographic utility functions.
 * Unit-agnostic internally (meters). All display formatting goes through
 * formatDistance() which respects user's preferred unit.
 */

export type DistanceUnit = 'km' | 'mi';

export interface Coordinate {
  lat: number;
  lng: number;
  alt?: number | null;  // meters, nullable (web/simulator may not provide)
}

const EARTH_RADIUS_M = 6_371_000;

/**
 * Haversine distance between two coordinates, in meters.
 */
export function haversineM(a: Coordinate, b: Coordinate): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * Format distance for display.
 * @param meters  Raw distance in meters
 * @param unit    'km' (default) or 'mi'
 * @param decimals Decimal places (default 2)
 * Returns '--' when distance is negligible (< 10m)
 */
export function formatDistance(
  meters: number,
  unit: DistanceUnit = 'km',
  decimals = 2,
): string {
  if (meters < 10) return '--';
  if (unit === 'mi') {
    return (meters / 1609.344).toFixed(decimals);
  }
  return (meters / 1000).toFixed(decimals);
}

/**
 * Format distance with unit label.
 */
export function formatDistanceWithUnit(
  meters: number,
  unit: DistanceUnit = 'km',
): { value: string; label: string } {
  return {
    value: formatDistance(meters, unit),
    label: unit,
  };
}

/**
 * Format duration in seconds to mm:ss or h:mm:ss.
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Elevation gain from a series of altitude readings.
 * Only counts positive ascent. Returns 0 if no altitude data.
 */
export function calculateElevationGain(altitudes: (number | null | undefined)[]): number {
  let gain = 0;
  const valid = altitudes.filter((a): a is number => a != null);
  for (let i = 1; i < valid.length; i++) {
    const delta = valid[i] - valid[i - 1];
    if (delta > 0) gain += delta;
  }
  return Math.round(gain);
}

/**
 * Generate a unique ID (timestamp + random suffix).
 * Not cryptographically secure — for local IDs only.
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Format a timestamp to a human-readable date string.
 * Returns "Today", "Yesterday", or "Jan 5" / "May 14" format.
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

  if (dateStart === todayStart) return 'Today';
  if (dateStart === yesterdayStart) return 'Yesterday';

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Relative time label: "just now", "5m ago", "3h ago", "yesterday", "4 days ago".
 */
export function getRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return diffMin <= 1 ? 'just now' : `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'yesterday';
  return `${diffD} days ago`;
}
