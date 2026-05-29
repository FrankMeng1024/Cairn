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
  // v110: cairn 颜色换成 logo 同色 (CairnLogo.tsx 默认 #5d7c46 绿色, 比棕色更协调)
  cairn:    { inner: '#a8c690', mid: '#5d7c46', outer: '#2e3f1d' },
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

// v107 回滚: 5 个几何回到 v97 已经"近乎完美"的版本.
// 用户反馈 v105/v106 的 tetrahedron/cone/octahedron 自创几何 "丑炸了, 不如之前".
// 保留: danger 倒三角(v97 完美) / scenic 5 角星(v97 完美, 内部 mapping cairn->scenic)
//       water lathe 水滴(v97 完美) / junction 箭头(v97 完美)
// 新加: hut (cube + roof) — v107 新 type
//       cairn (sphere stack) — v107 新 type, 不再用 scenic 几何
// 修水滴底部黑点 — cap fan 法向量错 (v107 修).

// Danger 火焰 (v110 重做): 用户反馈 v109 火焰形不像.
// 设计思路: 真实火焰 = 底部圆球 (燃料/木炭) + 上方水滴形火舌 + 顶尖右弯
//
// 几何分两段:
//   下半 (y -0.25 → -0.10): lathe 旋转球形底座 (像燃烧的炭球)
//   上半 (y -0.10 → 0.30): 火焰 path-extrude
//     - 底窄 (-0.10 处 ±0.04 宽) 跟底座连接
//     - 中胖 (0.05 处 ±0.16 宽) 火焰最旺位置
//     - 顶尖 (0.30 处) 偏右 0.06 给"摇曳感"
function buildDangerGeom() {
  const verts: [number, number, number][] = [];
  const idx: [number, number, number][] = [];

  // ── 下半: 球形燃料底座 (lathe 全圆球) ──
  // 球心 (-0.18), 半径 0.08, 像燃烧的木炭球
  const baseCY = -0.18, baseR = 0.08;
  const baseLat = 12, baseLon = 16;
  const baseStart = verts.length;
  for (let i = 0; i <= baseLat; i++) {
    const lat = (i / baseLat) * Math.PI;
    const sinLat = Math.sin(lat), cosLat = Math.cos(lat);
    for (let j = 0; j <= baseLon; j++) {
      const lon = (j / baseLon) * Math.PI * 2;
      verts.push([
        baseR * sinLat * Math.cos(lon),
        baseCY + baseR * cosLat,
        baseR * sinLat * Math.sin(lon),
      ]);
    }
  }
  for (let i = 0; i < baseLat; i++) {
    for (let j = 0; j < baseLon; j++) {
      const a = baseStart + i * (baseLon + 1) + j;
      const b = baseStart + i * (baseLon + 1) + (j + 1);
      const c = baseStart + (i + 1) * (baseLon + 1) + j;
      const d = baseStart + (i + 1) * (baseLon + 1) + (j + 1);
      idx.push([a, b, d], [a, d, c]);
    }
  }

  // ── 上半: 火焰 path-extrude ──
  // 16 顶点拟合火焰轮廓: 底窄 → 中胖 → 顶尖偏右
  // 左侧轮廓 (y 从 -0.10 升到 0.30 顶尖)
  // 右侧轮廓 (y 从 0.30 顶尖降到 -0.10)
  const flamePts: { x: number; y: number }[] = [
    // 起点 (左侧底)
    { x: -0.04, y: -0.10 },
    { x: -0.10, y: -0.04 },   // 左侧下凸
    { x: -0.15, y:  0.05 },   // 左中胖 (火焰最宽)
    { x: -0.13, y:  0.13 },
    { x: -0.08, y:  0.20 },
    { x: -0.02, y:  0.26 },
    // 顶尖 (略偏右给摇曳感)
    { x:  0.04, y:  0.30 },
    // 右侧从顶往下 (跳一个稍内凹给火焰"舔"的感觉)
    { x:  0.06, y:  0.22 },
    { x:  0.12, y:  0.15 },
    { x:  0.16, y:  0.05 },   // 右中胖
    { x:  0.13, y: -0.02 },
    { x:  0.06, y: -0.08 },
    { x:  0.04, y: -0.10 },   // 闭合到底
  ];
  const FLAME_DEPTH = 0.04;
  const flameStart = verts.length;
  // 前面顶点 (z=+depth)
  for (const p of flamePts) {
    verts.push([p.x, p.y, FLAME_DEPTH]);
  }
  // 后面顶点 (z=-depth)
  for (const p of flamePts) {
    verts.push([p.x, p.y, -FLAME_DEPTH]);
  }
  const N = flamePts.length;
  // 前面 fan (用第一点扇形): N-2 个三角形
  for (let i = 1; i < N - 1; i++) {
    idx.push([flameStart, flameStart + i, flameStart + i + 1]);
    // 后面 (镜像 CCW from -Z = 顶点顺序反转)
    idx.push([flameStart + N, flameStart + N + i + 1, flameStart + N + i]);
  }
  // 侧壁 (前后顶点连接)
  for (let i = 0; i < N; i++) {
    const i2 = (i + 1) % N;
    const fa = flameStart + i;
    const fb = flameStart + i2;
    const ba = flameStart + N + i;
    const bb = flameStart + N + i2;
    idx.push([fa, ba, bb]);
    idx.push([fa, bb, fb]);
  }

  return { vertices: verts, triangleIndices: idx };
}

// Scenic 5 角星 (v97 完美) — v107 也给 cairn 用 (cairn 没专属几何)
function buildScenicGeom() {
  const outerR = 0.24, innerR = 0.10, depth = 0.04;
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

// ╔══════════════════════════════════════════════════════════════╗
// ║  Water lathe 水滴 — 🔒 LOCKED v107 用户认可"水滴完美"        ║
// ║  禁止再改这个函数的几何参数 (segs/sides/profile/cap normal). ║
// ║  历史: v85-v97 反复迭代水滴 ~10 次, v107 终于用户说完美.       ║
// ║  关键参数 (don't touch):                                       ║
// ║    - segs=28 sides=32 (lathe 细分)                            ║
// ║    - TOP_Y=0.26 BOT_Y=-0.20 MAX_R=0.16                        ║
// ║    - profile 段 1 (t<=0.70): sin^0.85, profile 段 2 (dome):    ║
// ║      quarter-circle (cos→sin parametric)                       ║
// ║    - 末段 r 残留 0.005 防 fan singularity                      ║
// ║    - cap normal = meridianN[segs-1].my (不是 -1) 防底部黑斑   ║
// ║                                                                ║
// ║  如果未来必须改, 先在 buildWaterGeomV2 实现 + AB 测试,        ║
// ║  确认 v2 真比 v107 好再替换.                                  ║
// ╚══════════════════════════════════════════════════════════════╝
function buildWaterGeom() {
  const segs = 28, sides = 32;
  const TOP_Y = 0.26, BOT_Y = -0.20, MAX_R = 0.16;
  const profile: { y: number; r: number }[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    let r: number;
    let y: number;
    if (t <= 0.70) {
      y = TOP_Y + (BOT_Y - TOP_Y) * t;
      const tEff = Math.pow(t, 1.55);
      r = MAX_R * Math.pow(Math.sin(tEff * Math.PI), 0.85);
    } else {
      const tDome = (t - 0.70) / 0.30;
      const tEffStart = Math.pow(0.70, 1.55);
      const rStart = MAX_R * Math.pow(Math.sin(tEffStart * Math.PI), 0.85);
      const yStart = TOP_Y + (BOT_Y - TOP_Y) * 0.70;
      const yRange = BOT_Y - yStart;
      const ang = tDome * Math.PI / 2;
      r = rStart * Math.cos(ang);
      y = yStart + yRange * Math.sin(ang);
    }
    profile.push({ y, r: (i === 0) ? 0 : Math.max(r, 0.005) });
  }
  // Analytic lathe normal in meridian (r,y) plane.
  const meridianN: { mx: number; my: number }[] = [];
  for (let i = 0; i <= segs; i++) {
    let dr: number, dy: number;
    if (i === 0)         { dr = profile[1].r - profile[0].r;       dy = profile[1].y - profile[0].y; }
    else if (i === segs) { dr = profile[segs].r - profile[segs - 1].r; dy = profile[segs].y - profile[segs - 1].y; }
    else                 { dr = (profile[i + 1].r - profile[i - 1].r) / 2; dy = (profile[i + 1].y - profile[i - 1].y) / 2; }
    let mx = dy, my = -dr;
    const len = Math.hypot(mx, my) || 1;
    meridianN.push({ mx: mx / len, my: my / len });
  }
  meridianN[0]    = { mx: 0, my: 1 };
  meridianN[segs] = { mx: 0, my: -1 };
  const verts: [number, number, number][] = [];
  const normals: [number, number, number][] = [];
  for (let i = 0; i <= segs; i++) {
    for (let j = 0; j < sides; j++) {
      const ang = (j / sides) * Math.PI * 2;
      const cosA = Math.cos(ang), sinA = Math.sin(ang);
      const p = profile[i], n = meridianN[i];
      verts.push([cosA * p.r, p.y, sinA * p.r]);
      normals.push([cosA * n.mx, n.my, sinA * n.mx]);
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
  // v107 修水滴底部黑点 root cause:
  // v94 加 cap center vertex 法向量 [0,-1,0] 朝 -Y, 这是底部封口的几何法向.
  // 但 PBR 渲染时, 主光源从上方打 [0,-1,0] direction, cap 法向也 [0,-1,0]
  // → cap 跟主光方向相反 = 完全在阴影里 = 黑斑.
  // 修法: cap 法向用最后一圈 ring 的平均法向 (向下偏一点但不全朝 -Y),
  //   这样 cap 看起来跟 ring 连续过渡, 不再是孤立黑斑.
  const capCenterIdx = verts.length;
  verts.push([0, BOT_Y, 0]);
  // v107 cap 法向: 用最后一圈 ring meridian 平均, 而不是纯 [0,-1,0]
  // 最后一圈 i=segs 时 meridianN[segs] = (0, -1), 但实际渲染应该让 cap
  // 法向跟 ring 末端连续. 用倒数第 2 圈的 my 做 cap 法向 y 分量, 这样
  // cap 边缘跟 ring 末段是连续法向 (光照过渡平滑).
  const capNy = meridianN[segs - 1] ? meridianN[segs - 1].my : -1;
  normals.push([0, capNy, 0]);  // 不再是纯 -Y
  const lastRing = segs * sides;
  for (let j = 0; j < sides; j++) {
    const a = lastRing + j;
    const b = lastRing + (j + 1) % sides;
    idx.push([capCenterIdx, b, a]);
  }
  return { vertices: verts, normals, triangleIndices: idx };
}

// Junction 路口 fork 分叉 (v108 重做): 用户反馈 "现在的 junction 直接冲天
// 没理解". 路口的核心语义是 "分叉, 走哪边", 不是单一方向.
// 几何: 一个底座柱 + 上方 Y 形分叉 (左斜 + 右斜两条杆).
// 任何角度看都一眼是 "Y 形分叉路口".
function buildJunctionGeom() {
  const verts: [number, number, number][] = [];
  const idx: [number, number, number][] = [];
  // Helper: 在两点之间画一根 box (杆)
  function pushPole(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, half: number) {
    // 中心 + 长度
    const start = verts.length;
    const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.001) return;
    // 沿 (x1,y1,z1)→(x2,y2,z2) 方向的 box, 半厚 = half
    // 简化: 在杆轴方向上的 box (xz 平面厚度 half×half, y 长度 len)
    // 用 4 个底面顶点 + 4 个顶面顶点
    const ax = dx / len, ay = dy / len, az = dz / len;
    // 一个垂直 axis 的方向 (用 (0,1,0) 叉乘 axis 得到一个垂直向量)
    let upx = 0, upy = 1, upz = 0;
    if (Math.abs(ay) > 0.99) { upx = 1; upy = 0; upz = 0; }  // 杆几乎垂直, 用 X
    // 第一个垂直方向 = up × axis
    const px = upy * az - upz * ay;
    const py = upz * ax - upx * az;
    const pz = upx * ay - upy * ax;
    const plen = Math.hypot(px, py, pz);
    const pnx = px / plen, pny = py / plen, pnz = pz / plen;
    // 第二个垂直方向 = axis × p1
    const qx = ay * pnz - az * pny;
    const qy = az * pnx - ax * pnz;
    const qz = ax * pny - ay * pnx;
    // 8 顶点 = 起点 4 个 + 终点 4 个 (沿 p1, p2 方向 ±half)
    function pt(cx: number, cy: number, cz: number, sp: number, sq: number) {
      verts.push([cx + sp * half * pnx + sq * half * qx,
                  cy + sp * half * pny + sq * half * qy,
                  cz + sp * half * pnz + sq * half * qz]);
    }
    pt(x1, y1, z1, -1, -1);
    pt(x1, y1, z1,  1, -1);
    pt(x1, y1, z1,  1,  1);
    pt(x1, y1, z1, -1,  1);
    pt(x2, y2, z2, -1, -1);
    pt(x2, y2, z2,  1, -1);
    pt(x2, y2, z2,  1,  1);
    pt(x2, y2, z2, -1,  1);
    const o = start;
    // 6 面 box
    idx.push([o, o+1, o+2], [o, o+2, o+3]);              // 起点面
    idx.push([o+4, o+6, o+5], [o+4, o+7, o+6]);          // 终点面
    idx.push([o, o+5, o+1], [o, o+4, o+5]);              // 侧面 1
    idx.push([o+1, o+6, o+2], [o+1, o+5, o+6]);          // 侧面 2
    idx.push([o+2, o+7, o+3], [o+2, o+6, o+7]);          // 侧面 3
    idx.push([o+3, o+4, o+0], [o+3, o+7, o+4]);          // 侧面 4
  }
  // ── J2 Split (v110 重做): 主杆和分叉箭头之间有 gap ──
  // 用户反馈 "希望像 picker 网页 J2 那样有断开" — picker 里 J2 是: 主杆短,
  // 上方两个独立的分叉箭头, 它们之间有 ~0.10m 间隙 (不连接).
  //
  // 几何:
  //   主杆: (0, -0.25) → (0, -0.10)  (下端 0.15 长)
  //   <空隙 0.10>
  //   左箭头杆: (-0.05, 0.0) → (-0.20, 0.20)  (杆 + 锥头)
  //   右箭头杆: (0.05, 0.0) → (0.20, 0.20)
  //   底脚装饰球
  pushPole(0, -0.25, 0, 0, -0.10, 0, 0.045);   // 底座主杆 (短)
  // 左分支杆 (起点上移到 -0.05, 0.0, 跟主杆顶有间隙)
  pushPole(-0.05, 0.00, 0, -0.20, 0.20, 0, 0.038);
  // 右分支杆
  pushPole( 0.05, 0.00, 0,  0.20, 0.20, 0, 0.038);

  // ── 左箭头头 (cone) ──
  // 箭头位置: 左分支末端 (-0.18, 0.18), 朝外左上方 (-0.28, 0.30)
  function pushArrowHead(tipX: number, tipY: number, baseX: number, baseY: number, baseR: number) {
    // tip = 箭头尖, base = 箭头底圆心 (圆锥底)
    const dx = tipX - baseX, dy = tipY - baseY;
    const len = Math.hypot(dx, dy);
    if (len < 0.001) return;
    // 箭头方向单位向量
    const ax = dx / len, ay = dy / len;
    // 垂直方向 (XY 平面内, 在 XZ 平面)
    const px = -ay, py = ax;  // 90° rotate in XY
    const start = verts.length;
    // 顶尖
    verts.push([tipX, tipY, 0]);
    // 底圆 (8 段)
    const sides = 12;
    for (let j = 0; j < sides; j++) {
      const ang = (j / sides) * Math.PI * 2;
      // 底圆在垂直平面 (px,py) + Z 轴
      const cx = baseX + baseR * Math.cos(ang) * px;
      const cy = baseY + baseR * Math.cos(ang) * py;
      const cz = baseR * Math.sin(ang);
      verts.push([cx, cy, cz]);
    }
    // 底圆心
    const baseCenter = verts.length;
    verts.push([baseX, baseY, 0]);
    // 侧面 fan: tip → 底圆环
    for (let j = 0; j < sides; j++) {
      const a = start + 1 + j;
      const b = start + 1 + ((j + 1) % sides);
      idx.push([start, b, a]);   // CCW from outside
    }
    // 底面 fan: baseCenter → 底圆环
    for (let j = 0; j < sides; j++) {
      const a = start + 1 + j;
      const b = start + 1 + ((j + 1) % sides);
      idx.push([baseCenter, a, b]);
    }
  }
  // 左箭头: 杆终点 (-0.20, 0.20) 是箭头底, 尖在更外 (-0.30, 0.32)
  pushArrowHead(-0.30, 0.32, -0.20, 0.20, 0.07);
  // 右箭头
  pushArrowHead(0.30, 0.32, 0.20, 0.20, 0.07);

  // 底脚小球 (装饰)
  function pushBall(cx: number, cy: number, cz: number, r: number) {
    const start = verts.length;
    const segs = 8;
    for (let i = 0; i <= segs; i++) {
      const lat = (i / segs) * Math.PI;
      for (let j = 0; j <= segs; j++) {
        const lon = (j / segs) * Math.PI * 2;
        verts.push([
          cx + r * Math.sin(lat) * Math.cos(lon),
          cy + r * Math.cos(lat),
          cz + r * Math.sin(lat) * Math.sin(lon),
        ]);
      }
    }
    for (let i = 0; i < segs; i++) {
      for (let j = 0; j < segs; j++) {
        const a = start + i * (segs + 1) + j;
        const b = start + i * (segs + 1) + (j + 1);
        const c = start + (i + 1) * (segs + 1) + j;
        const d = start + (i + 1) * (segs + 1) + (j + 1);
        idx.push([a, b, d], [a, d, c]);
      }
    }
  }
  pushBall(0, -0.25, 0, 0.06);           // 底脚装饰球 (跟主杆底 -0.25 对齐)
  return { vertices: verts, triangleIndices: idx };
}

// Hut Castle 城堡 (v109): 用户选定 H3.
// 几何: 中央主体 box + 4 个角塔 (圆柱) + 4 个塔顶圆锥
// 跨文化"避难城堡"识别, 比简单 House 更视觉丰富
// Hut 城堡 (v110 重做): 用户反馈 v109 4-角塔+锥顶丑.
// 新设计 = 真实城堡 silhouette: 大 keep (主楼) + 上方 battlements (城垛) +
// 前方 gate notch (拱门凹口) + 2 侧塔 (而非 4 角塔, 让正面看更主).
//
// 几何 layout (正面 = +Z):
//   主 keep: 大 box, 略宽, 后中.
//   左/右侧塔: 2 圆柱 + 圆顶, 左右两边而非 4 角.
//   battlements: 主 keep 顶上 5 个矩形小块 (城垛), 间隔感.
//   gate: 主 keep 前面下半中央留 1 个矩形 notch (拱门).
//
// 不再用 4 角锥顶塔 — 视觉太"迪士尼", 不像石头城堡.
function buildHutGeom() {
  const verts: [number, number, number][] = [];
  const idx: [number, number, number][] = [];

  // Helper: push closed box with explicit normals not needed (flat shading via
  // separate triangle vertices not needed here — Viro flat-shades fine).
  function pushBox(cx: number, cy: number, cz: number, hw: number, hh: number, hd: number) {
    const s = verts.length;
    // 8 corners: 0-3 bottom (CCW from +x+z), 4-7 top
    verts.push([cx - hw, cy - hh, cz + hd]);  // 0 front-left-bottom
    verts.push([cx + hw, cy - hh, cz + hd]);  // 1 front-right-bottom
    verts.push([cx + hw, cy - hh, cz - hd]);  // 2 back-right-bottom
    verts.push([cx - hw, cy - hh, cz - hd]);  // 3 back-left-bottom
    verts.push([cx - hw, cy + hh, cz + hd]);  // 4 front-left-top
    verts.push([cx + hw, cy + hh, cz + hd]);  // 5 front-right-top
    verts.push([cx + hw, cy + hh, cz - hd]);  // 6 back-right-top
    verts.push([cx - hw, cy + hh, cz - hd]);  // 7 back-left-top
    idx.push([s+0, s+2, s+1], [s+0, s+3, s+2]);     // bottom (CCW from below)
    idx.push([s+0, s+1, s+5], [s+0, s+5, s+4]);     // front (+Z, CCW from outside)
    idx.push([s+1, s+2, s+6], [s+1, s+6, s+5]);     // right (+X)
    idx.push([s+2, s+3, s+7], [s+2, s+7, s+6]);     // back  (-Z)
    idx.push([s+3, s+0, s+4], [s+3, s+4, s+7]);     // left  (-X)
    idx.push([s+4, s+5, s+6], [s+4, s+6, s+7]);     // top
  }

  // ── 主 keep (大主楼) ──
  // 略宽中央 box. 中心 y=0, 半宽 0.16, 半高 0.18, 半深 0.12.
  // 不渲染上面 (顶将被 battlements 覆盖) — 但渲染没事, battlements 会盖住.
  const keepHW = 0.16, keepHH = 0.18, keepHD = 0.12;
  const keepCY = 0.00;
  pushBox(0, keepCY, 0, keepHW, keepHH, keepHD);

  // ── Battlements (城垛): 5 个小矩形块沿 keep 顶面前缘 + 后缘 ──
  // 城堡顶端最具识别性的特征. 每块半宽 0.025, 高 0.04, 深贴 keep 边缘.
  const merlonHW = 0.022, merlonHH = 0.04, merlonHD = 0.022;
  const merlonY = keepCY + keepHH + merlonHH;  // 顶面之上
  // 5 个前缘 (z = +keepHD - merlonHD, 内贴顶面前缘)
  // x 均匀分布 -keepHW+merlonHW ... +keepHW-merlonHW
  const nMer: number = 5;
  for (let i = 0; i < nMer; i++) {
    const t = nMer === 1 ? 0.5 : i / (nMer - 1);
    const x = -keepHW + merlonHW + t * (2 * keepHW - 2 * merlonHW);
    pushBox(x, merlonY,  keepHD - merlonHD, merlonHW, merlonHH, merlonHD);
    pushBox(x, merlonY, -keepHD + merlonHD, merlonHW, merlonHH, merlonHD);
  }
  // 左/右两侧也加 3 个 (z 中部) 让侧面看也有 battlements 节奏
  for (let i = 1; i < 4; i++) {
    const t = i / 4;
    const z = -keepHD + merlonHD + t * (2 * keepHD - 2 * merlonHD);
    pushBox( keepHW - merlonHW, merlonY, z, merlonHW, merlonHH, merlonHD);
    pushBox(-keepHW + merlonHW, merlonY, z, merlonHW, merlonHH, merlonHD);
  }

  // ── Gate notch (拱门凹口): 在 keep 正面下半中央, 推一个小 box 略出于前面 ──
  // 不真挖 hole (会破坏 box 三角形), 而是用一个深色"门框"box 浮雕在前面.
  // 门框: 半宽 0.04, 半高 0.06 (下半), 深极薄 0.005, z 在 keep 前面之外 0.005.
  const gateHW = 0.04, gateHH = 0.06, gateHD = 0.005;
  const gateCY = keepCY - keepHH + gateHH;       // 顶面与 keep 底齐
  pushBox(0, gateCY, keepHD + gateHD, gateHW, gateHH, gateHD);

  // ── 左/右两侧塔 (圆柱 + 半球顶) ──
  // 比 keep 高一点, 半径 0.05. 左右贴 keep 外缘.
  function pushTower(cx: number, cz: number, baseR: number, towerH: number) {
    const baseY = keepCY - keepHH;       // 塔底齐 keep 底
    const topY  = baseY + towerH;        // 塔顶
    const sides = 14;
    const ts = verts.length;
    // 底环 + 顶环 (圆柱侧面)
    for (let j = 0; j < sides; j++) {
      const ang = (j / sides) * Math.PI * 2;
      verts.push([cx + baseR * Math.cos(ang), baseY, cz + baseR * Math.sin(ang)]);
    }
    for (let j = 0; j < sides; j++) {
      const ang = (j / sides) * Math.PI * 2;
      verts.push([cx + baseR * Math.cos(ang), topY, cz + baseR * Math.sin(ang)]);
    }
    for (let j = 0; j < sides; j++) {
      const a = ts + j;
      const b = ts + (j + 1) % sides;
      const c = ts + sides + j;
      const d = ts + sides + (j + 1) % sides;
      idx.push([a, b, d], [a, d, c]);
    }
    // 半球顶 (lathe 半圆 — 替代 v109 锥顶, 更像真实石塔 dome)
    const domeLat = 6;
    const domeR = baseR;
    const domeStart = verts.length;
    // 顶环已经存在 ts+sides...ts+2*sides-1 (= dome 第一圈)
    // 再生成 domeLat 圈到顶尖
    for (let i = 1; i <= domeLat; i++) {
      const lat = (i / domeLat) * (Math.PI / 2);  // 0..π/2
      const y = topY + domeR * Math.sin(lat);
      const r = domeR * Math.cos(lat);
      if (i === domeLat) {
        // 顶尖单点
        verts.push([cx, y, cz]);
      } else {
        for (let j = 0; j < sides; j++) {
          const ang = (j / sides) * Math.PI * 2;
          verts.push([cx + r * Math.cos(ang), y, cz + r * Math.sin(ang)]);
        }
      }
    }
    // dome 三角形: 第一圈是 ts+sides (顶环), 之后 domeLat-1 圈在 domeStart...
    let prevRingStart = ts + sides;
    for (let i = 1; i < domeLat; i++) {
      const curRingStart = domeStart + (i - 1) * sides;
      for (let j = 0; j < sides; j++) {
        const a = prevRingStart + j;
        const b = prevRingStart + (j + 1) % sides;
        const c = curRingStart + j;
        const d = curRingStart + (j + 1) % sides;
        idx.push([a, b, d], [a, d, c]);
      }
      prevRingStart = curRingStart;
    }
    // 最后一圈到顶尖
    const tipIdx = verts.length - 1;
    for (let j = 0; j < sides; j++) {
      const a = prevRingStart + j;
      const b = prevRingStart + (j + 1) % sides;
      idx.push([a, b, tipIdx]);
    }
  }
  const towerR = 0.045;
  const towerH = keepHH * 2 + 0.04;   // 比 keep 高一点
  const towerX = keepHW + towerR * 0.6;
  pushTower(-towerX, 0, towerR, towerH);
  pushTower( towerX, 0, towerR, towerH);

  return { vertices: verts, triangleIndices: idx };
}

// Cairn Logo 3D (v109): 用户要 "用 cairn title 旁边的 logo 做 3D".
// 来源: src/components/ActivityIcons/CairnLogo.tsx (3 不对称椭圆 + 阴影弧)
// SVG viewBox 18×24, 3 个椭圆参数:
//   底: cx=9.5, cy=21, rx=7.5, ry=2.4  (最宽, 略右)
//   中: cx=8.5, cy=15, rx=5.5, ry=2.0  (中等, 略左)
//   顶: cx=11,  cy=9.5, rx=3.4, ry=1.7 (最窄, 略右, 给"自然张力")
//
// 几何转换: SVG (18×24, y 向下) → 3D (X 居中, y 向上)
//   归一化系数: 假设 logo 高度 0.5m → s = 0.5/24 = 0.0208
//   SVG cx 减 9 (中心 = 18/2) → 3D x
//   SVG (24 - cy) 减 12 (中心 = 24/2) → 3D y
//
// 每层椭圆做 lathe (绕 椭圆中心 Y 轴旋转), 但 rx ≠ ry 所以不能简单 lathe.
// 做法: 用扁球 (sphere scaled to ellipsoid) 即可: scale=(rx, ry, rx).
//   椭圆只在 XY 平面对称, Z 方向用 ry (扁) 模拟 "石头侧面也是扁的".
function buildCairnGeom() {
  const verts: [number, number, number][] = [];
  const idx: [number, number, number][] = [];
  // Helper: 推一个扁球 (ellipsoid) — sphere 沿 X/Y/Z 不同 scale
  function pushEllipsoid(cx: number, cy: number, rx: number, ry: number, rz: number, latSegs: number, lonSegs: number) {
    const startIdx = verts.length;
    for (let i = 0; i <= latSegs; i++) {
      const lat = (i / latSegs) * Math.PI;
      const sinLat = Math.sin(lat), cosLat = Math.cos(lat);
      for (let j = 0; j <= lonSegs; j++) {
        const lon = (j / lonSegs) * Math.PI * 2;
        const sinLon = Math.sin(lon), cosLon = Math.cos(lon);
        verts.push([
          cx + rx * sinLat * cosLon,
          cy + ry * cosLat,
          rz * sinLat * sinLon,
        ]);
      }
    }
    for (let i = 0; i < latSegs; i++) {
      for (let j = 0; j < lonSegs; j++) {
        const a = startIdx + i * (lonSegs + 1) + j;
        const b = startIdx + i * (lonSegs + 1) + (j + 1);
        const c = startIdx + (i + 1) * (lonSegs + 1) + j;
        const d = startIdx + (i + 1) * (lonSegs + 1) + (j + 1);
        idx.push([a, b, d], [a, d, c]);
      }
    }
  }
  // SVG → 3D 转换
  const s = 0.5 / 24;  // 0.0208 / SVG 单位
  // 底石: SVG (cx=9.5, cy=21, rx=7.5, ry=2.4)
  //   3D x = (9.5 - 9) * s = 0.0104 (略右)
  //   3D y = (12 - 21) * s = -0.1875 (底)
  //   3D rx = 7.5 * s = 0.156
  //   3D ry = 2.4 * s = 0.050
  //   3D rz = ry (Z 方向跟 Y 一样扁, 形成 "扁石头" 而非球)
  pushEllipsoid((9.5 - 9) * s, (12 - 21) * s, 7.5 * s, 2.4 * s, 2.4 * s, 12, 16);
  // 中石: SVG (cx=8.5, cy=15, rx=5.5, ry=2.0)
  pushEllipsoid((8.5 - 9) * s, (12 - 15) * s, 5.5 * s, 2.0 * s, 2.0 * s, 12, 16);
  // 顶石: SVG (cx=11, cy=9.5, rx=3.4, ry=1.7)
  pushEllipsoid((11 - 9) * s, (12 - 9.5) * s, 3.4 * s, 1.7 * s, 1.7 * s, 12, 16);
  return { vertices: verts, triangleIndices: idx };
}

const ICON_GEOM: Record<string, { vertices: [number, number, number][]; normals?: [number, number, number][]; triangleIndices: [number, number, number][] }> = {
  danger:   buildDangerGeom(),
  junction: buildJunctionGeom(),
  water:    buildWaterGeom(),
  hut:      buildHutGeom(),
  cairn:    buildCairnGeom(),
  // v107 backwards-compat: 旧 DB 'supply'/'scenic'/'free' 兼容
  supply:   buildWaterGeom(),    // supply → water lathe 水滴
  scenic:   buildScenicGeom(),   // scenic → 5 角星 (v97 完美)
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
      crashLogger.breadcrumb(
        `viro:materials-registered v105.1 types=[${types.join(',')}] ` +
        `geomKeys=[${Object.keys(ICON_GEOM).join(',')}]`,
      );
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

  // v108 drift 监控: 记录上次 cairnY, 检测每次重算的 delta. 用户反馈
  // "对准 marker 手机不动 marker 慢慢移动" → 通过 log 看 cairnY 抖动幅度.
  const lastCairnYRef = useRef<number | null>(null);

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
    // v108 drift log: 检测 cairnY 是否抖动 (这是用户反馈 "marker 慢慢移" 的诊断).
    const prevY = lastCairnYRef.current;
    if (prevY !== null && Math.abs(cairnY - prevY) > 0.001) {
      crashLogger.breadcrumb(
        `viro:drift:cairnY-changed prev=${prevY.toFixed(3)} new=${cairnY.toFixed(3)} ` +
        `delta=${(cairnY - prevY).toFixed(3)}m ground=${ground === null ? 'null' : ground.toFixed(3)}`,
      );
    }
    lastCairnYRef.current = cairnY;
    const nodes = markers
      .map((m) => {
        const [x, _y, z] = gpsToArWorld(arkitOrigin, m);
        const horizontal = Math.hypot(x, z);
        if (horizontal > VISIBLE_RANGE_M) return null;
        const y = cairnY;
        // v105.1 增强 log: 加 type 信息 + dist + 距离段标记 (near/mid)
        const distBand = horizontal <= NEAR_THRESHOLD_M ? 'near' : 'mid';
        crashLogger.breadcrumb(
          `viro:cairn-pos id=${m.id.slice(-4)} type=${m.type} ` +
          `xyz=(${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)}) ` +
          `dist=${horizontal.toFixed(1)}m band=${distBand} ` +
          `ground=${ground === null ? 'null' : ground.toFixed(2)}`,
        );
        return { id: m.id, type: m.type, x, y, z, dist: horizontal, note: m.note ?? '' };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
    cairnNodesRef.current = nodes;
    // v105.1 加 summary log: 总 marker 数, 可见 nodes 数, 距离分布
    crashLogger.breadcrumb(
      `viro:scene:nodes total=${markers.length} visible=${nodes.length} ` +
      `range=${VISIBLE_RANGE_M}m ground=${ground === null ? 'null' : ground.toFixed(2)}`,
    );
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
    // v97.1: 拒绝天花板. 真地面在相机下方 (-1.0~-1.7m).
    if (y > -0.3) return;
    const cur = groundYRef.current;
    // v108 修飘移: 用户反馈 "对准 marker 手机不动, 但 marker 镜头里慢慢
    // 朝一个方向小范围移动".
    // ROOT CAUSE: ARKit onAnchorUpdated 持续 refine plane 估计, 即使手机
    // 不动. 每次 anchor.position[1] 变化 0.01-0.05m, groundYRef 更新
    // → setGroundYTick → cairnNodes useMemo 重算 → 所有 marker Y 变化
    // → 视觉上 marker 慢慢飘.
    // 修法: 加 STABILITY THRESHOLD 0.10m. 只有 y 变化 > 10cm 才更新 ground.
    // ARKit plane refine 通常在 ±5cm 内, 阈值 10cm 完全过滤 jitter,
    // 但保留真实地面变化 (例如用户走到楼梯下).
    const STABILITY_THRESHOLD_M = 0.10;
    if (cur === null) {
      // 首次 ground 检测, 直接接受
      groundYRef.current = y;
      setGroundYTick((n) => n + 1);
      crashLogger.breadcrumb(`viro:plane:first y=${y.toFixed(3)} (initial ground)`);
    } else if (y < cur - STABILITY_THRESHOLD_M) {
      // 真发现更低的地面 (例如下楼/下坡), 接受新 ground
      crashLogger.breadcrumb(`viro:plane:lower y=${y.toFixed(3)} prev=${cur.toFixed(3)} delta=${(y - cur).toFixed(3)}`);
      groundYRef.current = y;
      setGroundYTick((n) => n + 1);
    } else {
      // 在阈值内的 jitter, 忽略防飘
      // (不打 breadcrumb 防 spam, 这种 update 每秒可能多次)
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
  // v105.1 hotfix: type normalize. 旧 DB 记录 'supply'/'scenic'/'free' 必须
  // 映射到新 type 名 (water/cairn), 否则 M('icon') 拼成 'iconsupply' 但
  // material 没注册 ('supply' 不在 types 数组) → ViroGeometry 引用空 material
  // → AR 闪退. 这就是 v105 进 AR 闪退的 root cause.
  const TYPE_REMAP: Record<string, string> = {
    supply: 'water',   // v105 重命名
    scenic: 'cairn',   // 吸收
    free:   'cairn',   // 吸收
  };
  const normalizedType = TYPE_REMAP[type] ?? type;
  // v105: cairn 现在是真石堆 3D 几何 (sphere-stack), 不再 test sphere.
  // 5 type 全部走同一个渲染路径.
  const knownType = (normalizedType in TYPE_COLOR_TRIPLET && normalizedType in ICON_GEOM) ? normalizedType : null;
  const geom = knownType ? ICON_GEOM[knownType] : null;
  const tName = knownType ?? 'generic';
  const M = (n: string) => `${n}${tName}`;       // material name helper

  // v105.1 加足量 log 诊断 (跟之前 AR 位置 bug 排查同样的策略)
  // 每个 cairn 渲染时打印: 原 type, normalize 后 type, 是否 known, material 名,
  // 几何顶点数. 这样闪退或视觉错时能直接看 breadcrumb 锁定问题.
  useEffect(() => {
    const vCount = geom?.vertices.length ?? 0;
    const tCount = geom?.triangleIndices.length ?? 0;
    crashLogger.breadcrumb(
      `viro:cairn:render id=${id.slice(-6)} type=${type} norm=${normalizedType} ` +
      `known=${knownType ?? 'no'} mat=${M('icon')} v=${vCount} tri=${tCount}`,
    );
  }, [id, type, normalizedType, knownType, geom]);
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
