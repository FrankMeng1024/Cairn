/**
 * markerTypes.ts — single source of truth for marker categories.
 *
 * PRD3 E-015. Replaces the four duplicate FLAG_TYPES arrays previously
 * scattered across MapScreen / HikingScreen / RoutesScreen / ARScreen,
 * and the hardcoded MARKER_META in data/mockData.ts.
 *
 * Adds the sixth category — 'cairn' — Cairn's signature marker. Cairns
 * are intentionally low-key (sepia brown, no severity colour) because
 * they are messages from one tramper to the next, not warnings.
 */

import { Colors } from '../components/tokens';
import type { IconName } from '../components/Icon';

export type MarkerType =
  | 'danger'
  | 'scenic'
  | 'supply'
  | 'junction'
  | 'cairn'
  | 'free';

export interface MarkerTypeMeta {
  id: MarkerType;
  /** lucide icon name. 'cairn' is rendered by a custom SVG, not lucide. */
  icon: IconName;
  /** UI label shown in pickers. NZ-correct copy. */
  label: string;
  /** Pin colour — for icon stroke and outer ring. */
  color: string;
  /** Pin background tint — for the disc. Soft enough to read on cream map. */
  bg: string;
  /** One-line hint shown in the marker picker. */
  hint: string;
}

export const MARKER_TYPES: Record<MarkerType, MarkerTypeMeta> = {
  danger: {
    id: 'danger',
    icon: 'TriangleAlert',
    label: 'Danger',
    color: Colors.danger,
    bg: Colors.dangerBg,
    hint: 'Flooded crossing, slip, hazard ahead',
  },
  scenic: {
    id: 'scenic',
    icon: 'Star',
    label: 'Scenic',
    color: Colors.info,
    bg: Colors.infoBg,
    hint: 'View worth the stop',
  },
  supply: {
    id: 'supply',
    icon: 'Droplets',
    label: 'Water',
    color: Colors.success,
    bg: Colors.successBg,
    hint: 'Drinkable stream, hut tank',
  },
  junction: {
    id: 'junction',
    icon: 'Navigation2',
    label: 'Junction',
    color: Colors.docOrange,
    bg: Colors.severityWarningBg,
    hint: 'Track split or turn-off',
  },
  cairn: {
    id: 'cairn',
    // 'Mountain' is the closest lucide approximation; real rendering uses
    // <CairnStoneIcon> SVG so this is only used as a fallback in pickers.
    icon: 'Mountain',
    label: 'Cairn',
    color: Colors.trail, // sepia brown #b5823d — neutral, not severity
    bg: 'rgba(181,130,61,0.10)',
    hint: 'A note for whoever comes next',
  },
  free: {
    id: 'free',
    icon: 'MapPin',
    label: 'Note',
    color: Colors.textSecondary,
    bg: Colors.surface,
    hint: 'Anything else worth noting',
  },
};

/** Stable order for marker pickers — emergency first, then info, then cairn. */
export const MARKER_TYPE_ORDER: MarkerType[] = [
  'danger',
  'junction',
  'scenic',
  'supply',
  'cairn',
  'free',
];

/** The five "primary" types shown in the small marker picker (cairn excluded — picked from a separate "leave a note" surface in v1). */
export const PRIMARY_MARKER_TYPES: MarkerType[] = [
  'danger',
  'scenic',
  'supply',
  'junction',
];

export function getMarkerMeta(type: MarkerType | undefined | null): MarkerTypeMeta | null {
  if (!type) return null;
  return MARKER_TYPES[type] ?? null;
}
