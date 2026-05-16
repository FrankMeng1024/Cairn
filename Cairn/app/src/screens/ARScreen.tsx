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
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, FontSize, Radius } from '../components/tokens';
import { Icon } from '../components/Icon';
import { GlassPanel, Elevation } from '../components/GlassPanel';
import { useMarkerStore, type Marker } from '../store/useMarkerStore';
import { useTrackingStore } from '../store/useTrackingStore';
import { haversineM, type Coordinate } from '../utils/geo';
import { filterContent, type ContentLevel } from '../services/contentFilter';
import { checkMarkerSpacing } from '../utils/geo';

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
  onClose: () => void;
  onPlaceMarker?: (lat: number, lng: number) => void;
}

/**
 * AR Screen — currently renders a compass-based directional view.
 * Full 3D AR rendering requires @viro-community/react-viro + EAS native build.
 *
 * This fallback shows:
 * - Camera background (expo-camera if available)
 * - Directional indicators for nearby markers (bearing + distance)
 * - Place marker button
 */
export function ARScreen({ onClose, onPlaceMarker }: ARScreenProps) {
  const markers = useMarkerStore(s => s.markers);
  const lastCoord = useTrackingStore(s => s.lastCoordinate);

  // Filter markers within AR range
  const nearbyMarkers = markers.filter(m => {
    if (!lastCoord) return false;
    const dist = haversineM({ lat: lastCoord.lat, lng: lastCoord.lng }, { lat: m.lat, lng: m.lng });
    return dist <= AR_MAX_RANGE_M;
  });

  const handlePlaceMarker = () => {
    if (!lastCoord) {
      Alert.alert('GPS Required', 'Waiting for GPS signal to place marker.');
      return;
    }

    // Check spacing
    const spacing = checkMarkerSpacing(
      { lat: lastCoord.lat, lng: lastCoord.lng },
      markers.map(m => ({ id: m.id, lat: m.lat, lng: m.lng })),
    );

    if (!spacing.allowed) {
      Alert.alert(
        'Too Close',
        `You have a marker ${Math.round(spacing.nearestDistM)}m away. Markers must be at least 20m apart.`,
      );
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPlaceMarker?.(lastCoord.lat, lastCoord.lng);
  };

  return (
    <View style={styles.container}>
      {/* AR camera placeholder — full 3D requires native build */}
      <View style={styles.cameraPlaceholder}>
        <Icon name="Target" size={48} color="rgba(255,255,255,0.5)" />
        <Text style={styles.placeholderText}>AR Camera View</Text>
        <Text style={styles.placeholderSubtext}>
          Full 3D AR requires native build.{'\n'}
          Showing directional indicators.
        </Text>
      </View>

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

      {/* Top controls */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Icon name="X" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Place marker FAB */}
      <TouchableOpacity style={styles.placeFab} onPress={handlePlaceMarker}>
        <Icon name="MapPin" size={24} color="#fff" />
        <Text style={styles.fabText}>Place Flag</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
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
    position: 'absolute', top: 60, left: Spacing.md, right: Spacing.md,
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
});
