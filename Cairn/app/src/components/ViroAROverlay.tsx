/**
 * ViroAROverlay — Cairn AR via @reactvision/react-viro (ARKit world tracking).
 *
 * v54 — re-enabled after v50 crash diagnostics traced to React 19.2 vs RN 0.81's
 * react-native-renderer 19.1 mismatch (NOT module top-level Viro calls).
 * Crash log captured by crashLogger uploaded to telemetry showed:
 *   "Incompatible React versions: react 19.2.6 vs react-native-renderer 19.1.0"
 * v53 fixed by downgrading react to 19.1.0. v54 reintroduces Viro.
 *
 * Defensive design: Viro NativeModule calls (createMaterials, registerAnimations)
 * are deferred to useEffect inside the AR scene component, not module top-level.
 * This way, even if RN bridge has init timing quirks, we wait for component mount
 * (which only happens after RN is fully ready).
 *
 * GPS lock: each marker's lat/lng/alt converted to ARKit world coordinates ONCE
 * at session start (using arkitOriginGPS). ARKit VIO tracks camera movement
 * thereafter; cairns stay locked in world space (sub-cm precision).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  ViroARScene,
  ViroARSceneNavigator,
  ViroSphere,
  ViroNode,
  ViroAmbientLight,
  ViroDirectionalLight,
  ViroMaterials,
  ViroAnimations,
  ViroTrackingStateConstants,
  type ViroTrackingState,
  type ViroTrackingReason,
} from '@reactvision/react-viro';
import type { Marker } from '../store/useMarkerStore';
import { crashLogger } from '../services/crashLogger';

// ── Type colours (matches r3f impl) ─────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  danger: '#ff5a3a',
  scenic: '#3ad8a4',
  supply: '#6ac8f0',
  junction: '#f0a838',
};

// ── Constants ──────────────────────────────────────────────────
const ORB_RADIUS = 0.4;       // 80cm diameter (~2x basketball)
const ORB_HEIGHT_M = 1.5;     // hover 1.5m above ground
const ALT_THRESHOLD_M = 5;    // GPS alt noise floor; ignore differences below this
const VISIBLE_RANGE_M = 100;  // hide cairns farther than this

// Defensive: NO module top-level Viro NativeModule calls (createMaterials /
// registerAnimations) — they're done inside ARScene component's useEffect.
// (v50 crash was diagnosed as React version mismatch, not module top-level
// calls, but this defensive style is RN best practice anyway.)

// ── GPS → ARKit world conversion ───────────────────────────────
// ARKit worldAlignment="GravityAndHeading" gives:
//   +X = East, -Z = North, +Y = Up (gravity-aligned)
function gpsToArWorld(
  origin: { lat: number; lng: number; alt?: number | null },
  target: { lat: number; lng: number; alt?: number | null },
): [number, number, number] {
  const dLat = target.lat - origin.lat;
  const dLng = target.lng - origin.lng;
  const cosLat = Math.cos((origin.lat * Math.PI) / 180);
  const eastM = dLng * 111000 * cosLat;
  const northM = dLat * 111000;
  const dAlt = (target.alt ?? 0) - (origin.alt ?? 0);
  const altY = Math.abs(dAlt) < ALT_THRESHOLD_M ? 0 : dAlt;
  return [eastM, ORB_HEIGHT_M + altY, -northM];
}

interface Props {
  markers: Marker[];
  userPos: { lat: number; lng: number; alt?: number | null } | null;
  userHeading: number | null;
  onStatus?: (status: { glReady: boolean; cairnCount: number }) => void;
  onCairnPress?: (markerId: string) => void;
}

// ─────────────────────────────────────────────────────────────────
// AR scene — receives arkitOrigin + markers via viroAppProps
// ─────────────────────────────────────────────────────────────────
function CairnARScene(props: any) {
  const sceneProps = (props.sceneNavigator?.viroAppProps ?? {}) as {
    arkitOrigin: { lat: number; lng: number; alt?: number | null };
    markers: Marker[];
    onCairnPress?: (id: string) => void;
  };
  const { arkitOrigin, markers, onCairnPress } = sceneProps;
  const [tracking, setTracking] = useState(false);
  const [materialsReady, setMaterialsReady] = useState(false);

  // Register Viro materials + animations on first scene mount.
  // Deliberately NOT at module top-level (defensive RN best practice).
  useEffect(() => {
    try {
      ViroMaterials.createMaterials({
        cairnDanger:   { lightingModel: 'Lambert', diffuseColor: TYPE_COLORS.danger },
        cairnScenic:   { lightingModel: 'Lambert', diffuseColor: TYPE_COLORS.scenic },
        cairnSupply:   { lightingModel: 'Lambert', diffuseColor: TYPE_COLORS.supply },
        cairnJunction: { lightingModel: 'Lambert', diffuseColor: TYPE_COLORS.junction },
      });
      ViroAnimations.registerAnimations({
        pulse: {
          properties: { scaleX: 1.12, scaleY: 1.12, scaleZ: 1.12 },
          duration: 1200,
          easing: 'EaseInEaseOut',
        },
      });
      crashLogger.breadcrumb('viro:materials-registered');
      setMaterialsReady(true);
    } catch (err: any) {
      crashLogger.breadcrumb(`viro:materials-error ${String(err?.message || err).slice(0, 100)}`);
    }
  }, []);

  const onTrackingUpdated = (state: ViroTrackingState, _reason: ViroTrackingReason) => {
    const ok = state === ViroTrackingStateConstants.TRACKING_NORMAL;
    setTracking(ok);
    crashLogger.breadcrumb(`viro:tracking state=${state} ok=${ok}`);
  };

  const cairnNodes = useMemo(() => {
    if (!arkitOrigin) return [];
    return markers
      .map((m) => {
        const [x, y, z] = gpsToArWorld(arkitOrigin, m);
        const horizontal = Math.hypot(x, z);
        if (horizontal > VISIBLE_RANGE_M) return null;
        return { id: m.id, type: m.type, x, y, z, dist: horizontal };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
  }, [markers, arkitOrigin?.lat, arkitOrigin?.lng, arkitOrigin?.alt]);

  useEffect(() => {
    crashLogger.breadcrumb(
      `viro:scene:cairns origin=(${arkitOrigin?.lat?.toFixed(6)},${arkitOrigin?.lng?.toFixed(6)}) count=${cairnNodes.length}`
    );
  }, [cairnNodes.length, arkitOrigin?.lat, arkitOrigin?.lng]);

  return (
    <ViroARScene onTrackingUpdated={onTrackingUpdated}>
      <ViroAmbientLight color="#ffffff" intensity={400} />
      <ViroDirectionalLight color="#ffffff" direction={[0, -1, -0.2]} intensity={800} />
      {materialsReady && cairnNodes.map((c) => {
        const matName =
          c.type === 'danger' ? 'cairnDanger' :
          c.type === 'scenic' ? 'cairnScenic' :
          c.type === 'supply' ? 'cairnSupply' :
          'cairnJunction';
        return (
          <ViroNode
            key={c.id}
            position={[c.x, c.y, c.z]}
            onClick={() => {
              crashLogger.breadcrumb(`viro:cairn:press id=${c.id.slice(-6)}`);
              onCairnPress?.(c.id);
            }}
            animation={{ name: 'pulse', run: tracking, loop: true }}
          >
            <ViroSphere
              radius={ORB_RADIUS}
              widthSegmentCount={24}
              heightSegmentCount={24}
              materials={[matName]}
            />
          </ViroNode>
        );
      })}
    </ViroARScene>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────
export function ViroAROverlay({
  markers,
  userPos,
  userHeading: _userHeading,
  onStatus,
  onCairnPress,
}: Props) {
  const arkitOriginRef = useRef<{ lat: number; lng: number; alt?: number | null } | null>(null);
  const [originReady, setOriginReady] = useState(false);

  useEffect(() => {
    if (!arkitOriginRef.current && userPos) {
      arkitOriginRef.current = { ...userPos };
      setOriginReady(true);
      crashLogger.breadcrumb(
        `viro:origin-set lat=${userPos.lat.toFixed(6)} lng=${userPos.lng.toFixed(6)} alt=${userPos.alt ?? 'null'}`
      );
    }
  }, [userPos?.lat, userPos?.lng, userPos?.alt]);

  useEffect(() => {
    if (onStatus) onStatus({ glReady: originReady, cairnCount: markers.length });
  }, [markers.length, onStatus, originReady]);

  useEffect(() => {
    crashLogger.breadcrumb(`viro:overlay-mount markers=${markers.length}`);
    return () => { crashLogger.breadcrumb(`viro:overlay-unmount`); };
  }, []);

  if (!userPos || !arkitOriginRef.current) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      <ViroARSceneNavigator
        autofocus
        worldAlignment="GravityAndHeading"
        provider="none"
        initialScene={{ scene: CairnARScene as any }}
        viroAppProps={{
          arkitOrigin: arkitOriginRef.current,
          markers,
          onCairnPress,
        }}
        style={StyleSheet.absoluteFillObject}
      />
    </View>
  );
}
