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
  ViroParticleEmitter,
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
  junction: { inner: '#fff4d8', mid: '#f0a838', outer: '#8a4a18' },
  water:    { inner: '#f0faff', mid: '#6ac8f0', outer: '#2a5878' },
  hut:      { inner: '#f5e6d0', mid: '#b5823d', outer: '#5a3d18' },
  cairn:    { inner: '#f5e6d0', mid: '#b5823d', outer: '#5a3d18' },
  // v70: catch-all for unknown types.
  generic:  { inner: '#f0f0f0', mid: '#9aa0a6', outer: '#3a3d40' },
  // v105 backwards-compat: legacy DB records may still have 'supply' / 'scenic' / 'free'.
  // Map them to closest new type colour so old markers still render.
  supply:   { inner: '#f0faff', mid: '#6ac8f0', outer: '#2a5878' },  // → water
  scenic:   { inner: '#f5e6d0', mid: '#b5823d', outer: '#5a3d18' },  // → cairn (吸收 scenic)
  free:     { inner: '#f5e6d0', mid: '#b5823d', outer: '#5a3d18' },  // → cairn (吸收 free)
};
// v105 cleanup: 删除 TYPE_COLORS legacy single-color map (无人调用).

// v105 cleanup: 删除 hexToVec3 + hexToRgba helpers — 都是 shaderModifier
// 时代的死代码 (v82 ShaderMaterial Fresnel 早回滚, v100 Blinn rgba 也删了).


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
// v105 三段式可见性 (调研结果):
//   0-10m   → 完整 3D + 标题
//   10-50m  → 缩放 3D (屏幕最小可识别)
//   50-500m → edge arrow 在 ARScreen 那边处理
//   >500m   → 不显示 AR (走 minimap)
// 这里 VISIBLE_RANGE_M = 50m, 之前 30m 太近.
const VISIBLE_RANGE_M = 50;
const NEAR_THRESHOLD_M = 10;    // 0-10m 完整 3D
const ICON_SCALE_NEAR = 0.7;    // 0-10m: 跟之前一样大
const ICON_SCALE_FAR = 1.4;     // 10-50m: 放大 2x 让远处也能看到
// v105 三段式: ICON_SCALE 现在是动态 (按距离插值), 不再是常量.
// 保留旧名作为默认 (供没距离信息时 fallback).
const ICON_SCALE = ICON_SCALE_NEAR;
// v105 cleanup: 删除 PARTICLE_COUNT/PARTICLE_RADIUS (v70 ViroSphere 粒子数组
// 时代的常量). 现在用 ViroParticleEmitter, 参数在那直接 hardcode.

// ── 4 icon geometries ──────────────────────────────────────────
// Each function returns { vertices, triangleIndices } in the format
// expected by <ViroGeometry vertices=... triangleIndices=...>.
// All math runs once at module load (these are constants).
//
// Coordinate convention: +Y = up, +Z = front (icon faces +Z).
// v105 真 3D 各向同性几何 — 5 个 type 各自纯几何, 不再 lucide extrude.
//
// 设计原则: 各向同性 = 任何角度看都是同一个识别符号. 避免 v82-v97 反复
// 的 "厚 2D 饼干" 问题 (lucide icon 是 2D 矢量, extrude 后侧面是条线).
//
// type → 几何 mapping:
//   danger    → tetrahedron (4 面体, 所有面都三角警告)
//   junction  → cone (圆锥, 天然箭头方向感)
//   water     → octahedron (8 面体钻石, 360° 对称水晶感)
//   hut       → cube + pyramid roof (小屋外形, 跨文化识别)
//   cairn     → 3 球叠 (NZ alpine cairn 物理形状本身)

// Tetrahedron 四面体 (尖朝下): 4 顶点 + 4 三角面
// 原理: 警示三角的 3D 化, 任何角度都是尖锐三角警告
function buildDangerGeom() {
  const R = 0.22;  // 外接球半径
  // 4 个顶点: 1 个尖在下 (-Y), 3 个角在上形成正三角面 (+Y)
  const sqrt8over3 = Math.sqrt(8 / 3);  // 正四面体几何
  const sqrt2over3 = Math.sqrt(2 / 3);
  const verts: [number, number, number][] = [
    [0, -R, 0],                                              // 0 下尖
    [R * sqrt8over3 * 0.5, R * sqrt2over3, 0],               // 1 上右
    [-R * sqrt8over3 * 0.25, R * sqrt2over3, R * Math.sqrt(2/3)], // 2 上前
    [-R * sqrt8over3 * 0.25, R * sqrt2over3, -R * Math.sqrt(2/3)], // 3 上后
  ];
  const idx: [number, number, number][] = [
    [0, 2, 1], // 下尖-前-右
    [0, 3, 2], // 下尖-后-前
    [0, 1, 3], // 下尖-右-后
    [1, 2, 3], // 上 (反向 CCW from +Y)
  ];
  return { vertices: verts, triangleIndices: idx };
}

// Cone 圆锥 (尖朝上 / 朝相机方向): 1 apex + N 底环, 1 顶面 fan + 底面 fan
// 原理: junction 是路径决策, cone 天然箭头, 任何角度看都是 "指向某方向"
function buildJunctionGeom() {
  const sides = 16;
  const apexY = 0.27;     // 尖在上
  const baseY = -0.20;
  const baseR = 0.18;
  const verts: [number, number, number][] = [
    [0, apexY, 0],   // 0 apex 顶尖
  ];
  const idx: [number, number, number][] = [];
  // 底环 N 顶点 (index 1..N)
  for (let i = 0; i < sides; i++) {
    const ang = (i / sides) * Math.PI * 2;
    verts.push([Math.cos(ang) * baseR, baseY, Math.sin(ang) * baseR]);
  }
  // 底圆心 (index N+1)
  const baseCenterIdx = verts.length;
  verts.push([0, baseY, 0]);
  // 侧面 fan (apex → 底环顶点)
  for (let i = 0; i < sides; i++) {
    const a = 1 + i;
    const b = 1 + ((i + 1) % sides);
    idx.push([0, b, a]);  // CCW from outside
  }
  // 底面 fan (baseCenter → 底环顶点, 反向 CCW)
  for (let i = 0; i < sides; i++) {
    const a = 1 + i;
    const b = 1 + ((i + 1) % sides);
    idx.push([baseCenterIdx, a, b]);
  }
  return { vertices: verts, triangleIndices: idx };
}

// Octahedron 八面体 (钻石形): 6 顶点 + 8 三角面
// 原理: water 钻石形 360° 对称, 像水晶/玻璃水滴感, 比 lathe 水滴几何稳定
function buildWaterGeom() {
  const R = 0.22;
  // 6 顶点: 上下尖 + 4 个赤道
  const verts: [number, number, number][] = [
    [0, R, 0],     // 0 上尖
    [0, -R, 0],    // 1 下尖
    [R, 0, 0],     // 2 右
    [-R, 0, 0],    // 3 左
    [0, 0, R],     // 4 前
    [0, 0, -R],    // 5 后
  ];
  // 8 三角面 (上 4 + 下 4, CCW from outside)
  const idx: [number, number, number][] = [
    // 上半部 (apex 0 + 赤道 CCW)
    [0, 4, 2],  // 上-前-右
    [0, 2, 5],  // 上-右-后
    [0, 5, 3],  // 上-后-左
    [0, 3, 4],  // 上-左-前
    // 下半部 (apex 1 + 赤道 CW from -Y = CCW from outside)
    [1, 2, 4],  // 下-右-前
    [1, 5, 2],  // 下-后-右
    [1, 3, 5],  // 下-左-后
    [1, 4, 3],  // 下-前-左
  ];
  return { vertices: verts, triangleIndices: idx };
}

// House (cube + pyramid roof): hut 几何, 跨文化"房子"识别
// 原理: 小屋是 universal 视觉符号, 任何角度都是房子
function buildHutGeom() {
  const W = 0.18;        // 半宽
  const H = 0.10;        // 半高 (cube 部分)
  const ROOF_PEAK = 0.18; // 屋顶尖 (从 cube top 起)
  const cubeBottomY = -0.18;
  const cubeTopY = cubeBottomY + 2 * H;  // 0.02
  const roofPeakY = cubeTopY + ROOF_PEAK; // 0.20
  const verts: [number, number, number][] = [];
  const idx: [number, number, number][] = [];
  // Cube 8 顶点 (前后 + 左右 + 上下)
  // 0..3 = bottom (前左/前右/后右/后左), 4..7 = top
  verts.push([-W, cubeBottomY,  W]);  // 0 前左下
  verts.push([ W, cubeBottomY,  W]);  // 1 前右下
  verts.push([ W, cubeBottomY, -W]);  // 2 后右下
  verts.push([-W, cubeBottomY, -W]);  // 3 后左下
  verts.push([-W, cubeTopY,     W]);  // 4 前左上 (eave 屋檐)
  verts.push([ W, cubeTopY,     W]);  // 5 前右上
  verts.push([ W, cubeTopY,    -W]);  // 6 后右上
  verts.push([-W, cubeTopY,    -W]);  // 7 后左上
  // Cube 6 面 (CCW from outside)
  idx.push([0, 1, 2], [0, 2, 3]);    // 底
  idx.push([0, 4, 5], [0, 5, 1]);    // 前 (法向 +Z)
  idx.push([1, 5, 6], [1, 6, 2]);    // 右
  idx.push([2, 6, 7], [2, 7, 3]);    // 后
  idx.push([3, 7, 4], [3, 4, 0]);    // 左
  // Roof: 2 ridge 顶点 (前后) — pitched roof 沿 X 轴 ridge
  verts.push([0, roofPeakY,  W]);   // 8 前 ridge (在前面屋檐上方)
  verts.push([0, roofPeakY, -W]);   // 9 后 ridge
  // Roof 4 面: 2 个梯形屋檐 + 2 个三角山墙
  idx.push([4, 5, 8]);                // 前山墙 (前面三角)
  idx.push([6, 7, 9]);                // 后山墙
  idx.push([5, 6, 9], [5, 9, 8]);     // 右斜屋顶 (梯形)
  idx.push([7, 4, 8], [7, 8, 9]);     // 左斜屋顶
  return { vertices: verts, triangleIndices: idx };
}

// Cairn (堆 3 个不规则球): NZ alpine 物理形状本身, 不需要图标
// 原理: 这就是 cairn 的真实形状, 任何角度都一眼是 "石堆"
function buildCairnGeom() {
  const verts: [number, number, number][] = [];
  const idx: [number, number, number][] = [];
  // Helper: push UV-sphere mesh 到 verts/idx, 偏移 cy 米, 半径 r, 不规则
  function pushSphere(cy: number, r: number, jitter: number, latSegs: number, lonSegs: number) {
    const startIdx = verts.length;
    for (let i = 0; i <= latSegs; i++) {
      const lat = (i / latSegs) * Math.PI;          // 0..π
      const sinLat = Math.sin(lat), cosLat = Math.cos(lat);
      for (let j = 0; j <= lonSegs; j++) {
        const lon = (j / lonSegs) * Math.PI * 2;
        const sinLon = Math.sin(lon), cosLon = Math.cos(lon);
        // 不规则: 用噪声 perturb 半径
        const noise = (Math.sin(i * 7.13 + j * 3.71) * 0.5 + Math.cos(i * 4.27 + j * 9.51) * 0.5) * jitter;
        const rr = r * (1 + noise);
        const x = rr * sinLat * cosLon;
        const y = cy + rr * cosLat;
        const z = rr * sinLat * sinLon;
        verts.push([x, y, z]);
      }
    }
    for (let i = 0; i < latSegs; i++) {
      for (let j = 0; j < lonSegs; j++) {
        const a = startIdx + i * (lonSegs + 1) + j;
        const b = startIdx + i * (lonSegs + 1) + (j + 1);
        const c = startIdx + (i + 1) * (lonSegs + 1) + j;
        const d = startIdx + (i + 1) * (lonSegs + 1) + (j + 1);
        idx.push([a, b, d]);
        idx.push([a, d, c]);
      }
    }
  }
  // 3 球从下到上, 渐小, 不规则
  pushSphere(-0.18, 0.13, 0.08, 10, 12);  // 大底
  pushSphere(-0.02, 0.10, 0.10, 10, 12);  // 中
  pushSphere( 0.13, 0.07, 0.12, 10, 12);  // 小顶
  return { vertices: verts, triangleIndices: idx };
}

const ICON_GEOM: Record<string, { vertices: [number, number, number][]; normals?: [number, number, number][]; triangleIndices: [number, number, number][] }> = {
  danger:   buildDangerGeom(),
  junction: buildJunctionGeom(),
  water:    buildWaterGeom(),
  hut:      buildHutGeom(),
  cairn:    buildCairnGeom(),
  // v105 backwards-compat: legacy DB 'supply'/'scenic'/'free' 兼容映射
  supply:   buildWaterGeom(),    // supply → water
  scenic:   buildCairnGeom(),    // scenic → cairn
};

// v105 cleanup: 删除 PARTICLE_POSITIONS + PARTICLE_POSITIONS_V84 (反复 v81-v89
// 的 ViroSphere 数组粒子方案). v92 改用 ViroParticleEmitter 真 GPU 粒子,
// 这两个静态数组无人使用. 删除省 ~30 行死代码.

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
  // v105 material strategy: 极简 — 只 2 个 material per type.
  //   1. icon{type}    — PBR + 纯色, 受光阴影自然 3D
  //   2. particle{type} — Constant + Add, ViroParticleEmitter 用
  // 删除全部 shell/halo/core/wisp/backplate/solidSphere — 反复 v85-v104 失败.
  useEffect(() => {
    try {
      const types = ['danger', 'junction', 'water', 'hut', 'cairn', 'generic'] as const;
      const matDict: Record<string, any> = {};
      // v105 cleanup: 删除 haloPng + cubeMap (material 阶段). halo material 全
      // 已删, cubeMap 不再用. 真正粒子 sprite 在 ViroParticleEmitter
      // 那里直接 require, 不依赖这个变量.
      for (const t of types) {
        const c = TYPE_COLOR_TRIPLET[t];
        // v105 cleanup: 简化 material — 只保留 PBR icon material.
        // 删除全部 shell/halo/cubeMap/core/wisp/backplate/solidSphere material.
        // 反复 v85-v104 球壳路放弃, 改追求精致 icon (5 type 真 3D 几何 + PBR).
        // metalness 0.6 + roughness 0.20 + 纯色 = 简单釉面感, 受光阴影自然 3D.
        // 不依赖 cubemap/transmission 等 Viro 不稳的特性.
        matDict[`icon${t}`] = {
          lightingModel: 'PBR',
          diffuseColor: c.mid,
          metalness: 0.6,
          roughness: 0.20,
          bloomThreshold: 0.30,
          writesToDepthBuffer: true,
          readsFromDepthBuffer: true,
        };
        // v105: 粒子 — 保留 (v92 ViroParticleEmitter 路线, 还会用)
        matDict[`particle${t}`] = {
          lightingModel: 'Constant',
          diffuseColor: c.inner,
          blendMode: 'Add',
          bloomThreshold: 0.08,
          writesToDepthBuffer: false,
          readsFromDepthBuffer: true,
        };
      }
      ViroMaterials.createMaterials(matDict);
      // v105 cleanup: 删除 7 个未使用动画 (iconPulse/iconSpin/iconBreatheUp/Down/
      // iconBreathe/particleRing/particleBobA/B/C). Arch+QA review 验证只有
      // riseIn 在 JSX 真用. 删除其他防止 v82-v83 串联累加 bug 重蹈.
      ViroAnimations.registerAnimations({
        // Plant rise: cairn jumps from -1m below to target Y over 0.6s.
        riseIn: {
          properties: { positionY: '+=1.5', opacity: 1.0 },
          duration: 600,
          easing: 'EaseOutQuint',
        },
      });
      crashLogger.breadcrumb('viro:materials-registered v105');
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
    // v88 恢复: EYE_M 0.5 → 1.5. v87 改成 0.5 让户外站立 hike 视角下旗子
    // 太低 (膝盖高度). v86 那次"飘天花板"截图实际是 anomaly (用户蹲下
    // plant 桌面上, ground 不是地板而是桌面 → +1.5 顶到天花板). 那是个
    // hit-test 取错 plane 的 corner case, 不是 EYE_M 公式的问题.
    // 户外 hike (主用例) ground+1.5 = 眼睛高度, 是对的.
    const EYE_M = 1.5;
    const FALLBACK_HOLD_HEIGHT_M = 1.4;
    const ground = groundYRef.current;
    const cairnY = ground !== null
      ? ground + EYE_M
      : -FALLBACK_HOLD_HEIGHT_M + EYE_M;
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
    // v97.1: 拒绝天花板. 用户反馈 "貌似把其他的也带到天花板去了" — 根因是
    // 用户朝天花板举手机, ARKit 把天花板误判为 horizontal plane,
    // groundYRef 取了 y=+1.5 的天花板, cairn=ground+1.5=+3.0 全飘到天花板.
    // 真地面在相机下方 (ARKit origin Y=0 ≈ 站立眼睛高度, 真地面 -1.0~-1.7m).
    // 拒绝 y > -0.3 的 plane (天花板 / 桌面 / 高架), 只接受 y < -0.3 真地面.
    if (y > -0.3) return;
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
          dist={c.dist}
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
  dist: number;
  tracking: boolean;
  beaming?: boolean;
  note?: string;
  onPress?: (id: string) => void;
}) {
  const { id, type, x, y, z, dist, tracking, beaming, note, onPress } = props;
  // v105 三段式 scale: 0-10m 用 ICON_SCALE_NEAR (0.7), 10-50m 线性插值到
  // ICON_SCALE_FAR (1.4) 让远处 marker 也能看见. 屏幕角度: 1m 距离 0.7
  // ≈ 屏幕 50%, 30m 距离 1.4 ≈ 屏幕 4.7% 仍可识别.
  let scale: number;
  if (dist <= NEAR_THRESHOLD_M) {
    scale = ICON_SCALE_NEAR;
  } else {
    const t = Math.min(1, (dist - NEAR_THRESHOLD_M) / (VISIBLE_RANGE_M - NEAR_THRESHOLD_M));
    scale = ICON_SCALE_NEAR + (ICON_SCALE_FAR - ICON_SCALE_NEAR) * t;
  }
  // v105: cairn 现在是真石堆 3D 几何 (sphere-stack), 不再 test sphere.
  // 5 type 全部走同一个渲染路径.
  const knownType = (type in TYPE_COLOR_TRIPLET && type in ICON_GEOM) ? type : null;
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
      {/* v87: Backplate 删除. v84 加的暗背板想"把 icon 从复杂背景里隔离",
          但 截图证据 v86 0528_1.jpg/0528_2.jpg 中, backplate 1.10x1.10 太大,
          billboard 朝相机时把 icon 几何完全包住, 用户看到的是 backplate
          形状而不是 icon. 直接删除. icon 自己受光阴影 + bloom 已经够亮. */}


      {/* v84: 1. Icon body — ViroGeometry, type-specific shape.
          重大升级:
          - PBR + shaderModifier Fresnel (材质层面注入 rim light)
          - 慢自旋 (12s → 20s) 让用户能看清 3D 厚度
          - 呼吸缩放动画 (0.95↔1.05)
          - 颜色明灭 (opacity 0.85↔1.0) */}
      {/* v94: danger/scenic icon 用 billboard transformBehavior 永远朝相机.
          用户反馈 v93 "danger 上下反了 + 感叹号单侧突出" — 根因是 iconSpin
          转 Y 轴时, 转到 90° 看到的是 danger 三角形薄薄的侧面 + bar 单侧
          浮雕 像独立长条. iconSpin 在 3D 立体几何 (lathe 水滴) OK, 但对
          扁平 icon (三角+感叹号 / 5 角星) 暴露侧面缺陷.
          解法: icon ViroNode 加 billboard, 不再 spin, 永远朝相机正面.
          牺牲 spin 旋转动效, 但收获: 永远是 lucide 图标的正确正面. */}
      {/* v102 真融合 v2: 分离 billboard 避免球壳被旋转扭曲.
          v101 把 shell + icon 共同 ViroNode + billboard, 但 billboard 旋转
          整个父节点 → 球壳被强制 "永远看同一面" + 整体跟相机视角 mismatch
          → 用户看到 "东倒西歪 + 没球 + 位置高".
          v102 修法:
          - 外层 ViroNode 只做 scale (球壳 + icon 共享缩放, 同尺寸缩放)
          - 球壳 ViroSphere 直接子节点, 不 billboard (球对称无需朝相机)
          - icon ViroNode 子级单独加 billboard, 让 icon 永远朝相机但球壳静止
          - 球壳静止 + icon 朝相机 = "球壳里漂浮的 lucide 标识" 真融合 */}
      {/* v105: 5 type 真 3D 几何 (tetrahedron/cone/octahedron/cube+roof/sphere-stack).
          billboard 让 icon 永远朝相机, 但因为几何是真各向同性 3D, 任何角度都对. */}
      <ViroNode scale={[scale, scale, scale]}>
        <ViroNode transformBehaviors={['billboard']}>
          {geom ? (
            <ViroGeometry
              vertices={geom.vertices}
              normals={geom.normals}
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

      {/* v101: 删除独立 isTestSphere ViroSphere (现在合并到上面 ViroNode);
          删除独立 shellAdd / shellAlpha ViroSphere (合并到上面 ViroNode);
          删除 iconBreathe 动画引用 (元凶). */}

      {/* v104: 删除 3 层 halo billboard ViroQuad (v89 加的)!
          ROOT CAUSE 找到了: 3 层 halo size 1.70 + 1.10 + 0.55 billboard 永远
          朝相机, 在球壳后面渲染. 3 层 alpha 叠加 = 79% 不透明 → 把球壳完全
          遮住. 这就是用户反复反馈 "没球" 的真正原因.
          删除后 ViroSphere 球壳应该真正可见. */}

      {/* v84: 6. 粒子环 — 高质量提升:
          - 数量 50 → 24 (减半，避免视觉拥挤)
          - 高细分 (segCount 6×4 → 14×10) 圆度大幅提升不再六边形
          - 半径 PARTICLE_RADIUS=0.018 → 0.022 (略大更圆)
          - bloom 阈值 0.15 让每颗粒子都触发 bloom 扩散
          - 父 ViroNode 慢转 (4.5s → 6s) */}
      {/* v92: 真粒子! 用 ViroParticleEmitter 替换 v89-v91 的 ViroSphere
          数组. 用户反馈 "光粒效果太差 周围旋转的光粒太大了 很不真实".
          根因: ViroSphere 实心 mesh 在 1m 距离 0.010 半径 = 屏幕 5px 实心圆,
          不是 "光" 是 "球". Pokemon Go 等 AR 应用全用 GPU sprite billboard
          + 半透明 radial gradient PNG + opacity/scale 渐变 + velocity 飘动.
          ViroParticleEmitter 是 Viro 真粒子系统, 完整支持这些.

          使用现有 halo_radial.png 当 sprite (中心亮边缘 alpha 渐变).
          spawnVolume sphere radius 0.30 让粒子在 icon 周围球形空间生成.
          velocity 微小 ±0.05 让粒子缓慢飘动. lifetime 2-4s + opacity 渐变
          0.8→0 + scale 渐变 1.0→0.3 形成 "出现-飘动-淡出" 循环. */}
      <ViroParticleEmitter
        position={[0, 0, 0]}
        duration={2000}
        delay={0}
        run={tracking}
        loop
        fixedToEmitter
        image={{
          source: require('../../assets/ar/halo_radial.png'),
          height: 0.06,
          width: 0.06,
          bloomThreshold: 0.10,
        }}
        spawnBehavior={{
          particleLifetime: [2000, 3500],
          maxParticles: 40,
          emissionRatePerSecond: [12, 18],
          spawnVolume: {
            shape: 'sphere',
            params: [0.30],
            spawnOnSurface: false,
          },
        }}
        particleAppearance={{
          opacity: {
            initialRange: [0.6, 0.9],
            factor: 'time',
            interpolation: [
              { interval: [0, 500], endValue: 0.9 },
              { interval: [500, 3000], endValue: 0.0 },
            ],
          },
          scale: {
            initialRange: [[0.6, 0.6, 0.6], [1.2, 1.2, 1.2]],
            factor: 'time',
            interpolation: [
              { interval: [0, 1000], endValue: [1.0, 1.0, 1.0] },
              { interval: [1000, 3000], endValue: [0.2, 0.2, 0.2] },
            ],
          },
        }}
        particlePhysics={{
          velocity: { initialRange: [[-0.05, -0.02, -0.05], [0.05, 0.08, 0.05]] },
          acceleration: { initialRange: [[0, 0.02, 0], [0, 0.04, 0]] },
        }}
      />

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
          materials={[M('icon')]}
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
