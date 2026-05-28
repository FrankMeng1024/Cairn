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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  ViroARScene,
  ViroARSceneNavigator,
  ViroSphere,
  ViroBox,
  ViroQuad,
  ViroNode,
  ViroGeometry,
  ViroText,
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

// ── Type colours (matches cairn_icons_3d demo) ───────────────────
// 3-layer gradient: inner (bright core) → mid (signature colour) → outer (deep rim)
const TYPE_COLOR_TRIPLET: Record<string, { inner: string; mid: string; outer: string }> = {
  danger:   { inner: '#fff0c8', mid: '#ff5a3a', outer: '#8a2218' },
  scenic:   { inner: '#eefff4', mid: '#3ad8a4', outer: '#186a82' },
  supply:   { inner: '#f0faff', mid: '#6ac8f0', outer: '#2a5878' },
  junction: { inner: '#fff4d8', mid: '#f0a838', outer: '#8a4a18' },
  // v70: catch-all for legacy/non-typed markers (`cairn`, `free`, empty).
  // Renders a neutral grey orb so the user doesn't see junction-orange
  // by accident. Geometry falls back to a sphere (no icon shape).
  generic:  { inner: '#f0f0f0', mid: '#9aa0a6', outer: '#3a3d40' },
};
// Legacy single-color map kept for backwards compatibility — same mid colour.
const TYPE_COLORS: Record<string, string> = {
  danger:   TYPE_COLOR_TRIPLET.danger.mid,
  scenic:   TYPE_COLOR_TRIPLET.scenic.mid,
  supply:   TYPE_COLOR_TRIPLET.supply.mid,
  junction: TYPE_COLOR_TRIPLET.junction.mid,
};

// v84: hex '#rrggbb' → [r, g, b] 0..1 vec3 for shader uniform.
// Used by icon material's Fresnel shaderModifier.
function hexToVec3(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return [r, g, b];
}

// ── Constants ──────────────────────────────────────────────────
const ORB_RADIUS = 0.4;       // 80cm diameter (~2x basketball)
// v68: cairn Y is now relative to ARKit camera Y at origin time, not "1.5m
// above ground". Reason: ARKit Y=0 is wherever the phone was when origin was
// set — could be 2nd floor, on a hill, in a basement. Anchoring to physical
// ground requires plane detection (which we don't run). Easiest robust rule:
// place the cairn slightly BELOW eye level (-0.2m) so user can see it as if
// it's standing in front of them. Works on flat ground, in buildings, on
// stairs — visual position always feels natural relative to where they're
// looking.
//
// v70: ORB_EYE_OFFSET_M is now only used as a legacy fallback in
// gpsToArWorld() when no ARKit plane has been detected yet. The real Y for
// cairns is computed in cairnNodes useMemo using groundYRef + 1.5m.
const ORB_EYE_OFFSET_M = -0.2;
const ALT_THRESHOLD_M = 5;    // GPS alt noise floor (deprecated — kept for safety, unused below)
// v70: render 3D orb only within 30m. Beyond 30m, off-screen edge arrows
// (in CairnEdgeArrows) up to 300m. Beyond 300m, marker is hidden entirely.
// Reason: 5km made the AR view feel cluttered with distant cairns the user
// couldn't actually see anyway.
const VISIBLE_RANGE_M = 30;
const ICON_SCALE = 0.7;        // v82: 2.0 → 0.7. v81 的 2.0 撑爆屏幕(icon 半径 0.48m → 直径 ~1m 挂在 1-2m 远处占满半屏)，且只缩放 icon 不缩放 halo/shell/粒子，导致 icon 比 halo(0.55) 还大彻底遮挡光晕。0.7 让 icon 半径 ≈ 0.17m，远小于 halo 0.55，光晕可见。reference HTML 是给整个 orb group 1.55x，我们只缩 icon。
const PARTICLE_COUNT = 50;     // v70: bumped 30 → 50 (denser orbit)
const PARTICLE_RADIUS = 0.018; // v70: slightly larger particles for more presence

// ── 4 icon geometries ──────────────────────────────────────────
// Each function returns { vertices, triangleIndices } in the format
// expected by <ViroGeometry vertices=... triangleIndices=...>.
// All math runs once at module load (these are constants).
//
// Coordinate convention: +Y = up, +Z = front (icon faces +Z).
function buildDangerGeom() {
  // Translucent triangular prism, apex up, axis along Z (faces front+back).
  // v84: D 0.10 → 0.20 (加厚 100%) — 自旋时三棱柱侧面更厚实
  const R = 0.26, D = 0.20;
  // Front triangle (z = +D), back triangle (z = -D)
  const a = -Math.PI / 2;       // start at top
  const v0: [number, number, number] = [Math.cos(a) * R, Math.sin(a) * R + R * 0.1,  D];
  const v1: [number, number, number] = [Math.cos(a + 2.094) * R, Math.sin(a + 2.094) * R, D];
  const v2: [number, number, number] = [Math.cos(a + 4.189) * R, Math.sin(a + 4.189) * R, D];
  const v3: [number, number, number] = [v0[0], v0[1], -D];
  const v4: [number, number, number] = [v1[0], v1[1], -D];
  const v5: [number, number, number] = [v2[0], v2[1], -D];
  return {
    vertices: [v0, v1, v2, v3, v4, v5],
    triangleIndices: [
      [0, 2, 1], [3, 4, 5],         // front + back
      [0, 1, 4], [0, 4, 3],         // left side
      [1, 2, 5], [1, 5, 4],         // bottom side
      [2, 0, 3], [2, 3, 5],         // right side
    ] as [number, number, number][],
  };
}

function buildScenicGeom() {
  // True 3D 5-pointed star: front/back centres + 10 perimeter alternating outer/inner
  // v84: depth 0.07 → 0.16 (加厚 130%) — 让侧面厚度可见，自旋时不像贴纸
  const outerR = 0.24, innerR = 0.10, depth = 0.16;
  const N = 5;
  const verts: [number, number, number][] = [
    [0, 0,  depth],
    [0, 0, -depth],
  ];
  for (let i = 0; i < N * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const ang = (i / (N * 2)) * Math.PI * 2 - Math.PI / 2;
    verts.push([Math.cos(ang) * r, Math.sin(ang) * r, 0]);
  }
  const idx: [number, number, number][] = [];
  const P0 = 2;
  for (let i = 0; i < N * 2; i++) {
    const a = P0 + i;
    const b = P0 + ((i + 1) % (N * 2));
    idx.push([0, b, a]);
    idx.push([1, a, b]);
  }
  return { vertices: verts, triangleIndices: idx };
}

function buildSupplyGeom() {
  // Lathed water droplet — pointed top, fat bottom
  const segs = 14, sides = 14;
  const TOP_Y = 0.26, BOT_Y = -0.20, MAX_R = 0.16;
  const profile: { y: number; r: number }[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const y = TOP_Y + (BOT_Y - TOP_Y) * t;
    const tEff = Math.pow(t, 1.55);
    const r = MAX_R * Math.pow(Math.sin(tEff * Math.PI), 0.85);
    profile.push({ y, r: (i === 0 || i === segs) ? 0.0001 : Math.max(r, 0.0001) });
  }
  const verts: [number, number, number][] = [];
  for (let i = 0; i <= segs; i++) {
    for (let j = 0; j < sides; j++) {
      const ang = (j / sides) * Math.PI * 2;
      const p = profile[i];
      verts.push([Math.cos(ang) * p.r, p.y, Math.sin(ang) * p.r]);
    }
  }
  const idx: [number, number, number][] = [];
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < sides; j++) {
      const a = i * sides + j;
      const b = i * sides + (j + 1) % sides;
      const c = (i + 1) * sides + j;
      const d = (i + 1) * sides + (j + 1) % sides;
      idx.push([a, b, d]);
      idx.push([a, d, c]);
    }
  }
  return { vertices: verts, triangleIndices: idx };
}

function buildJunctionGeom() {
  // Combined arrow: foot (rotated box) + shaft (rotated box) + 4-sided pyramid head
  const verts: [number, number, number][] = [];
  const idx: [number, number, number][] = [];
  function pushBoxRot45(cy: number, hw: number, hh: number, hd: number) {
    const start = verts.length;
    const c = Math.cos(Math.PI / 4), s = Math.sin(Math.PI / 4);
    const rot = (x: number, y: number, z: number): [number, number, number] => [x * c - z * s, y, x * s + z * c];
    verts.push(rot(-hw, cy - hh, -hd));
    verts.push(rot( hw, cy - hh, -hd));
    verts.push(rot( hw, cy - hh,  hd));
    verts.push(rot(-hw, cy - hh,  hd));
    verts.push(rot(-hw, cy + hh, -hd));
    verts.push(rot( hw, cy + hh, -hd));
    verts.push(rot( hw, cy + hh,  hd));
    verts.push(rot(-hw, cy + hh,  hd));
    const o = start;
    idx.push([o, o+1, o+2], [o, o+2, o+3]);
    idx.push([o+4, o+6, o+5], [o+4, o+7, o+6]);
    idx.push([o, o+5, o+1], [o, o+4, o+5]);
    idx.push([o+1, o+6, o+2], [o+1, o+5, o+6]);
    idx.push([o+2, o+7, o+3], [o+2, o+6, o+7]);
    idx.push([o+3, o+4, o+0], [o+3, o+7, o+4]);
  }
  // Foot — small base block
  pushBoxRot45(-0.16 + 0.02, 0.08, 0.02, 0.08);
  // Shaft — narrower box rising
  pushBoxRot45(-0.04 + 0.10, 0.05, 0.10, 0.05);
  // Head — pyramid: apex up, square base at y=0.10
  const baseR = 0.14, headBaseY = 0.10, apexY = 0.30;
  const o = verts.length;
  verts.push([0, apexY, 0]);
  verts.push([baseR, headBaseY, 0]);
  verts.push([0, headBaseY, baseR]);
  verts.push([-baseR, headBaseY, 0]);
  verts.push([0, headBaseY, -baseR]);
  idx.push([o, o+1, o+2]);
  idx.push([o, o+2, o+3]);
  idx.push([o, o+3, o+4]);
  idx.push([o, o+4, o+1]);
  idx.push([o+1, o+4, o+3]);
  idx.push([o+1, o+3, o+2]);
  return { vertices: verts, triangleIndices: idx };
}

const ICON_GEOM: Record<string, { vertices: [number, number, number][]; triangleIndices: [number, number, number][] }> = {
  danger:   buildDangerGeom(),
  scenic:   buildScenicGeom(),
  supply:   buildSupplyGeom(),
  junction: buildJunctionGeom(),
};

// ── 30-particle classic orbit positions (ViroSphere children of a rotating ViroNode) ──
// Each particle has a fixed local position; the parent ViroNode runs a
// rotateY animation so the whole ring spins. Y bob is faked with a small
// v81: particle ring — radius range matched to reference HTML
// (0.22-0.36, was 0.32-0.50 in v80 which was too far from the icon).
// Each particle has a distinct Y-bob phase so the ring pulses softly
// rather than feeling like a static marble bracelet.
const PARTICLE_POSITIONS: Array<{ x: number; y: number; z: number; bobPhase: number }> = (() => {
  const arr: Array<{ x: number; y: number; z: number; bobPhase: number }> = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const a = (i / PARTICLE_COUNT) * Math.PI * 2 + (i * 0.137);
    const r = 0.22 + ((i * 31) % 100) / 100 * 0.14;
    const y = (((i * 47) % 100) / 100 - 0.5) * 0.40;
    const bobPhase = (i * 1.7) % (Math.PI * 2);
    arr.push({ x: Math.cos(a) * r, y, z: Math.sin(a) * r, bobPhase });
  }
  return arr;
})();

// v84: 新粒子环 — 24 颗 (从 50 减半)，半径 0.45-0.60 (拉远 icon)，
// Y 范围压扁到 ±0.10m (从 ±0.20)，更像"环绕"而不是"散云"。
const PARTICLE_COUNT_V84 = 24;
const PARTICLE_POSITIONS_V84: Array<{ x: number; y: number; z: number }> = (() => {
  const arr: Array<{ x: number; y: number; z: number }> = [];
  for (let i = 0; i < PARTICLE_COUNT_V84; i++) {
    const a = (i / PARTICLE_COUNT_V84) * Math.PI * 2 + (i * 0.137);
    const r = 0.45 + ((i * 31) % 100) / 100 * 0.15;  // 0.45-0.60
    const y = (((i * 47) % 100) / 100 - 0.5) * 0.20; // ±0.10 扁平
    arr.push({ x: Math.cos(a) * r, y, z: Math.sin(a) * r });
  }
  return arr;
})();

// Defensive: NO module top-level Viro NativeModule calls (createMaterials /
// registerAnimations) — they're done inside ARScene component's useEffect.
// (v50 crash was diagnosed as React version mismatch, not module top-level
// calls, but this defensive style is RN best practice anyway.)

// ── GPS → ARKit world conversion ───────────────────────────────
// worldAlignment="GravityAndHeading":
//   ARKit aligns axes to true north using device compass + gyro fusion.
//   +X = East, -Z = North, +Y = Up. We do NOT need to rotate ourselves.
//
// This is more accurate than worldAlignment="Gravity" + manual rotation
// because ARKit fuses compass + gyro continuously to correct drift,
// whereas a single magnetic-heading snapshot at origin-set is whatever
// the compass reads at that instant (often off by 30-90° before warm-up).
//
// DEBUG MODE (FIXED_FORWARD_M > 0): place one test sphere directly in
// front of the camera at FIXED_FORWARD_M metres. Bypasses GPS entirely.
const FIXED_FORWARD_M = 0; // set to >0 to force debug fixed-forward placement

function gpsToArWorld(
  origin: { lat: number; lng: number; alt?: number | null },
  target: { lat: number; lng: number; alt?: number | null },
): [number, number, number] {
  if (FIXED_FORWARD_M > 0) {
    return [0, ORB_EYE_OFFSET_M, -FIXED_FORWARD_M];
  }
  const dLat = target.lat - origin.lat;
  const dLng = target.lng - origin.lng;
  const cosLat = Math.cos((origin.lat * Math.PI) / 180);
  const northM = dLat * 111000;
  const eastM = dLng * 111000 * cosLat;
  // v68: GPS altitude is unreliable (consumer phones report 5-10m of vertical
  // jitter on every reading). We previously tried to honor it via dAlt — the
  // result was cairns appearing at wildly different heights (e.g. y=12m for
  // markers planted on flat ground). Now we ignore GPS altitude entirely and
  // anchor every cairn slightly below ARKit camera Y at origin time. This
  // gives a consistent "in front of me, slightly below eye level" feel
  // regardless of floor / hill / building.
  const altY = ORB_EYE_OFFSET_M;
  // GravityAndHeading: +X=East, -Z=North, +Y=Up — direct mapping.
  return [eastM, altY, -northM];
}

interface CairnWorldPos {
  id: string;
  type: string;
  x: number; y: number; z: number;
  dist: number;
  note?: string;
}

interface CameraInfo {
  position: [number, number, number];
  forward: [number, number, number];
}

interface ArOriginInfo {
  /** GPS lat/lng/alt at the moment ARKit origin was anchored. */
  lat: number;
  lng: number;
  alt: number | null;
}

interface Props {
  markers: Marker[];
  userPos: { lat: number; lng: number; alt?: number | null } | null;
  userHeading: number | null;
  onStatus?: (status: { glReady: boolean; cairnCount: number }) => void;
  onCairnPress?: (markerId: string) => void;
  /**
   * Live ARKit camera transform + cairn world positions, emitted on every
   * camera frame. Lets the parent (ARScreen) draw screen-edge arrows that
   * point at off-screen cairns using ARKit's true-north-aligned coordinate
   * system. Independent of any magnetic-heading sensor.
   *
   * Also includes the GPS origin so the parent can convert ARKit world
   * positions back to GPS coordinates for plant flow (avoids drift from
   * GPS-averaged anchors).
   *
   * `groundY` is the lowest detected horizontal plane's Y in ARKit world
   * space. Null until ARKit detects a horizontal plane (~1-3s indoors with
   * decent lighting & texture). Used by plant-flow + cairn render to place
   * the orb at `groundY + 1.5m` (eye-level above floor) regardless of
   * how the user was holding the phone at scene mount.
   */
  onArFrame?: (info: { camera: CameraInfo; cairns: CairnWorldPos[]; origin: ArOriginInfo | null; groundY: number | null }) => void;
  /**
   * v70: when set, a tall vertical light shaft renders above this cairn
   * (helps the user spot where it is from a distance). Cleared by the
   * parent after a timeout.
   */
  beamingId?: string | null;
}

// ─────────────────────────────────────────────────────────────────
// AR scene — receives arkitOrigin + markers via viroAppProps
// ─────────────────────────────────────────────────────────────────
function CairnARScene(props: any) {
  // viroAppProps is mutated in-place by ViroARSceneNavigator (not via React state),
  // so we poll it at 500ms to pick up markers/origin changes after scene mount.
  const [liveProps, setLiveProps] = useState<{
    arkitOrigin: { lat: number; lng: number; alt?: number | null } | null;
    markers: Marker[];
    onCairnPress?: (id: string) => void;
    onArFrame?: (info: { camera: CameraInfo; cairns: CairnWorldPos[]; origin: ArOriginInfo | null; groundY: number | null }) => void;
    beamingId?: string | null;
  }>(() => {
    const p = props.sceneNavigator?.viroAppProps ?? {};
    return {
      arkitOrigin: p.arkitOrigin ?? null,
      markers: p.markers ?? [],
      onCairnPress: p.onCairnPress,
      onArFrame: p.onArFrame,
      beamingId: p.beamingId ?? null,
    };
  });

  useEffect(() => {
    const id = setInterval(() => {
      const p = props.sceneNavigator?.viroAppProps ?? {};
      setLiveProps(prev => {
        const nextMarkers: Marker[] = p.markers ?? [];
        const nextBeamingId = p.beamingId ?? null;
        if (
          prev.arkitOrigin === p.arkitOrigin &&
          prev.markers.length === nextMarkers.length &&
          prev.onArFrame === p.onArFrame &&
          prev.beamingId === nextBeamingId
        ) return prev;
        return {
          arkitOrigin: p.arkitOrigin ?? null,
          markers: nextMarkers,
          onCairnPress: p.onCairnPress,
          onArFrame: p.onArFrame,
          beamingId: nextBeamingId,
        };
      });
    }, 500);
    return () => clearInterval(id);
  }, []);

  const { arkitOrigin, markers, onCairnPress, onArFrame, beamingId } = liveProps;
  const [tracking, setTracking] = useState(false);
  const [materialsReady, setMaterialsReady] = useState(false);
  // Refs for the camera-frame callback so we can throttle without
  // re-firing the closure on every Viro render.
  const lastFrameTsRef = useRef(0);
  const cairnNodesRef = useRef<CairnWorldPos[]>([]);
  // v70: lowest detected horizontal plane Y in ARKit world. ARKit reports
  // anchors via onAnchorFound/Updated; we keep the running minimum (lowest
  // plane = floor, even if ARKit also detects a tabletop higher up).
  // null until first horizontal plane is detected. Used by plant-flow to
  // anchor cairns at `groundY + 1.5m` regardless of how the user was
  // holding the phone.
  const groundYRef = useRef<number | null>(null);
  const [groundYTick, setGroundYTick] = useState(0); // bump to force cairn re-render when ground appears

  // Register Viro materials + animations on first scene mount.
  // Deliberately NOT at module top-level (defensive RN best practice).
  //
  // Material strategy per cairn type — 3-layer "soul wisp" stack:
  //   1. icon{type}    — solid coloured icon body (lightingModel Constant
  //                      + bloomThreshold so the colour itself glows in HDR)
  //   2. core{type}    — bright inner sphere (Constant + Add blend)
  //   3. shell{type}   — Fresnel rim shell (Lambert + fresnelExponent 2.0
  //                      so edges glow brighter than centre)
  //   4. wisp{type}    — outer hazy halo (Constant + Add + cullMode Front
  //                      so we see the "back wall" of the sphere from inside)
  //   5. particle{type}— small 30-orbit particles (Constant + Add)
  useEffect(() => {
    try {
      const types = ['danger', 'scenic', 'supply', 'junction', 'generic'] as const;
      const matDict: Record<string, any> = {};
      // v81: register the halo PNG once (reused across all types — colour
      // tint is applied per-type via diffuseColor on the per-type material).
      const haloPng = require('../../assets/ar/halo_radial.png');
      for (const t of types) {
        const c = TYPE_COLOR_TRIPLET[t];
        // v85 hotfix: v84 闪退 — shaderModifier fragment GLSL 编译失败
        // (Viro 内置 varying 名 _view/_normal/_surface.diffuse_color 是
        // 我从源码 grep 推断的，可能在当前 react-viro 版本不存在或名字不对)。
        // 立即回滚 shaderModifier，保留所有 PBR/多光源/多层壳/几何加厚/
        // backplate/呼吸动画 等声明式改造 (这些都不会闪退).
        // 失去 reference HTML Fresnel rim light 1:1 复刻，但 PBR 本身的
        // 受光阴影 + metalness/roughness 反射已经能做出立体感。
        matDict[`icon${t}`] = {
          lightingModel: 'PBR',
          diffuseColor: c.mid,
          metalness: 0.6,
          roughness: 0.25,
          bloomThreshold: 0.30,
          writesToDepthBuffer: true,
          readsFromDepthBuffer: true,
        };
        // v84: inner core — PBR + 高 emissive (用 metalness=0 + roughness=1 +
        // bloomThreshold=0.20 让它一直处于 bloom 阈值之上 → 永远发光).
        matDict[`core${t}`] = {
          lightingModel: 'PBR',
          diffuseColor: c.inner,
          metalness: 0.0,
          roughness: 1.0,
          bloomThreshold: 0.20,
          writesToDepthBuffer: true,
          readsFromDepthBuffer: true,
        };
        // v84: shell — 半透明玻璃壳。reference HTML 用 MeshPhysicalMaterial
        // transmission=0.92 + IOR=1.33。Viro 没 transmission，用 PBR
        // metalness=0.0 + roughness=0.05 + 高反射 + 低 alpha 近似玻璃。
        matDict[`shell${t}`] = {
          lightingModel: 'PBR',
          diffuseColor: c.mid,
          metalness: 0.0,
          roughness: 0.05,
          blendMode: 'Alpha',
          cullMode: 'Front',
          writesToDepthBuffer: false,
          readsFromDepthBuffer: true,
          bloomThreshold: 0.50,
        };
        // v84: outer wisp — Lambert 软光晕（PBR 在大半径低 opacity 上太亮）
        matDict[`wisp${t}`] = {
          lightingModel: 'Lambert',
          diffuseColor: c.outer,
          blendMode: 'Alpha',
          cullMode: 'Front',
          writesToDepthBuffer: false,
          readsFromDepthBuffer: true,
        };
        // v84: 粒子 — Constant + Add 保持发光感，bloom threshold 极低让
        // 每颗粒子都触发 bloom 扩散
        matDict[`particle${t}`] = {
          lightingModel: 'Constant',
          diffuseColor: c.inner,
          blendMode: 'Add',
          bloomThreshold: 0.15,
          writesToDepthBuffer: false,
          readsFromDepthBuffer: true,
        };
        // v84: backplate — 深色暗背板，把 icon 从背景里隔离出来。
        // Apple Watch activity ring / Pokestop 都用类似手法。
        matDict[`backplate${t}`] = {
          lightingModel: 'Constant',
          diffuseColor: c.outer,
          blendMode: 'Alpha',
          writesToDepthBuffer: false,
          readsFromDepthBuffer: true,
        };
        // v83 fix (halo 在白墙背景看不见): v81/v82 用 Add blend，物理上
        // Add(白色背景, halo色) ≈ 白色 → halo 完全融入白墙不可见。截图证据:
        // v82 三张图都是白墙背景，halo 完全看不到。
        // reference HTML 用纯黑 3D 背景所以 Add 显眼；AR 现实场景背景是任意
        // 颜色，必须用 Alpha (saturate) blend 才能可靠出现。
        // 失去"亮 + 亮叠加更亮"的 HDR 感，但收获在任何背景下可见的稳定光晕。
        matDict[`haloInner${t}`] = {
          lightingModel: 'Constant',
          diffuseColor: c.inner,
          diffuseTexture: haloPng,
          blendMode: 'Alpha',
          writesToDepthBuffer: false,
          readsFromDepthBuffer: true,
          bloomThreshold: 0.65,
        };
        matDict[`haloMid${t}`] = {
          lightingModel: 'Constant',
          diffuseColor: c.mid,
          diffuseTexture: haloPng,
          blendMode: 'Alpha',
          writesToDepthBuffer: false,
          readsFromDepthBuffer: true,
          bloomThreshold: 0.75,
        };
        matDict[`haloOuter${t}`] = {
          lightingModel: 'Constant',
          diffuseColor: c.outer,
          diffuseTexture: haloPng,
          blendMode: 'Alpha',
          writesToDepthBuffer: false,
          readsFromDepthBuffer: true,
          bloomThreshold: 0.85,
        };
        // Backwards-compat alias (the JSX still uses M('halo'); we keep
        // it as the mid layer so any stale code path doesn't break).
        matDict[`halo${t}`] = matDict[`haloMid${t}`];
      }
      ViroMaterials.createMaterials(matDict);
      ViroAnimations.registerAnimations({
        // Idle pulse for the icon body
        iconPulse: {
          properties: { scaleX: 1.06, scaleY: 1.06, scaleZ: 1.06 },
          duration: 1400,
          easing: 'EaseInEaseOut',
        },
        // v84: 慢自旋 (从 12s → 20s) 让用户能看清 icon 3D 厚度
        iconSpin: {
          properties: { rotateY: '+=360' },
          duration: 20000,
        },
        // v84: 呼吸动画 — icon 缓慢 0.95 ↔ 1.05 缩放 + opacity 明灭
        // 用数组串联做 [up, down] 双向，避免累加飘走 (从 v82/v83 学到的教训)
        iconBreatheUp: {
          properties: { scaleX: 1.05, scaleY: 1.05, scaleZ: 1.05, opacity: 1.0 },
          duration: 1800,
          easing: 'EaseInEaseOut',
        },
        iconBreatheDown: {
          properties: { scaleX: 0.95, scaleY: 0.95, scaleZ: 0.95, opacity: 0.85 },
          duration: 1800,
          easing: 'EaseInEaseOut',
        },
        iconBreathe: [
          { properties: { scaleX: 1.05, scaleY: 1.05, scaleZ: 1.05, opacity: 1.0 }, duration: 1800, easing: 'EaseInEaseOut' },
          { properties: { scaleX: 0.95, scaleY: 0.95, scaleZ: 0.95, opacity: 0.85 }, duration: 1800, easing: 'EaseInEaseOut' },
        ],
        // Particle ring spin — v84 慢转 (4.5s → 6s)
        particleRing: {
          properties: { rotateY: '+=360' },
          duration: 6000,
        },
        // v83 (粒子飞天/飞地终极修复): v81 `+=0.10 loop` 永久累加飞天花板;
        // v82 改成数组 [up, down] 串联想抵消累加，但 ViroAnimations 数组形式
        // 在 loop 时语义不确定 (类型定义有，runtime 行为可能 = 平行执行 or
        // 第二段被 loop reset 跳过)。截图证据: v82 粒子飞到桌面/地板，比
        // v81 飞天花板更糟。
        // 解法: **彻底删除 Y bob 动画**，粒子只跟父 ViroNode 的 ring 旋转。
        // 失去 reference HTML 的 sin*0.10 脉动呼吸感，但保证粒子永远贴在
        // icon 周围 ±0.40m 的初始 baseY 范围内不漂走。 bob 留 stub 防止
        // 引用 broken 但不挂到任何 node 上。
        particleBobA: [
          { properties: { positionY: '+=0.10' }, duration: 1100, easing: 'EaseInEaseOut' },
          { properties: { positionY: '-=0.10' }, duration: 1100, easing: 'EaseInEaseOut' },
        ],
        particleBobB: [
          { properties: { positionY: '+=0.08' }, duration: 1300, easing: 'EaseInEaseOut' },
          { properties: { positionY: '-=0.08' }, duration: 1300, easing: 'EaseInEaseOut' },
        ],
        particleBobC: [
          { properties: { positionY: '+=0.12' }, duration: 950,  easing: 'EaseInEaseOut' },
          { properties: { positionY: '-=0.12' }, duration: 950,  easing: 'EaseInEaseOut' },
        ],
        // Plant rise: cairn jumps in from -1m below ground to its target Y over 1.4s.
        // We attach this as the orb wrapper's animation when first mounted; once
        // the rise completes, idle animations take over.
        riseIn: {
          properties: { positionY: '+=1.5', opacity: 1.0 },
          duration: 1400,
          easing: 'EaseOutQuint',
        },
      });
      crashLogger.breadcrumb('viro:materials-registered v67');
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
    // v70: anchor cairn vertical position to detected floor (groundY + EYE_M).
    // Fallback if no plane detected yet: assume user was standing & holding the
    // phone at chest height (~1.4m above floor) at scene mount, so groundY ≈
    // ARKit Y - 1.4. Cairn Y then = (ARKit Y - 1.4) + 1.5 = ARKit Y + 0.1.
    // Once ARKit detects a real plane, groundY is overwritten and the cairn Y
    // re-snaps to the accurate value.
    const EYE_M = 1.5;
    const FALLBACK_HOLD_HEIGHT_M = 1.4;
    const ground = groundYRef.current;
    const cairnY = ground !== null
      ? ground + EYE_M
      : -FALLBACK_HOLD_HEIGHT_M + EYE_M; // ≈ +0.1 above ARKit origin
    const nodes = markers
      .map((m) => {
        const [x, _y, z] = gpsToArWorld(arkitOrigin, m);
        const horizontal = Math.hypot(x, z);
        if (horizontal > VISIBLE_RANGE_M) return null;
        const y = cairnY;
        crashLogger.breadcrumb(`viro:cairn-pos id=${m.id.slice(-4)} x=${x.toFixed(2)} y=${y.toFixed(2)} z=${z.toFixed(2)} ground=${ground === null ? 'null' : ground.toFixed(2)}`);
        return { id: m.id, type: m.type, x, y, z, dist: horizontal, note: m.note ?? '' };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
    cairnNodesRef.current = nodes;
    return nodes;
  }, [markers, arkitOrigin?.lat, arkitOrigin?.lng, arkitOrigin?.alt, groundYTick]);

  // Camera transform handler — fires on every ARKit frame (60Hz). Throttle
  // to ~10Hz so we don't flood the JS bridge. Forward the camera state +
  // cairn world positions to the parent for off-screen arrow rendering.
  const onCameraTransformUpdate = useCallback((evt: any) => {
    if (!onArFrame) return;
    const now = Date.now();
    if (now - lastFrameTsRef.current < 100) return; // 10Hz
    lastFrameTsRef.current = now;
    const t = evt?.cameraTransform;
    if (!t || !t.position || !t.forward) return;
    onArFrame({
      camera: { position: t.position, forward: t.forward },
      cairns: cairnNodesRef.current,
      origin: arkitOrigin ? { lat: arkitOrigin.lat, lng: arkitOrigin.lng, alt: arkitOrigin.alt ?? null } : null,
      groundY: groundYRef.current,
    });
  }, [onArFrame, arkitOrigin]);

  // v70: ARKit horizontal plane detection. We accept any plane reported by
  // ARKit and keep the running minimum Y as "floor". `anchorDetectionTypes`
  // defaults to ["planesHorizontal","planesVertical"] in ViroARScene, so
  // we just need handlers — no extra props.
  const handleAnchor = useCallback((anchor: any) => {
    if (!anchor) return;
    if (anchor.type !== 'plane') return;
    if (anchor.alignment && anchor.alignment !== 'Horizontal' && anchor.alignment !== 'horizontal') return;
    const y = anchor.position?.[1];
    if (typeof y !== 'number' || !isFinite(y)) return;
    const cur = groundYRef.current;
    if (cur === null || y < cur) {
      groundYRef.current = y;
      setGroundYTick((n) => n + 1);
      crashLogger.breadcrumb(`viro:plane y=${y.toFixed(2)} (new lowest)`);
    }
  }, []);
  const onAnchorFound = useCallback((anchor: any) => handleAnchor(anchor), [handleAnchor]);
  const onAnchorUpdated = useCallback((anchor: any) => handleAnchor(anchor), [handleAnchor]);

  useEffect(() => {
    crashLogger.breadcrumb(
      `viro:scene:cairns origin=(${arkitOrigin?.lat?.toFixed(6)},${arkitOrigin?.lng?.toFixed(6)}) count=${cairnNodes.length}`
    );
  }, [cairnNodes.length, arkitOrigin?.lat, arkitOrigin?.lng]);

  return (
    <ViroARScene
      onTrackingUpdated={onTrackingUpdated}
      onCameraTransformUpdate={onCameraTransformUpdate}
      onAnchorFound={onAnchorFound}
      onAnchorUpdated={onAnchorUpdated}
    >
      {/* v85 hotfix: 4 光源三点布光保留 (Viro 标配组件不会闪退)，
          但去掉 castsShadow (shadowsEnabled 已回滚，留着 prop 也没用)。
          灯光 intensity 从 v84 调整: 主光 1100→1000, rim 700→600,
          fill 300→200, ambient 200→300 给 PBR 材质平衡的曝光。 */}
      <ViroAmbientLight color="#ffffff" intensity={300} />
      <ViroDirectionalLight
        color="#ffffff"
        direction={[-0.4, -0.8, -0.5]}
        intensity={1000}
      />
      <ViroDirectionalLight
        color="#ffe5cc"
        direction={[0.6, -0.2, 0.7]}
        intensity={600}
      />
      <ViroDirectionalLight
        color="#a8c8ff"
        direction={[0.0, 0.7, 0.0]}
        intensity={200}
      />
      {materialsReady && cairnNodes.map((c) => (
        <CairnInstance
          key={c.id}
          id={c.id}
          type={c.type}
          x={c.x}
          y={c.y}
          z={c.z}
          tracking={tracking}
          beaming={beamingId === c.id}
          note={c.note}
          onPress={onCairnPress}
        />
      ))}
    </ViroARScene>
  );
}

// ─────────────────────────────────────────────────────────────────
// CairnInstance — single cairn rendered as a soul-wisp icon
// ─────────────────────────────────────────────────────────────────
//
// Layered structure (closest to outermost):
//   1. Icon body (ViroGeometry, type-specific shape, idle iconSpin animation)
//   2. Inner core sphere (Constant + Add, white-bright)
//   3. Fresnel shell (Lambert + fresnelExponent, mid-colour, edges glow)
//   4. Outer wisp (Constant + Add + cullMode=Front, deep-colour)
//   5. Particle ring (ViroNode wrapping 30 small ViroSpheres, parent rotates)
//
// Animation chain:
//   - On mount: orb wrapper plays riseIn (positionY +=1.5 over 1.4s)
//     → icon scaled 0 → 1 reveal (controlled by inner pulse)
//   - After mount: idle iconSpin + iconPulse + particleRing run forever
function CairnInstance(props: {
  id: string;
  type: string;
  x: number;
  y: number;
  z: number;
  tracking: boolean;
  beaming?: boolean;
  note?: string;
  onPress?: (id: string) => void;
}) {
  const { id, type, x, y, z, tracking, beaming, note, onPress } = props;
  // v70: known type → use specific geometry. Unknown type (legacy 'cairn',
  // 'free', or anything else) → render a neutral grey sphere with the
  // 'generic' colour palette. No more "scenic blue → junction orange"
  // surprises from a silent fallback to junction.
  const knownType = type in TYPE_COLOR_TRIPLET && type in ICON_GEOM ? type : null;
  const geom = knownType ? ICON_GEOM[knownType] : null;
  const tName = knownType ?? 'generic';
  const M = (n: string) => `${n}${tName}`;       // material name helper
  const onPressCb = useCallback(() => {
    crashLogger.breadcrumb(`viro:cairn:press id=${id.slice(-6)}`);
    onPress?.(id);
  }, [id, onPress]);

  return (
    <ViroNode
      position={[x, y, z]}
      onClick={onPressCb}
    >
      {/* v70.1 rise-in wrapper: inner node starts 1.5m below the cairn's
          target world position and animates up by +=1.5 over 1.4s. The
          OUTER node stays anchored at GPS-derived (x,y,z) so the cairn's
          world position is correct from frame 1; only the visual
          presentation animates up from "ground" → "eye-level". `key`
          uses the cairn id so a fresh marker re-runs the animation,
          while existing markers don't re-trigger on prop changes. */}
      <ViroNode
        position={[0, -1.5, 0]}
        opacity={0}
        animation={{ name: 'riseIn', run: tracking, loop: false }}
      >
      {/* v84: 0. Backplate — 深色暗背板，billboard 朝相机，把 icon 从
          复杂背景里隔离。Apple Watch activity ring / Pokestop 同款手法。
          位于 icon 后方 0.05m，半径 0.45m，同色 outer 暗色版本。 */}
      <ViroQuad
        position={[0, 0, -0.05]}
        height={0.95}
        width={0.95}
        materials={[M('backplate')]}
        opacity={0.55}
        transformBehaviors={['billboard']}
      />

      {/* v84: 1. Icon body — ViroGeometry, type-specific shape.
          重大升级:
          - PBR + shaderModifier Fresnel (材质层面注入 rim light)
          - 慢自旋 (12s → 20s) 让用户能看清 3D 厚度
          - 呼吸缩放动画 (0.95↔1.05)
          - 颜色明灭 (opacity 0.85↔1.0) */}
      <ViroNode
        animation={{ name: 'iconSpin', run: tracking, loop: true }}
        scale={[ICON_SCALE, ICON_SCALE, ICON_SCALE]}
      >
        <ViroNode animation={{ name: 'iconBreathe', run: tracking, loop: true }}>
          {geom ? (
            <ViroGeometry
              vertices={geom.vertices}
              triangleIndices={geom.triangleIndices}
              materials={[M('icon')]}
            />
          ) : (
            <ViroSphere
              radius={0.18}
              widthSegmentCount={32}
              heightSegmentCount={24}
              materials={[M('icon')]}
            />
          )}
        </ViroNode>
      </ViroNode>

      {/* v84: 2. Inner core — 双层提升立体感
          - 内层 0.06m (亮中心)
          - 外层 0.10m (中等亮度作为光晕过渡)
          高细分 32×24 让球真的圆滑，不是六边形多面体。 */}
      <ViroSphere
        radius={0.06}
        widthSegmentCount={32}
        heightSegmentCount={24}
        materials={[M('core')]}
        opacity={0.95}
      />
      <ViroSphere
        radius={0.10}
        widthSegmentCount={32}
        heightSegmentCount={24}
        materials={[M('core')]}
        opacity={0.55}
      />

      {/* v84: 3. 多层透明玻璃壳 — Pokemon Go 半透明发光的标准手法。
          3 层同心球，半径 1.0×/1.05×/1.10× icon 大小，opacity 递减。
          外层折射感更弱，整体透出 "玻璃罩里有光" 的体积感。
          PBR shell 材质 (metalness=0 + roughness=0.05) 模拟玻璃。 */}
      <ViroSphere
        radius={0.28}
        widthSegmentCount={36}
        heightSegmentCount={28}
        materials={[M('shell')]}
        opacity={0.20}
      />
      <ViroSphere
        radius={0.30}
        widthSegmentCount={36}
        heightSegmentCount={28}
        materials={[M('shell')]}
        opacity={0.13}
      />
      <ViroSphere
        radius={0.32}
        widthSegmentCount={36}
        heightSegmentCount={28}
        materials={[M('shell')]}
        opacity={0.08}
      />

      {/* v84: 4. 简化 halo — 从 v83 的 3 层 ViroQuad + 多层混乱光晕
          减为 1 层柔光 + outer wisp。设计上让 icon 主导视觉，halo 当配角。 */}
      <ViroQuad
        height={1.30}
        width={1.30}
        materials={[M('haloMid')]}
        opacity={0.45}
        transformBehaviors={['billboard']}
      />

      {/* v84: 5. Outer wisp — 最外层雾感光晕，球面 Lambert，
          受光面亮一点 (帮助强化 3D 立体感)。 */}
      <ViroSphere
        radius={0.55}
        widthSegmentCount={28}
        heightSegmentCount={20}
        materials={[M('wisp')]}
        opacity={0.10}
      />

      {/* v84: 6. 粒子环 — 高质量提升:
          - 数量 50 → 24 (减半，避免视觉拥挤)
          - 高细分 (segCount 6×4 → 14×10) 圆度大幅提升不再六边形
          - 半径 PARTICLE_RADIUS=0.018 → 0.022 (略大更圆)
          - bloom 阈值 0.15 让每颗粒子都触发 bloom 扩散
          - 父 ViroNode 慢转 (4.5s → 6s) */}
      <ViroNode animation={{ name: 'particleRing', run: tracking, loop: true }}>
        {PARTICLE_POSITIONS_V84.map((p, i) => (
          <ViroSphere
            key={i}
            position={[p.x, p.y, p.z]}
            radius={0.022}
            widthSegmentCount={14}
            heightSegmentCount={10}
            materials={[M('particle')]}
            opacity={0.9}
          />
        ))}
      </ViroNode>

      {/* 6. v70: optional vertical beam (skylight) — toggled by tapping the
          marker panel row. Helps user spot a far cairn. Box stretched 30m
          tall, very narrow, additive-blended bright white. Local origin is
          the cairn centre, box centre is 15m up so the beam goes from
          cairn-Y up to cairn-Y + 30m. */}
      {beaming && (
        <ViroBox
          position={[0, 15, 0]}
          width={0.12}
          height={30}
          length={0.12}
          materials={[M('core')]}
          opacity={0.55}
        />
      )}

      {/* 7. v70.1: note (title) floats 1.2m above the cairn body. ViroText
          uses transformBehaviors=["billboard"] so it always faces the
          camera, perfectly readable when the user looks at the cairn,
          gracefully shrinks via natural perspective when far away. Only
          rendered if the marker has a non-empty note. */}
      {note && note.length > 0 && (
        <ViroText
          text={note.length > 60 ? note.slice(0, 57) + '...' : note}
          position={[0, 1.2, 0]}
          scale={[0.6, 0.6, 0.6]}
          transformBehaviors={['billboard']}
          color="#ffffff"
          outerStroke={{ type: 'Outline', width: 2, color: '#000000' }}
          style={{
            fontSize: 18,
            fontWeight: '700',
            textAlign: 'center',
          } as any}
        />
      )}
      </ViroNode>
    </ViroNode>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────
export function ViroAROverlay({
  markers,
  userPos,
  userHeading,
  onStatus,
  onCairnPress,
  onArFrame,
  beamingId,
}: Props) {
  // v80 fix: arkitOriginRef MUST be a fresh capture every AR session.
  // Previously useRef held the value indefinitely — when the user closed
  // and reopened AR, arkitOriginRef.current still held the GPS reading
  // from the very first session. ARKit's new origin (set from current
  // GPS, ±5-10m noise) and the stale stored origin disagreed → all
  // anchored cairns appeared offset by that GPS noise vector ("flag
  // drifts forward" bug).
  // Fix: explicit reset on mount + unmount so each AR session captures
  // its own fresh origin from the current GPS reading.
  const arkitOriginRef = useRef<{ lat: number; lng: number; alt?: number | null } | null>(null);
  const [originReady, setOriginReady] = useState(false);

  // Reset origin every time component mounts. ViroAROverlay mounts/unmounts
  // with the AR screen lifecycle, so this gives one fresh origin per
  // AR session — matching ARKit's own session-origin behavior.
  useEffect(() => {
    arkitOriginRef.current = null;
    setOriginReady(false);
    crashLogger.breadcrumb('viro:origin-reset (AR session start)');
    return () => {
      arkitOriginRef.current = null;
      crashLogger.breadcrumb('viro:origin-cleared (AR session end)');
    };
  }, []);

  // Set origin as soon as GPS is available. With worldAlignment="GravityAndHeading",
  // ARKit handles north-alignment internally (fused compass + gyro), so we don't
  // need to capture heading ourselves.
  useEffect(() => {
    if (!arkitOriginRef.current && userPos) {
      arkitOriginRef.current = { ...userPos };
      setOriginReady(true);
      crashLogger.breadcrumb(
        `viro:origin-set lat=${userPos.lat.toFixed(6)} lng=${userPos.lng.toFixed(6)} alt=${userPos.alt ?? 'null'} hdg=${userHeading?.toFixed(1) ?? 'null'} fixedFwd=${FIXED_FORWARD_M} align=GravityAndHeading`
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
        // v85 hotfix: v84 闪退 — 大概率原因是 shaderModifier，但 pbrEnabled/
        // shadowsEnabled/multisamplingEnabled 也是首次启用，无法排除其中
        // 之一在 react-viro 当前版本是 stub 导致 native 崩溃。
        // 安全策略: 只保留 v83 已验证不闪退的 hdrEnabled + bloomEnabled。
        // PBR 材质本身仍然工作 (lightingModel='PBR' 在 ViroMaterials 是
        // 文档明确支持的，不依赖 ARSceneNavigator pbrEnabled prop)。
        hdrEnabled
        bloomEnabled
        initialScene={{ scene: CairnARScene as any }}
        viroAppProps={{
          arkitOrigin: arkitOriginRef.current,
          markers,
          onCairnPress,
          onArFrame,
          beamingId,
        }}
        style={StyleSheet.absoluteFillObject}
      />
    </View>
  );
}
