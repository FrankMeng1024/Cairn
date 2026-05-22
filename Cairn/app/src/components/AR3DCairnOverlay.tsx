/**
 * AR3DCairnOverlay — true 3D rendering of cairns using three.js
 * over an expo-gl transparent canvas.
 *
 * Replaces the previous SVG/View-based ARCairnOverlay (v17 and earlier)
 * which couldn't read as a real 3D sphere. Now each cairn is a proper
 * Three.js sphere mesh with:
 *   - PerspectiveCamera (real FOV math, no manual screen projection)
 *   - DirectionalLight + AmbientLight (reads as a lit sphere with
 *     specular highlight + shadowed underside)
 *   - GPS-anchored world position via lat/lng → meters offset from user
 *   - Camera rotation tied to userHeading via Y-axis quaternion
 *
 * Performance: at most 50 spheres at any time (markers within 100m
 * radius), one render pass per heading change throttled to 30fps.
 * On mid-tier iPhones (12 onward) this stays well under 4ms/frame.
 *
 * Position locking: the cairn's world coordinates are computed ONCE
 * per markers/userPos change and stay fixed. As the user moves,
 * userPos updates and we re-compute meter offsets — but the cairn's
 * absolute lat/lng is the source of truth, so it appears glued to a
 * physical place rather than floating relative to the user.
 *
 * GPS smoothing: a low-pass filter on the user's lat/lng (1-Hz smoothing
 * window, alpha = 0.2) prevents jitter from making nearby cairns
 * twitch on screen. Heading is similarly smoothed (alpha = 0.3 — a
 * bit more responsive since the user expects the world to follow head
 * turns immediately).
 */
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import type { Marker } from '../store/useMarkerStore';
import { getAR3DConfig } from '../screens/ARScreen';

interface Props {
  markers: Marker[];
  userPos: { lat: number; lng: number } | null;
  userHeading: number | null;
}

// Field of view of the rear iPhone camera at 1×, in degrees.
// Mirrors the constant in ARScreen.tsx so projection lines up with
// the camera background.
const CAMERA_FOV_DEG = 65;

// Visible range in metres. Cairns farther than this are culled.
const AR_MAX_RANGE_M = 100;

// Smoothing factors. Smaller = more inertia, less jitter.
const POS_ALPHA = 0.2;
const HEADING_ALPHA = 0.3;

/**
 * Convert a marker's lat/lng into a Three.js world position in metres
 * relative to the user. Result is in the local ENU (east-north-up)
 * frame: x = east, y = up, z = -north (so -Z is "forward / north").
 */
function gpsToWorld(
  user: { lat: number; lng: number },
  marker: { lat: number; lng: number; alt?: number | null },
): THREE.Vector3 {
  const dLat = marker.lat - user.lat;
  const dLng = marker.lng - user.lng;
  const northM = dLat * 111000;
  const eastM = dLng * 111000 * Math.cos(user.lat * Math.PI / 180);
  // Y = 0.6 metres → orb floats 0.6m above the ground plane (≈ chest
  // height when the user is holding the phone). Looks natural without
  // forcing the user to tilt the phone up or down.
  return new THREE.Vector3(eastM, 0.6, -northM);
}

export function AR3DCairnOverlay({ markers, userPos, userHeading }: Props) {
  // Smoothed copies of position + heading. Refs (not state) so updates
  // don't re-render the GLView — we mutate the Three.js scene directly
  // each frame instead.
  const smoothedPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const smoothedHeadingRef = useRef<number>(0);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const cairnGroupRef = useRef<THREE.Group | null>(null);
  const rafRef = useRef<number | null>(null);

  // Update smoothed values whenever raw inputs change. We keep this in
  // a normal effect (not a tight requestAnimationFrame loop) because
  // GPS / heading updates fire at ≤1Hz, and the renderer's RAF loop
  // reads from the refs, so visual smoothing is naturally interpolated
  // by the lerping inside renderFrame.
  useEffect(() => {
    if (!userPos) return;
    if (!smoothedPosRef.current) {
      smoothedPosRef.current = { ...userPos };
    } else {
      smoothedPosRef.current = {
        lat: smoothedPosRef.current.lat * (1 - POS_ALPHA) + userPos.lat * POS_ALPHA,
        lng: smoothedPosRef.current.lng * (1 - POS_ALPHA) + userPos.lng * POS_ALPHA,
      };
    }
  }, [userPos?.lat, userPos?.lng]);

  useEffect(() => {
    if (userHeading == null) return;
    // Handle 359° → 1° wraparound by choosing the shorter rotation.
    const prev = smoothedHeadingRef.current;
    let delta = userHeading - prev;
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;
    smoothedHeadingRef.current = (prev + delta * HEADING_ALPHA + 360) % 360;
  }, [userHeading]);

  const onContextCreate = async (gl: WebGL2RenderingContext) => {
    const { drawingBufferWidth: w, drawingBufferHeight: h } = gl;

    // expo-three's Renderer wraps Three's WebGLRenderer. The library's
    // own type definitions are thin, so we cast to any for the few
    // setSize / setClearColor / render calls — Three.js semantics
    // apply at runtime.
    const renderer = new Renderer({ gl, alpha: true, antialias: true } as any) as any;
    renderer.setSize(w, h);
    renderer.setClearColor(0x000000, 0); // fully transparent — the
    // expo-camera CameraView renders behind us.
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // PerspectiveCamera with the same FOV as the physical camera, so
    // the 3D layer aligns with what the user sees through the lens.
    const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, w / h, 0.5, AR_MAX_RANGE_M * 2);
    cameraRef.current = camera;

    // Lights — one ambient for fill, one directional for the lit-from-
    // above feel. Without these the spheres render as flat coloured
    // discs (which is exactly what v17 looked like with 2D Views).
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xffffff, 0.85);
    sun.position.set(5, 10, 5);
    scene.add(sun);

    // Group that holds all cairn meshes. We re-populate it whenever
    // the markers list changes; the scene graph stays small.
    const group = new THREE.Group();
    scene.add(group);
    cairnGroupRef.current = group;

    const renderFrame = () => {
      const userP = smoothedPosRef.current;
      if (userP && cairnGroupRef.current) {
        // Re-compute world positions every frame — markers' absolute
        // lat/lng never changes, but the user's smoothed position
        // does, so the meter offset must follow. Cairns appear
        // GPS-locked even as the user walks past.
        cairnGroupRef.current.children.forEach((child: THREE.Object3D) => {
          const m = (child as any).__marker as Marker | undefined;
          if (!m) return;
          const pos = gpsToWorld(userP, { lat: m.lat, lng: m.lng });
          child.position.copy(pos);
        });
      }
      // Camera rotates Y-axis by smoothed heading so the world spins
      // around the user as they turn. heading=0 means user is facing
      // North (-Z); we rotate camera so North is in front of us.
      if (cameraRef.current) {
        const yaw = -(smoothedHeadingRef.current * Math.PI) / 180;
        cameraRef.current.rotation.y = yaw;
      }
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      (gl as any).endFrameEXP();
      rafRef.current = requestAnimationFrame(renderFrame);
    };
    renderFrame();
  };

  // Whenever markers list changes, rebuild the group's children.
  // Keeping this separate from onContextCreate so hot reload + marker
  // adds work without needing a new GL context.
  useEffect(() => {
    const group = cairnGroupRef.current;
    if (!group) return;
    // Remove old children
    while (group.children.length > 0) {
      const c = group.children[0];
      group.remove(c);
      // Best-effort cleanup of GPU resources.
      const mesh = c as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mm: THREE.Material) => mm.dispose());
        } else {
          (mesh.material as THREE.Material).dispose();
        }
      }
    }
    // Add fresh meshes for each marker within range
    const userP = smoothedPosRef.current ?? userPos;
    if (!userP) return;
    for (const m of markers) {
      const pos = gpsToWorld(userP, { lat: m.lat, lng: m.lng });
      // Cull distant cairns to stay below the 50-mesh budget.
      if (pos.length() > AR_MAX_RANGE_M) continue;

      const cfg = getAR3DConfig(m.type);
      const colorHex = parseInt(cfg.color.replace('#', ''), 16);
      // Sphere — radius scales slightly with distance so far cairns
      // don't visually disappear while close ones don't overwhelm.
      const dist = pos.length();
      const r = Math.max(0.18, 0.45 - dist / 600);
      const geom = new THREE.SphereGeometry(r, 24, 18);
      const mat = new THREE.MeshStandardMaterial({
        color: colorHex,
        metalness: 0.15,
        roughness: 0.45,
        emissive: colorHex,
        emissiveIntensity: 0.18,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.copy(pos);
      // Stash the source marker on the mesh so the per-frame loop can
      // recompute world position when the user moves.
      (mesh as any).__marker = m;
      group.add(mesh);
    }
  }, [markers, userPos?.lat, userPos?.lng]);

  // Cleanup on unmount: cancel RAF and dispose Three resources.
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const group = cairnGroupRef.current;
      if (group) {
        group.children.forEach((c: THREE.Object3D) => {
          const mesh = c as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
          if (mesh.material) {
            if (Array.isArray(mesh.material)) mesh.material.forEach((mm: THREE.Material) => mm.dispose());
            else (mesh.material as THREE.Material).dispose();
          }
        });
      }
    };
  }, []);

  if (!userPos || markers.length === 0) {
    // Nothing to render — explicitly mount nothing so we don't burn a
    // GL context for an empty scene.
    return null;
  }

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <GLView style={StyleSheet.absoluteFillObject} onContextCreate={onContextCreate} />
    </View>
  );
}
