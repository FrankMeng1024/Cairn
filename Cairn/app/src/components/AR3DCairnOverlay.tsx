/**
 * AR3DCairnOverlay — true 3D rendering of cairns using Three.js over
 * an expo-gl transparent canvas, painted on top of the live camera feed.
 *
 * v18.1 rewrite — fixes the v18 bug where cairns never appeared on
 * screen. Five issues addressed:
 *
 *   1. Camera was at world (0,0,0) looking at -Z, but cairns sit at
 *      eye-height (y≈1.5) — the camera was literally pointing AT the
 *      ground, not at the cairns.  Fixed: place camera at eye height
 *      and orient it horizontally; cairns share the same y plane.
 *
 *   2. The freshly-planted "at my feet" cairn lands at (0, eye, 0)
 *      relative to the user — the same point as the camera itself.
 *      Three.js can't render a sphere at the camera origin.  Fixed:
 *      add a small forward bias when the marker is exactly under the
 *      user, so it appears just in front instead of inside the camera.
 *
 *   3. Scene/group setup happened inside an async onContextCreate, but
 *      the marker-population effect ran synchronously on first mount.
 *      Result: the very first set of markers was silently dropped.
 *      Fixed: the population logic runs at the end of onContextCreate
 *      AND in the markers/userPos effect, with a ready-flag gate.
 *
 *   4. Heading north was modelled as -Z, but flat-earth ENU has north
 *      as -Z too — fine. Heading rotation needs to spin the world
 *      around the camera in the OPPOSITE direction the user turns
 *      (so a 90° clockwise turn appears to spin the world 90° CCW).
 *      Fixed: scene group rotates by -heading (was rotating camera,
 *      which doesn't change relative orientation when camera also
 *      rotates the same way — net zero).
 *
 *   5. requestAnimationFrame in expo-gl needs gl.endFrameEXP() at the
 *      end of every frame for the new buffer to swap to screen.
 *      Was already present, but the outer `if` guard sometimes skipped
 *      it on the first frame before refs were ready, leaving a black
 *      canvas. Fixed: always call endFrameEXP, even on no-op frames.
 *
 * Position locking: cairn world positions are recomputed every frame
 * from the smoothed user position, but the marker's absolute lat/lng
 * never changes — so cairns appear glued to a real-world place even
 * as the user walks past or turns.
 */
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import type { Marker } from '../store/useMarkerStore';
import { getAR3DConfig } from '../screens/ARScreen';
import { crashLogger } from '../services/crashLogger';

interface Props {
  markers: Marker[];
  userPos: { lat: number; lng: number } | null;
  userHeading: number | null;
}

// Camera horizontal field of view (matches the iPhone rear camera at 1×).
const CAMERA_FOV_DEG = 65;

// Visible range in metres. Cairns farther than this are hidden.
const AR_MAX_RANGE_M = 100;

// Smoothing factors — smaller = more inertia, less jitter.
const POS_ALPHA = 0.2;
const HEADING_ALPHA = 0.3;

// Eye height: how high above the ground we treat the camera + cairns.
// 1.5m ≈ phone held at chest level. Cairns share this height so the
// user looks straight at them instead of having to tilt the phone down.
const EYE_HEIGHT = 1.5;

// Minimum forward distance for a "right at my feet" cairn. If the marker
// is closer than 0.5m to the user, we still push it 0.5m in front so it
// renders just ahead of the camera instead of overlapping with it.
const MIN_FORWARD_DIST = 0.5;

/**
 * Convert a marker's lat/lng into a Three.js world position relative
 * to the user. Coordinates are in metres in the local ENU frame:
 *   x = east, y = up, z = -north (so -Z points "forward / north").
 *
 * The cairn sits at EYE_HEIGHT so it matches the camera height —
 * critical for the user to actually see it without tilting the phone.
 */
function gpsToWorld(
  user: { lat: number; lng: number },
  marker: { lat: number; lng: number },
): THREE.Vector3 {
  const dLat = marker.lat - user.lat;
  const dLng = marker.lng - user.lng;
  const northM = dLat * 111000;
  const eastM = dLng * 111000 * Math.cos(user.lat * Math.PI / 180);

  // If the marker is essentially at the user's feet (default plant-at-
  // user behaviour), nudge it forward so it doesn't sit inside the
  // camera. The forward direction is "north" (-Z) by default — heading
  // rotation will swing the whole scene group later so the bias ends
  // up in front of the user regardless of which way they're facing.
  const horizontalDist = Math.hypot(northM, eastM);
  if (horizontalDist < MIN_FORWARD_DIST) {
    return new THREE.Vector3(0, EYE_HEIGHT, -MIN_FORWARD_DIST);
  }
  return new THREE.Vector3(eastM, EYE_HEIGHT, -northM);
}

export function AR3DCairnOverlay({ markers, userPos, userHeading }: Props) {
  // Smoothed copies of position + heading. Refs (not state) so updates
  // don't re-render the GLView — we mutate the Three.js scene directly
  // each frame instead.
  const smoothedPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const smoothedHeadingRef = useRef<number>(0);

  // Three.js handles, all populated inside onContextCreate.
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  // Group holds all cairn meshes. Rotated by -heading so the whole
  // world appears to spin around the user as they turn the phone.
  const cairnGroupRef = useRef<THREE.Group | null>(null);
  const rafRef = useRef<number | null>(null);
  // Ready flag — true once onContextCreate has set up scene/camera/group.
  // The marker-population effect waits for this before adding meshes,
  // and re-runs as soon as the scene is ready.
  const readyRef = useRef<boolean>(false);
  // Latest markers + user position, captured by ref so the population
  // effect can read them after a delay (when readiness is achieved).
  const markersRef = useRef<Marker[]>(markers);
  markersRef.current = markers;

  // Update smoothed position whenever raw inputs change.
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

  // Update smoothed heading. Handle 359°→1° wraparound.
  useEffect(() => {
    if (userHeading == null) return;
    const prev = smoothedHeadingRef.current;
    let delta = userHeading - prev;
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;
    smoothedHeadingRef.current = (prev + delta * HEADING_ALPHA + 360) % 360;
  }, [userHeading]);

  // Re-populate the cairn group whenever markers change. Re-runs
  // automatically once the scene is ready (the population function
  // also runs at the end of onContextCreate to catch the initial
  // markers that were dropped before readiness).
  useEffect(() => {
    populateCairns();
  }, [markers, userPos?.lat, userPos?.lng]);

  function populateCairns() {
    const group = cairnGroupRef.current;
    if (!group || !readyRef.current) return;
    const userP = smoothedPosRef.current ?? userPos;
    if (!userP) return;

    // Remove old children with cleanup.
    while (group.children.length > 0) {
      const c = group.children[0];
      group.remove(c);
      const mesh = c as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (Array.isArray(mesh.material)) mesh.material.forEach((mm: THREE.Material) => mm.dispose());
        else (mesh.material as THREE.Material).dispose();
      }
    }

    // Add new meshes.
    let added = 0;
    for (const m of markersRef.current) {
      const pos = gpsToWorld(userP, { lat: m.lat, lng: m.lng });
      // Cull distant cairns (xy plane only — y is fixed at eye height).
      const horizontal = Math.hypot(pos.x, pos.z);
      if (horizontal > AR_MAX_RANGE_M) continue;

      const cfg = getAR3DConfig(m.type);
      const colorHex = parseInt(cfg.color.replace('#', ''), 16);
      // Sphere radius — closer = bigger, but never below 0.25m so even
      // far cairns stay visible. At 0m we get ~0.45m diameter spheres.
      const r = Math.max(0.25, 0.5 - horizontal / 400);
      const geom = new THREE.SphereGeometry(r, 24, 18);
      const mat = new THREE.MeshStandardMaterial({
        color: colorHex,
        metalness: 0.2,
        roughness: 0.4,
        emissive: colorHex,
        emissiveIntensity: 0.25,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.copy(pos);
      (mesh as any).__marker = m;
      group.add(mesh);
      added += 1;
    }
    crashLogger.breadcrumb(`ar3d:populated count=${added} total=${markersRef.current.length}`);
  }

  const onContextCreate = (gl: WebGL2RenderingContext) => {
    try {
      const { drawingBufferWidth: w, drawingBufferHeight: h } = gl;

      const renderer = new Renderer({ gl, alpha: true, antialias: true } as any) as any;
      renderer.setSize(w, h);
      // Fully transparent — the expo-camera CameraView shows behind us.
      renderer.setClearColor(0x000000, 0);
      rendererRef.current = renderer;

      const scene = new THREE.Scene();
      sceneRef.current = scene;

      // PerspectiveCamera at eye height, looking horizontally toward
      // -Z (north). This matches how a person holding a phone looks
      // at the world: forward, not down. With the camera at y=EYE_HEIGHT
      // and cairns also at y=EYE_HEIGHT, the user sees them directly
      // ahead — no tilting required.
      const camera = new THREE.PerspectiveCamera(
        CAMERA_FOV_DEG,
        w / h,
        0.1,
        AR_MAX_RANGE_M * 2,
      );
      camera.position.set(0, EYE_HEIGHT, 0);
      camera.lookAt(0, EYE_HEIGHT, -1); // look horizontally toward -Z
      cameraRef.current = camera;

      // Lighting — ambient + a sun-from-above directional. Without
      // these, MeshStandardMaterial renders pure black.
      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const sun = new THREE.DirectionalLight(0xffffff, 0.9);
      sun.position.set(3, 8, 3);
      scene.add(sun);

      // Cairn group — rotated by -heading every frame so the world
      // spins relative to the user, not the camera.
      const group = new THREE.Group();
      scene.add(group);
      cairnGroupRef.current = group;
      readyRef.current = true;
      crashLogger.breadcrumb(`ar3d:context-ready w=${w} h=${h}`);

      // Populate with whatever markers are currently in props — this
      // catches the initial set that the markers/userPos effect tried
      // to add before readyRef was true.
      populateCairns();

      const renderFrame = () => {
        // Always re-compute world positions from smoothed user pos.
        const userP = smoothedPosRef.current;
        if (userP && cairnGroupRef.current) {
          cairnGroupRef.current.children.forEach((child: THREE.Object3D) => {
            const m = (child as any).__marker as Marker | undefined;
            if (!m) return;
            const pos = gpsToWorld(userP, { lat: m.lat, lng: m.lng });
            child.position.copy(pos);
          });
          // Rotate the entire group by -heading. This spins the world
          // around the user: when the user turns 90° clockwise, the
          // group spins 90° counter-clockwise so the cairn that was on
          // the left is now in front, etc.
          const yaw = -(smoothedHeadingRef.current * Math.PI) / 180;
          cairnGroupRef.current.rotation.y = yaw;
        }
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
          rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
        // ALWAYS swap the buffer, even on no-op frames. Skipping this
        // leaves the GLView showing whatever was on it last (often the
        // initial black clear), which is exactly the v18 symptom.
        (gl as any).endFrameEXP();
        rafRef.current = requestAnimationFrame(renderFrame);
      };
      renderFrame();
    } catch (err) {
      crashLogger.breadcrumb(`ar3d:context-error ${String(err).slice(0, 100)}`);
    }
  };

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      readyRef.current = false;
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

  // Mount the GLView even when there are no markers — we want the
  // GL context ready as soon as the user opens the AR screen, so the
  // very first cairn they plant appears immediately. Hiding the
  // canvas when no userPos is intentional: without GPS we can't
  // anchor anything anyway.
  if (!userPos) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <GLView style={StyleSheet.absoluteFillObject} onContextCreate={onContextCreate} />
    </View>
  );
}
