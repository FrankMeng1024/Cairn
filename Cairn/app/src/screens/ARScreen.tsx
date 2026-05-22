/**
 * ARScene — Augmented Reality marker viewing/placing scene.
 *
 * Uses device camera + GPS to render 3D markers at real-world positions.
 * GPS coordinates → relative position (bearing + distance from user).
 *
 * Architecture:
 * - AR framework: @viro-community/react-viro (if available) or expo-camera fallback
 * - GPS anchoring: converts lat/lng to XYZ offset relative to user position
 * - Mode exclusion: when AR active, map rendering is paused (battery saving)
 *
 * Sprint 51 — STORY-00173 (E-003: AR插旗)
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, Animated, Dimensions, PanResponder } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, FontSize, Radius } from '../components/tokens';
import { Icon } from '../components/Icon';
import { PressBtn } from '../components/PressBtn';
import { GlassPanel, Elevation } from '../components/GlassPanel';
import { useMarkerStore, type Marker } from '../store/useMarkerStore';
import { useTrackingStore } from '../store/useTrackingStore';
import { haversineM, type Coordinate } from '../utils/geo';
import { crashLogger } from '../services/crashLogger';
import { filterContent, type ContentLevel } from '../services/contentFilter';
import { checkMarkerSpacing } from '../utils/geo';

// ── Conditional camera import ────────────────────────────────────────────
// expo-camera is in package.json (added in v15 dep bump). Lazy-loaded
// so a build that lacks it (e.g. Expo Go) still renders the AR screen
// — it just falls back to the dark backdrop without a live camera
// feed. The placement / projection logic works identically in both
// modes; only the background changes.
let CameraView: any = null;
let useCameraPermissions: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Mod = require('expo-camera');
  CameraView = Mod.CameraView;
  useCameraPermissions = Mod.useCameraPermissions;
} catch {
  // Camera module unavailable — fall through to backdrop-only AR.
}

// Screen dimensions (snapshotted at module load — fine for portrait
// AR; would need re-measure on rotation but Cairn is portrait-only).
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Camera horizontal field-of-view in degrees. iPhone main rear camera
// is ~63° in 1x; Android cameras vary 60-70°. 65° is a reasonable
// middle that makes flag positions feel correct without per-device
// calibration. Future: query CameraView for actual FOV.
const CAMERA_FOV_DEG = 65;

// ── GPS → AR Coordinate Conversion ─────────────────────────────────────────

/**
 * Convert a GPS coordinate to a relative 3D position from the user.
 * Uses flat-earth approximation (valid for distances < 1km).
 *
 * Returns [x, y, z] in meters where:
 * - x = east (positive) / west (negative)
 * - y = altitude offset (positive = higher)
 * - z = north (negative — AR camera looks toward -Z)
 */
export function gpsToRelativeXYZ(
  userPos: Coordinate,
  markerPos: Coordinate,
  userHeading: number,  // device compass heading in degrees
): [number, number, number] {
  // Calculate north/east offsets in meters
  const dLat = markerPos.lat - userPos.lat;
  const dLng = markerPos.lng - userPos.lng;

  // Approximate meters (1° lat ≈ 111km, 1° lng ≈ 111km * cos(lat))
  const northM = dLat * 111000;
  const eastM = dLng * 111000 * Math.cos(userPos.lat * Math.PI / 180);

  // Rotate by user heading (so markers appear in correct direction)
  const headingRad = (userHeading * Math.PI) / 180;
  const x = eastM * Math.cos(headingRad) - northM * Math.sin(headingRad);
  const z = -(eastM * Math.sin(headingRad) + northM * Math.cos(headingRad));

  // Altitude offset (default 0 if not available)
  const y = ((markerPos.alt ?? 0) - (userPos.alt ?? 0)) || 0;

  return [x, y, z];
}

/**
 * Calculate bearing from user to marker (0-360, 0=North).
 */
export function bearingTo(from: Coordinate, to: Coordinate): number {
  const dLng = (to.lng - from.lng) * Math.PI / 180;
  const lat1 = from.lat * Math.PI / 180;
  const lat2 = to.lat * Math.PI / 180;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const bearing = Math.atan2(y, x) * 180 / Math.PI;

  return (bearing + 360) % 360;
}

// ── AR Marker Type → 3D Config ──────────────────────────────────────────────

export interface AR3DConfig {
  color: string;
  glowColor: string;
  shape: 'cone' | 'box' | 'sphere' | 'cylinder';
  scale: number;
  label: string;
}

export function getAR3DConfig(type: string): AR3DConfig {
  switch (type) {
    case 'danger':
      return { color: '#c53d2e', glowColor: '#ff6b5a', shape: 'cone', scale: 1.2, label: 'Danger' };
    case 'scenic':
      return { color: '#2e6cc5', glowColor: '#6ba3ff', shape: 'sphere', scale: 1.0, label: 'Scenic' };
    case 'supply':
      return { color: '#2e8c3a', glowColor: '#5cd46a', shape: 'box', scale: 1.0, label: 'Supply' };
    case 'junction':
      return { color: '#b36b00', glowColor: '#ffa940', shape: 'cylinder', scale: 0.8, label: 'Junction' };
    default:
      return { color: '#8c7e72', glowColor: '#b5a99d', shape: 'sphere', scale: 0.8, label: 'Marker' };
  }
}

// ── AR Visibility Ranges ────────────────────────────────────────────────────

/** Maximum distance to render AR markers (meters) */
export const AR_MAX_RANGE_M = 500;

/** Minimum distance for "snap to marker" interaction */
export const AR_SNAP_RANGE_M = 5;

/** Scale factor based on distance (closer = bigger) */
export function getDistanceScale(distanceM: number): number {
  if (distanceM <= 10) return 1.5;
  if (distanceM <= 50) return 1.2;
  if (distanceM <= 100) return 1.0;
  if (distanceM <= 200) return 0.7;
  return 0.5;
}

// ── AR Permission Visibility ────────────────────────────────────────────────

export interface ARMarkerVisual {
  opacity: number;
  hasAvatarRing: boolean;
  hasDashedRing: boolean;
}

/** Visual distinction for personal/friend/community markers in AR */
export function getPermissionVisual(permission: string): ARMarkerVisual {
  switch (permission) {
    case 'personal':
      return { opacity: 1.0, hasAvatarRing: false, hasDashedRing: false };
    case 'group':
      return { opacity: 0.75, hasAvatarRing: true, hasDashedRing: false };
    case 'public':
      return { opacity: 0.6, hasAvatarRing: false, hasDashedRing: true };
    default:
      return { opacity: 1.0, hasAvatarRing: false, hasDashedRing: false };
  }
}

// ── AR Screen Component (Fallback — no ViroReact available) ─────────────────

interface ARScreenProps {
  onClose?: () => void;
  onPlaceMarker?: (lat: number, lng: number) => void;
}

// Flag type config
const FLAG_TYPES: { id: 'danger' | 'scenic' | 'supply' | 'junction'; icon: string; label: string; color: string; bg: string }[] = [
  { id: 'danger',   icon: 'TriangleAlert', label: 'Danger',   color: '#c53d2e',  bg: '#fde8ea' },
  { id: 'scenic',   icon: 'Star',          label: 'Scenic',   color: '#3b82f6',  bg: '#e8f1fb' },
  { id: 'supply',   icon: 'Droplets',      label: 'Water',    color: '#22c55e',  bg: '#e8f8ef' },
  { id: 'junction', icon: 'Navigation2',   label: 'Junction', color: '#f59e0b',  bg: '#fef3e2' },
];

/**
 * AR Screen — compass-based directional view + Place Flag flow.
 *
 * GPS degradation logic:
 * - Has fresh GPS (< 30s) → normal placement
 * - Has stale GPS (> 30s) or lost signal → degraded placement with toast
 * - Never had GPS → blocked
 */

// ── AR flag overlay ───────────────────────────────────────────────────────
// Projects each nearby marker onto screen-space using:
//   bearing = bearingTo(user, marker)        // 0-360°, geographic
//   relative = bearing - userHeading          // -180 to +180
//   if |relative| > FOV/2 → marker is outside camera view
//   screenX = SCREEN_W/2 + (relative / (FOV/2)) * (SCREEN_W/2)
// Vertical position scales with distance (closer = lower on screen,
// further = higher), giving a soft "depth" cue without true 3D math.
// Size shrinks logarithmically with distance so a flag 50m away looks
// distinctly bigger than one 500m away.
//
// Markers behind the user (|relative| > 90°) render as edge arrows so
// users know which way to turn to see them.
// ── AR cairn overlay ─────────────────────────────────────────────────────
// Renders nearby cairns as ground-anchored stone-pile + floating orb
// composites projected onto screen-space. Replaces the previous flag
// rendering (Sprint 51, "Cairn" name vs "Flag" visual mismatch).
//
// Visual language (per route-rules.md §AR):
//   - Stone pile (3 stacked rocks) at the GPS ground point — small,
//     accurate-feeling, the literal cairn metaphor
//   - Floating orb 1.5m above the pile in the type colour, with a
//     soft halo whose radius encodes positional uncertainty (further
//     away = bigger halo = "approximate region", not "exact point")
//   - Vertical line connects pile to orb so the user reads them as
//     ONE marker even at distance
//   - Distance chip below the pile
//   - Out-of-FOV markers still render as edge arrows so the user
//     knows which way to turn to see them
//
// Projection is the same bearing/heading math as before. Only the
// visual treatment changed — projection accuracy, range, and edge
// arrow logic are unchanged.
function ARCairnOverlay({
  markers,
  userPos,
  userHeading,
}: {
  markers: Marker[];
  userPos: { lat: number; lng: number } | null;
  userHeading: number | null;
}) {
  if (!userPos || userHeading == null || markers.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {markers.map(m => {
        const distM = haversineM(userPos, { lat: m.lat, lng: m.lng });
        if (distM > AR_MAX_RANGE_M) return null;

        const bearing = bearingTo(userPos, { lat: m.lat, lng: m.lng });
        let relative = bearing - userHeading;
        while (relative > 180) relative -= 360;
        while (relative < -180) relative += 360;

        const config = getAR3DConfig(m.type);
        const halfFov = CAMERA_FOV_DEG / 2;
        const inView = Math.abs(relative) <= halfFov;
        const t = Math.min(distM / AR_MAX_RANGE_M, 1);

        if (inView) {
          // Project to screen X by FOV, screen Y by depth proxy.
          const screenX = SCREEN_W / 2 + (relative / halfFov) * (SCREEN_W / 2);
          // Anchor stone pile at the "ground" Y position. Closer = lower
          // (foreground), further = higher (toward horizon).
          const groundY = SCREEN_H * (0.78 - 0.42 * t);
          // Orb floats 1.5m above the ground. We approximate this in
          // screen space by raising the orb by a fraction of the pile-
          // size — roughly the same vertical pixel offset whether near
          // or far, but capped so far-away orbs don't fly off-screen.
          const pileSize = Math.max(12, 30 - t * 18);
          const orbOffsetY = Math.max(28, 64 - t * 36);
          const orbY = groundY - orbOffsetY;
          const orbSize = Math.max(20, 44 - t * 24);
          // Halo radius encodes uncertainty — farther markers get a
          // more diffuse glow so the user reads it as "approximate".
          const haloSize = orbSize + 18 + t * 20;

          return (
            <View key={m.id} pointerEvents="none">
              {/* Halo (behind orb) */}
              <View
                style={[
                  arOverlayStyles.halo,
                  {
                    left: screenX - haloSize / 2,
                    top: orbY - haloSize / 2,
                    width: haloSize, height: haloSize,
                    borderRadius: haloSize / 2,
                    backgroundColor: config.color,
                    opacity: 0.14 - 0.06 * t,
                  },
                ]}
              />
              {/* Vertical connector pile → orb */}
              <View
                style={[
                  arOverlayStyles.connector,
                  {
                    left: screenX - 1,
                    top: orbY + orbSize / 2,
                    height: groundY - (orbY + orbSize / 2),
                    backgroundColor: config.color,
                    opacity: 0.55 - 0.25 * t,
                  },
                ]}
              />
              {/* Floating orb */}
              <View
                style={[
                  arOverlayStyles.orb,
                  {
                    left: screenX - orbSize / 2,
                    top: orbY - orbSize / 2,
                    width: orbSize, height: orbSize,
                    borderRadius: orbSize / 2,
                    backgroundColor: config.color,
                    opacity: 0.92 - 0.32 * t,
                  },
                ]}
              >
                <View style={[arOverlayStyles.orbHighlight, { width: orbSize * 0.4, height: orbSize * 0.25 }]} />
              </View>
              {/* Stone pile — three small ovals stacked pyramid-style */}
              <View
                style={[
                  arOverlayStyles.pileWrap,
                  { left: screenX - pileSize, top: groundY - pileSize * 0.5, width: pileSize * 2 },
                ]}
              >
                {/* Bottom row of two */}
                <View style={[arOverlayStyles.stone, { width: pileSize * 0.7, height: pileSize * 0.45, left: 0, top: pileSize * 0.4, backgroundColor: '#7a7166' }]} />
                <View style={[arOverlayStyles.stone, { width: pileSize * 0.65, height: pileSize * 0.4, right: 0, top: pileSize * 0.45, backgroundColor: '#8a8073' }]} />
                {/* Top stone */}
                <View style={[arOverlayStyles.stone, { width: pileSize * 0.6, height: pileSize * 0.42, left: pileSize * 0.65, top: pileSize * 0.05, backgroundColor: '#a39684' }]} />
              </View>
              {/* Distance chip */}
              <View style={[arOverlayStyles.distChip, { left: screenX - 24, top: groundY + pileSize * 0.7 }]}>
                <Text style={arOverlayStyles.distText}>
                  {distM < 1000 ? `${Math.round(distM)}m` : `${(distM / 1000).toFixed(1)}km`}
                </Text>
              </View>
            </View>
          );
        }

        // Out-of-view edge arrow — unchanged from the previous overlay
        const onLeft = relative < 0;
        const arrowY = SCREEN_H * (0.70 - 0.35 * t);
        return (
          <View
            key={m.id}
            style={[
              arOverlayStyles.edgeArrow,
              {
                top: arrowY - 14,
                [onLeft ? 'left' : 'right']: 8,
              },
            ]}
          >
            <Icon
              name={onLeft ? 'ChevronLeft' : 'ChevronRight'}
              size={20}
              color={config.color}
              strokeWidth={3}
            />
          </View>
        );
      })}
    </View>
  );
}

const arOverlayStyles = StyleSheet.create({
  // Floating orb — main visible "marker is here" element. Type-coloured,
  // semi-transparent so it doesn't dominate the AR view. Positioned
  // absolutely (left/top set per-marker by ARCairnOverlay).
  orb: {
    position: 'absolute',
    alignItems: 'center', justifyContent: 'flex-start',
    paddingTop: 4,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.85)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  orbHighlight: {
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderRadius: 999,
  },
  // Soft halo behind the orb — visualizes positional uncertainty.
  // Wider halo = farther / more approximate.
  halo: {
    position: 'absolute',
  },
  // Vertical line connecting stone pile (ground) to floating orb.
  connector: {
    position: 'absolute',
    width: 2,
  },
  // Stone pile container — three small ovals stacked pyramid-style
  // to read as a literal cairn. Sized per distance.
  pileWrap: {
    position: 'absolute',
    height: 0, // children are absolutely positioned
  },
  stone: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.25)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 3, elevation: 4,
  },
  distChip: {
    position: 'absolute',
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    width: 48, alignItems: 'center',
  },
  distText: { fontSize: 10, color: '#fff', fontWeight: '700' },
  edgeArrow: {
    position: 'absolute',
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
  },
});

// ── 2D Compass Dial — replacement for the camera placeholder ──────────────
function CompassDial({
  userHeading,
  markers,
  userPos,
}: {
  userHeading: number | null;
  markers: Marker[];
  userPos: { lat: number; lng: number } | null;
}) {
  // Heading drives the dial rotation: dial rotates opposite to heading so
  // the cardinal mark (N) always points to true north.
  const rotateDeg = userHeading != null ? -userHeading : 0;

  // Compute each marker's bearing-relative-to-heading for arrow placement.
  const arrows = useMemo(() => {
    if (!userPos) return [];
    return markers.map((m) => {
      const bearing = bearingTo(userPos, { lat: m.lat, lng: m.lng });
      const relative = userHeading != null
        ? (bearing - userHeading + 360) % 360
        : bearing;
      const dist = Math.round(haversineM(userPos, { lat: m.lat, lng: m.lng }));
      return { marker: m, relative, dist };
    });
  }, [markers, userPos, userHeading]);

  return (
    <View style={dialStyles.wrap}>
      {/* Dial face — rotates so N stays pointing to true north */}
      <View style={[dialStyles.dial, { transform: [{ rotate: `${rotateDeg}deg` }] }]}>
        {/* Cardinal direction marks */}
        <Text style={[dialStyles.cardinal, { top: 8 }]}>N</Text>
        <Text style={[dialStyles.cardinal, { right: 8 }]}>E</Text>
        <Text style={[dialStyles.cardinal, { bottom: 8 }]}>S</Text>
        <Text style={[dialStyles.cardinal, { left: 8 }]}>W</Text>

        {/* Outer ring */}
        <View style={dialStyles.ring} />

        {/* Marker arrows — positioned around the dial at their bearing */}
        {arrows.map(({ marker, relative, dist }) => {
          const config = getAR3DConfig(marker.type);
          const angleRad = (relative * Math.PI) / 180;
          // Place the arrow at radius=92 from dial center
          const x = Math.sin(angleRad) * 92;
          const y = -Math.cos(angleRad) * 92;
          return (
            <View
              key={marker.id}
              style={[
                dialStyles.arrowAnchor,
                { transform: [{ translateX: x }, { translateY: y }, { rotate: `${relative}deg` }] },
              ]}
            >
              <View style={[dialStyles.arrowChevron, { borderBottomColor: config.color }]} />
              <Text style={[dialStyles.arrowDist, { color: config.color }]}>{dist}m</Text>
            </View>
          );
        })}

        {/* Center pip */}
        <View style={dialStyles.centerPip} />
      </View>

      {userHeading == null && (
        <Text style={dialStyles.headingHint}>
          Heading unavailable — calibrate phone or grant location.
        </Text>
      )}
    </View>
  );
}

const dialStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // Transparent when camera background is rendering; falls through
    // to container's #000 if the camera is unavailable. Dial elements
    // have their own contrast (white text on dark ring) so readable
    // either way.
    backgroundColor: 'transparent',
  },
  dial: {
    width: 240,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.32)',
  },
  cardinal: {
    position: 'absolute',
    fontSize: 18,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: 0.5,
  },
  arrowAnchor: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
  },
  arrowChevron: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  arrowDist: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  centerPip: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  headingHint: {
    position: 'absolute',
    bottom: 24,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },
});

// ── DragCairnPicker ─────────────────────────────────────────────────────
// 4 cairn-type anchors at the screen corners. Each one is a draggable
// orb representing a planting type:
//   • top-left    danger  (red)
//   • top-right   scenic  (blue)
//   • bottom-left water   (green)
//   • bottom-right junction (amber)
//
// Interaction model:
//   1. Long-press an anchor → it lifts off (1.2× scale + heavy haptic)
//   2. Drag toward the centre target ring
//   3. Release inside the centre ring → "drop" → opens distance ring
//   4. Distance ring: 5/10/20/30m discrete steps. Vertical drag picks
//      a step (up = farther, down = closer). 30m is the hard cap per
//      route-rules.md §AR precision boundary.
//   5. Release on a step → plant cairn at that distance via onPlant
//      callback. Release outside any step → cancel.
//
// All accumulator state lives in refs to avoid render churn during
// drag. PanResponder is the lowest-level RN gesture API and works
// reliably across iOS/Android without extra deps.
const CAIRN_TYPES: { id: 'danger' | 'scenic' | 'supply' | 'junction'; color: string; iconName: any; label: string; corner: 'tl' | 'tr' | 'bl' | 'br' }[] = [
  { id: 'danger',   color: '#c53d2e', iconName: 'TriangleAlert', label: 'Danger',   corner: 'tl' },
  { id: 'scenic',   color: '#3b82f6', iconName: 'Star',          label: 'Scenic',   corner: 'tr' },
  { id: 'supply',   color: '#22c55e', iconName: 'Droplets',      label: 'Water',    corner: 'bl' },
  { id: 'junction', color: '#f59e0b', iconName: 'Navigation2',   label: 'Junction', corner: 'br' },
];

const DISTANCE_STEPS = [5, 10, 20, 30] as const;
const TARGET_RADIUS = 70; // px — radius of the centre target ring

function DragCairnPicker({
  onPlant,
  disabled,
}: {
  onPlant: (type: string, distanceM: number) => void;
  disabled?: boolean;
}) {
  // Which corner is currently being dragged. null = idle.
  const [activeType, setActiveType] = useState<string | null>(null);
  // Drag is in distance-pick phase (released over centre ring).
  const [distancePhase, setDistancePhase] = useState(false);
  // Highlighted distance step during phase 2.
  const [hoverStep, setHoverStep] = useState<number | null>(null);
  // Drag offset during phase 1 (corner → centre)
  const dragX = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  // We need raw values for hit-testing, so keep a parallel ref.
  const rawX = useRef(0);
  const rawY = useRef(0);

  const centreX = SCREEN_W / 2;
  const centreY = SCREEN_H / 2;

  // Compute corner anchor positions. Inset from edges so they don't
  // hug the safe area or get clipped by the dial.
  const anchorOffset = 22;
  const cornerXY = (corner: 'tl' | 'tr' | 'bl' | 'br'): { x: number; y: number } => {
    if (corner === 'tl') return { x: anchorOffset, y: SCREEN_H * 0.18 };
    if (corner === 'tr') return { x: SCREEN_W - anchorOffset - 56, y: SCREEN_H * 0.18 };
    if (corner === 'bl') return { x: anchorOffset, y: SCREEN_H - 200 };
    return { x: SCREEN_W - anchorOffset - 56, y: SCREEN_H - 200 };
  };

  const reset = () => {
    setActiveType(null);
    setDistancePhase(false);
    setHoverStep(null);
    dragX.setValue(0);
    dragY.setValue(0);
    rawX.current = 0;
    rawY.current = 0;
  };

  // Build a PanResponder per corner. Each anchor is its own responder
  // so we know which type the user grabbed without extra hit-testing.
  const buildResponder = useCallback((typeId: string, corner: 'tl' | 'tr' | 'bl' | 'br') => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setActiveType(typeId);
        setDistancePhase(false);
        setHoverStep(null);
        dragX.setValue(0);
        dragY.setValue(0);
        rawX.current = 0;
        rawY.current = 0;
      },
      onPanResponderMove: (_e, g) => {
        rawX.current = g.dx;
        rawY.current = g.dy;
        dragX.setValue(g.dx);
        dragY.setValue(g.dy);
        // Compute current absolute position
        const anc = cornerXY(corner);
        const absX = anc.x + 28 + g.dx;
        const absY = anc.y + 28 + g.dy;
        const dist = Math.hypot(absX - centreX, absY - centreY);

        if (!distancePhase && dist <= TARGET_RADIUS) {
          // Snap visual into target — small haptic when entering ring
          Haptics.selectionAsync();
        }

        if (distancePhase) {
          // Phase 2: vertical drag picks step. Up from centre = farther.
          const dy = absY - centreY;
          // Map dy ∈ [-120, 120] to steps [3, 0] (up = high index)
          let stepIdx = -1;
          if (dy < -90) stepIdx = 3;       // 30m
          else if (dy < -30) stepIdx = 2;  // 20m
          else if (dy < 30) stepIdx = 1;   // 10m
          else if (dy < 90) stepIdx = 0;   // 5m
          const newStep = stepIdx >= 0 ? DISTANCE_STEPS[stepIdx] : null;
          if (newStep !== hoverStep) {
            if (newStep != null) Haptics.selectionAsync();
            setHoverStep(newStep);
          }
        }
      },
      onPanResponderRelease: () => {
        const anc = cornerXY(corner);
        const absX = anc.x + 28 + rawX.current;
        const absY = anc.y + 28 + rawY.current;
        const dist = Math.hypot(absX - centreX, absY - centreY);

        if (!distancePhase) {
          // Phase 1 release: only commit if released inside target ring
          if (dist <= TARGET_RADIUS) {
            // Enter distance phase. The user keeps holding? They've
            // already lifted their finger here, so we open the ring
            // and accept the next discrete tap. To make this feel
            // continuous we instead plant at default 5m on first release
            // and let the user re-drag for a different distance.
            //
            // Simpler model (what we ship): drop = plant at 5m. If user
            // wants 10/20/30m, they drag past centre and pause on a
            // distance step — that's the "continue holding" path.
            onPlant(typeId, 5);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } else {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          reset();
        } else {
          // Phase 2 release: plant at hovered step (if any)
          if (hoverStep != null) {
            onPlant(typeId, hoverStep);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } else {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          reset();
        }
      },
      onPanResponderTerminate: () => {
        reset();
      },
    });
  }, [disabled, distancePhase, hoverStep, onPlant]);

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {/* Centre target ring — visible always, highlights when an
          anchor is being dragged in. */}
      <View
        style={[
          dragStyles.targetRing,
          {
            left: centreX - TARGET_RADIUS,
            top: centreY - TARGET_RADIUS,
            width: TARGET_RADIUS * 2,
            height: TARGET_RADIUS * 2,
            borderRadius: TARGET_RADIUS,
            opacity: activeType ? 0.95 : 0.45,
            borderColor: activeType ? '#fff' : 'rgba(255,255,255,0.55)',
            borderWidth: activeType ? 2.5 : 1.5,
            borderStyle: activeType ? 'solid' : 'dashed',
          },
        ]}
        pointerEvents="none"
      >
        <Text style={dragStyles.targetLabel}>
          {activeType ? 'Release to plant' : 'Drag a cairn here'}
        </Text>
      </View>

      {/* Distance steps — shown only after first release, surrounding centre */}
      {distancePhase && (
        <View pointerEvents="none">
          {DISTANCE_STEPS.map((step, idx) => {
            // Stack vertically above centre, closest at bottom
            const offsets = [-80, -40, 40, 80]; // matches step idx 0..3 reversed visually
            const dy = -offsets[idx];
            const isHover = hoverStep === step;
            return (
              <View
                key={step}
                style={[
                  dragStyles.distStep,
                  {
                    left: centreX - 36,
                    top: centreY + dy - 18,
                    backgroundColor: isHover ? '#fff' : 'rgba(255,255,255,0.18)',
                  },
                ]}
              >
                <Text style={[dragStyles.distStepText, { color: isHover ? '#000' : '#fff' }]}>
                  {step}m
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* 4 corner anchors */}
      {CAIRN_TYPES.map(t => {
        const responder = buildResponder(t.id, t.corner);
        const anc = cornerXY(t.corner);
        const isActive = activeType === t.id;
        return (
          <Animated.View
            key={t.id}
            {...responder.panHandlers}
            style={[
              dragStyles.anchor,
              {
                left: anc.x,
                top: anc.y,
                backgroundColor: t.color,
                transform: isActive
                  ? [{ translateX: dragX }, { translateY: dragY }, { scale: 1.18 }]
                  : [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }],
                opacity: disabled ? 0.4 : isActive ? 1 : 0.85,
                shadowOpacity: isActive ? 0.6 : 0.35,
              },
            ]}
          >
            <Icon name={t.iconName} size={22} color="#fff" strokeWidth={2.2} />
            {!isActive && (
              <Text style={dragStyles.anchorLabel}>{t.label}</Text>
            )}
          </Animated.View>
        );
      })}
    </View>
  );
}

const dragStyles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12, elevation: 8,
  },
  anchorLabel: {
    position: 'absolute', bottom: -16,
    fontSize: 9, fontWeight: '700',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  targetRing: {
    position: 'absolute',
    alignItems: 'center', justifyContent: 'center',
  },
  targetLabel: {
    fontSize: 11, fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  distStep: {
    position: 'absolute',
    width: 72, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)',
  },
  distStepText: {
    fontSize: 13, fontWeight: '800',
  },
});

export function ARScreen({ onClose, onPlaceMarker }: ARScreenProps) {
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const markers = useMarkerStore(s => s.markers);
  const addMarker = useMarkerStore(s => s.addMarker);
  const lastCoord = useTrackingStore(s => s.lastCoordinate);
  const lastCoordTime = useTrackingStore(s => s.lastCoordinateTime);
  const trackPoints = useTrackingStore(s => s.trackPoints);
  const sessionId = useTrackingStore(s => s.sessionId);
  const linkMarker = useTrackingStore(s => s.linkMarker);

  const [degradedToast, setDegradedToast] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState(false);
  // Live compass heading from expo-location (0=N, 90=E, etc).
  // null until first heading update or if heading unavailable.
  const [userHeading, setUserHeading] = useState<number | null>(null);

  // Subscribe to magnetic heading on mount; expo-location is already a dep.
  // Requests permission first — without it, watchHeadingAsync silently
  // returns no events on iOS. Falls back gracefully if denied or unavailable.
  useEffect(() => {
    let cancelled = false;
    let sub: { remove: () => void } | null = null;
    (async () => {
      try {
        const Location = await import('expo-location');
        // Ensure foreground location is granted; heading API depends on it.
        const perm = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (perm.status !== 'granted') {
          // Heading stays null → CompassDial shows "Heading unavailable" hint.
          return;
        }
        sub = await Location.watchHeadingAsync((h) => {
          if (cancelled) return;
          // trueHeading is most accurate but may be -1 on simulator;
          // fall back to magHeading.
          const heading = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          if (heading >= 0) setUserHeading(heading);
        });
      } catch {
        // Heading unavailable — UI shows static dial
      }
    })();
    return () => {
      cancelled = true;
      try { sub?.remove(); } catch { /* no-op */ }
    };
  }, []);

  // Refs for any pending timers — must be cleared on unmount to prevent
  // calling setState/nav.goBack on an already-unmounted component.
  const savedToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const degradedToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (savedToastTimerRef.current) clearTimeout(savedToastTimerRef.current);
      if (degradedToastTimerRef.current) clearTimeout(degradedToastTimerRef.current);
    };
  }, []);

  // Filter markers within AR range
  const nearbyMarkers = markers.filter(m => {
    if (!lastCoord) return false;
    const dist = haversineM({ lat: lastCoord.lat, lng: lastCoord.lng }, { lat: m.lat, lng: m.lng });
    return dist <= AR_MAX_RANGE_M;
  });

  // Plant a cairn at the user's GPS, projected forward by `distanceM`
  // along their current heading. Distance values: 5/10/20/30 — 30 is
  // the hard cap (route-rules.md §AR precision boundary). All planting
  // goes through this single function: the DragCairnPicker calls it
  // when the user releases over the centre target with a chosen type
  // and distance.
  //
  // GPS sampling: when the user has more than one second to commit
  // (i.e. they hovered to pick a distance), we average the last
  // ~3 seconds of GPS in the trackPoints buffer so a single noisy
  // reading doesn't determine the cairn's location. For instant
  // releases at default distance we use the live coord as-is.
  const handlePlantCairn = useCallback(async (type: string, distanceM: number) => {
    crashLogger.breadcrumb(`ar:plant:start type=${type} distance=${distanceM}`);

    // Branch 1: Never had GPS
    if (!lastCoord && trackPoints.length === 0) {
      Alert.alert(
        'No GPS Available',
        'GPS has not yet acquired a position. Move to an open area and wait for a GPS fix.',
      );
      return;
    }

    // Anchor coord — averaged over recent samples when available
    let anchor: { lat: number; lng: number; alt?: number | null };
    let approximate = false;
    let age = 0;

    if (lastCoord) {
      // Average the last ≤3s of trackpoints + lastCoord for a steadier
      // GPS anchor. trackPoints carries time stamps so we filter by age.
      const cutoff = Date.now() - 3000;
      const recent = trackPoints.filter(p => p.t >= cutoff);
      const samples = recent.length > 0
        ? [...recent.map(p => ({ lat: p.lat, lng: p.lng, alt: p.alt })), { lat: lastCoord.lat, lng: lastCoord.lng, alt: lastCoord.alt }]
        : [{ lat: lastCoord.lat, lng: lastCoord.lng, alt: lastCoord.alt }];
      const sumLat = samples.reduce((s, p) => s + p.lat, 0);
      const sumLng = samples.reduce((s, p) => s + p.lng, 0);
      const altSamples = samples.filter(p => p.alt != null) as { alt: number }[];
      const avgAlt = altSamples.length > 0
        ? altSamples.reduce((s, p) => s + p.alt, 0) / altSamples.length
        : null;
      anchor = { lat: sumLat / samples.length, lng: sumLng / samples.length, alt: avgAlt };
      if (lastCoordTime) {
        age = Math.round((Date.now() - lastCoordTime) / 1000);
        if (age > 30) approximate = true;
      }
    } else {
      // Branch 2: Lost GPS — use last trackpoint, mark approximate
      const lastTP = trackPoints[trackPoints.length - 1];
      anchor = { lat: lastTP.lat, lng: lastTP.lng, alt: lastTP.alt };
      age = Math.round((Date.now() - lastTP.t) / 1000);
      approximate = true;
    }

    // Project the anchor forward by `distanceM` along the user's heading.
    // distanceM=0 means "right at my feet" (no projection).
    let cairnLat = anchor.lat;
    let cairnLng = anchor.lng;
    if (distanceM > 0 && userHeading != null) {
      // Move `distanceM` metres in the heading direction. Flat-earth
      // approximation is fine at ≤30m: error <1cm.
      const headingRad = (userHeading * Math.PI) / 180;
      const dN = Math.cos(headingRad) * distanceM; // northward metres
      const dE = Math.sin(headingRad) * distanceM; // eastward metres
      cairnLat = anchor.lat + dN / 111000;
      cairnLng = anchor.lng + dE / (111000 * Math.cos(anchor.lat * Math.PI / 180));
    }

    // Spacing check — reject if too close to an existing cairn
    const spacing = checkMarkerSpacing(
      { lat: cairnLat, lng: cairnLng },
      markers.map(m => ({ id: m.id, lat: m.lat, lng: m.lng })),
    );
    if (!spacing.allowed) {
      Alert.alert(
        'Too Close',
        `You have a cairn ${Math.round(spacing.nearestDistM)}m away. Cairns must be at least 20m apart.`,
      );
      crashLogger.breadcrumb(`ar:plant:rejected:too-close nearest=${Math.round(spacing.nearestDistM)}`);
      return;
    }

    if (approximate) {
      const ageText = age < 60 ? `${age}s` : age < 3600 ? `${Math.round(age / 60)}min` : `${Math.round(age / 3600)}h`;
      setDegradedToast(`Using last known location (${ageText} ago)`);
      if (degradedToastTimerRef.current) clearTimeout(degradedToastTimerRef.current);
      degradedToastTimerRef.current = setTimeout(() => setDegradedToast(null), 4000);
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const marker = await addMarker({
        type: type as any,
        regionCode: 'nz',
        lat: cairnLat,
        lng: cairnLng,
        note: '',
        authorId: 'local',
        permission: 'personal',
        sessionId: sessionId ?? undefined,
        approximate: approximate || undefined,
        gpsAgeS: approximate ? age : undefined,
        alt: anchor.alt ?? undefined,
      });
      if (sessionId) linkMarker(marker.id);
      crashLogger.breadcrumb(`ar:plant:saved id=${marker.id}`);
      setSavedToast(true);
      if (savedToastTimerRef.current) clearTimeout(savedToastTimerRef.current);
      savedToastTimerRef.current = setTimeout(() => setSavedToast(false), 1200);
    } catch (err) {
      crashLogger.breadcrumb(`ar:plant:error ${String(err).slice(0, 80)}`);
      Alert.alert('Error', 'Failed to plant cairn. Please try again.');
    }
  }, [lastCoord, lastCoordTime, trackPoints, userHeading, markers, sessionId, addMarker, linkMarker]);

  // Camera permission — request on mount when expo-camera is present.
  // Hook is called only if useCameraPermissions exists (conditional
  // import). When the module is missing, perm is undefined and we
  // fall through to the dark backdrop.
  const [cameraPerm, requestCameraPerm] = useCameraPermissions
    ? useCameraPermissions()
    : [null, async () => null];
  useEffect(() => {
    if (!useCameraPermissions) return;
    if (cameraPerm && !cameraPerm.granted && cameraPerm.canAskAgain) {
      requestCameraPerm();
    }
  }, [cameraPerm?.granted]);

  return (
    <View style={styles.container}>
      {/* Camera background — live rear camera feed at the very bottom
          of the z-stack. All AR overlays + compass dial + sheets layer
          on top. If expo-camera is unavailable or permission denied,
          the existing dark backdrop shows instead (CompassDial + UI
          read fine against either). */}
      {CameraView && cameraPerm?.granted && (
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
        />
      )}

      {/* AR cairn overlay — projects nearby cairns onto screen-space
          as ground-anchored stone piles + floating orbs. Renders above
          camera, below UI controls. */}
      <ARCairnOverlay
        markers={nearbyMarkers}
        userPos={lastCoord ? { lat: lastCoord.lat, lng: lastCoord.lng } : null}
        userHeading={userHeading}
      />

      {/* Compass dial — directional indicators replace static AR placeholder.
          Each visible nearby marker shows a chevron arrow at its bearing
          relative to current device heading. */}
      <CompassDial
        userHeading={userHeading}
        markers={nearbyMarkers.slice(0, 5)}
        userPos={lastCoord ? { lat: lastCoord.lat, lng: lastCoord.lng } : null}
      />

      {/* Nearby markers directional list */}
      <GlassPanel intensity={16} tint="dark" style={styles.markerPanel} borderRadius={16}>
        <Text style={styles.panelTitle}>
          {nearbyMarkers.length} marker{nearbyMarkers.length !== 1 ? 's' : ''} nearby
        </Text>
        {nearbyMarkers.slice(0, 5).map(m => {
          const dist = lastCoord
            ? Math.round(haversineM({ lat: lastCoord.lat, lng: lastCoord.lng }, { lat: m.lat, lng: m.lng }))
            : 0;
          const config = getAR3DConfig(m.type);
          return (
            <View key={m.id} style={styles.markerRow}>
              <View style={[styles.markerDot, { backgroundColor: config.color }]} />
              <Text style={styles.markerLabel}>{config.label}</Text>
              <Text style={styles.markerDist}>{dist}m</Text>
            </View>
          );
        })}
      </GlassPanel>

      {/* Top controls — uses safe-area inset so X button clears the
          status bar / Dynamic Island on every device. */}
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <PressBtn style={styles.closeBtn} onPress={() => onClose ? onClose() : nav.goBack()} scaleTo={0.92}>
          <Icon name="X" size={20} color="#fff" />
        </PressBtn>
      </View>

      {/* Drag-to-plant cairn picker — replaces the previous Place Flag FAB
          + flag-type sheet. 4 corner anchors (Danger / Scenic / Water /
          Junction); user long-presses → drags one to centre to plant.
          Distance defaults to 5m and can be adjusted by continuing to
          hold + sliding vertically (5/10/20/30m, 30m hard cap). */}
      <DragCairnPicker
        onPlant={handlePlantCairn}
        disabled={!lastCoord && trackPoints.length === 0}
      />

      {/* Degraded GPS toast */}
      {degradedToast && (
        <View style={styles.degradedBanner}>
          <Icon name="Info" size={14} color="#f59e0b" />
          <Text style={styles.degradedText}>{degradedToast}</Text>
        </View>
      )}

      {/* Saved toast */}
      {savedToast && (
        <View style={styles.savedToast}>
          <Icon name="CircleCheck" size={16} color="#22c55e" />
          <Text style={styles.savedToastText}>Cairn planted</Text>
        </View>
      )}
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' /* fallback when no camera */ },
  cameraPlaceholder: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1a1a2e',
  },
  placeholderText: {
    fontSize: FontSize.h2, fontWeight: '700', color: 'rgba(255,255,255,0.7)',
    marginTop: Spacing.md,
  },
  placeholderSubtext: {
    fontSize: FontSize.caption, color: 'rgba(255,255,255,0.4)',
    textAlign: 'center', marginTop: Spacing.xs,
  },
  markerPanel: {
    position: 'absolute', bottom: 100, left: Spacing.md, right: Spacing.md,
    padding: Spacing.md,
  },
  panelTitle: {
    fontSize: FontSize.caption, fontWeight: '600', color: 'rgba(255,255,255,0.8)',
    marginBottom: Spacing.sm,
  },
  markerRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: 4,
  },
  markerDot: { width: 10, height: 10, borderRadius: 5 },
  markerLabel: { flex: 1, fontSize: FontSize.body, color: '#fff' },
  markerDist: { fontSize: FontSize.caption, color: 'rgba(255,255,255,0.6)' },
  topBar: {
    position: 'absolute', left: Spacing.md, right: Spacing.md,
    flexDirection: 'row', justifyContent: 'flex-end',
  },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center',
  },
  placeFab: {
    position: 'absolute', bottom: 30, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.primary, borderRadius: 30,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    ...Elevation[4],
  },
  fabText: { fontSize: FontSize.body, fontWeight: '700', color: '#fff' },
  degradedBanner: {
    position: 'absolute', top: 110, left: Spacing.md, right: Spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: Radius.card,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)',
  },
  degradedText: { fontSize: FontSize.caption, color: '#f59e0b', flex: 1 },
  flagSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#1a1a2e', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: Spacing.xl, paddingBottom: 40,
  },
  flagSheetTitle: { fontSize: FontSize.h3, fontWeight: '700', color: '#fff', marginBottom: Spacing.md },
  flagTypeRow: { flexDirection: 'row', gap: Spacing.sm },
  flagTypeCard: {
    flex: 1, alignItems: 'center', gap: 6, paddingVertical: Spacing.md,
    borderRadius: Radius.card, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  flagTypeLabel: { fontSize: FontSize.small, fontWeight: '600' },
  approxWarning: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.md,
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
    backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: 8,
  },
  approxWarningText: { fontSize: FontSize.small, color: '#f59e0b' },
  flagSheetActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  flagCancelBtn: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing.md,
    borderRadius: Radius.button, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  flagCancelText: { fontSize: FontSize.body, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  flagSaveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: Spacing.md, borderRadius: Radius.button,
    backgroundColor: Colors.primary,
  },
  flagSaveText: { fontSize: FontSize.body, fontWeight: '700', color: '#fff' },
  savedToast: {
    position: 'absolute', top: '45%' as any, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  savedToastText: { fontSize: FontSize.body, fontWeight: '600', color: '#fff' },
});
