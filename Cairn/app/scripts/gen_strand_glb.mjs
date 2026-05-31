/**
 * Generate 5 strand ribbon GLB meshes: app/assets/ar/strand_a..e.glb
 *
 * Each is a curved tube along a 5-control-point Catmull-Rom curve, 40m tall,
 * with along-length thickness modulation (0.18 → 0.30 → 0.18 m). Texture UVs
 * tile 4× along V so a texture scroll shader sees fast flow.
 *
 * Implementation: pure THREE.js (already in deps) for curve/tube generation,
 * then a hand-rolled minimal binary glTF (.glb) writer. NO new dependency.
 *
 * Run from app/:
 *   node scripts/gen_strand_glb.mjs
 *
 * GLB spec: https://github.com/KhronosGroup/glTF/tree/main/specification/2.0
 * - 12-byte header + JSON chunk + BIN chunk
 * - Mesh primitive uses TRIANGLES topology
 * - Accessors point into a single binary buffer for POSITION, NORMAL,
 *   TEXCOORD_0, INDICES.
 */
import * as THREE from 'three';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'assets', 'ar');

// ── Strand parameters ─────────────────────────────────────────
// v3 (post-v135): user reported strands invisible despite logs confirming
// load+render. Suspect: 0.04m base radius is too thin to see at 1m
// distance even with solid colour. Bump back to 0.08m base, 0.16m bulge.
// (v1 was 0.18 = white columns; v2 was 0.04 = invisible; v3 = 0.08 middle)
const STRAND_HEIGHT_M = 8;
const TUBULAR_SEGS = 96;
const RADIAL_SEGS = 8;
const BASE_RADIUS = 0.08;         // 0.04 → 0.08 (visible thread, not hairline)
const RADIUS_BULGE = 0.10;        // 0.06 → 0.10 (mid-strand swelling more obvious)
const RADIUS_WOBBLE = 0.03;
const UV_V_REPEAT = 3;

// 5 strand seeds — every strand now has non-zero jitter at every control
// point so NO strand is straight. Y values rescaled to STRAND_HEIGHT_M = 8m.
// Y heights: 0, 1.6, 3.6, 5.6, 8.0 (m) along the curve.
// Jitter scaled down proportionally to height (was ±0.6 at 40m → ±0.20 at 8m).
const SEEDS = [
  { name: 'a', jitter: [[ 0.05, 0.05], [ 0.18, 0.10], [-0.12, 0.20], [ 0.20,-0.08], [ 0.05,-0.05]] },
  { name: 'b', jitter: [[-0.05, 0.05], [-0.20, 0.12], [ 0.18,-0.16], [-0.12, 0.16], [ 0.05,-0.05]] },
  { name: 'c', jitter: [[ 0.05,-0.05], [ 0.10,-0.20], [-0.20, 0.10], [ 0.12, 0.20], [-0.05, 0.05]] },
  { name: 'd', jitter: [[-0.05,-0.05], [ 0.22, 0.05], [ 0.10,-0.22], [-0.16, 0.12], [ 0.05, 0.05]] },
  { name: 'e', jitter: [[ 0.05, 0.05], [-0.15,-0.12], [ 0.20, 0.18], [-0.10,-0.20], [-0.05, 0.05]] },
];

// ── Build one strand geometry ─────────────────────────────────
function buildStrandGeometry(jitter) {
  // Control points — 5 along Y axis, jittered in XZ.
  // Y values rescaled to STRAND_HEIGHT_M = 8m (was 40m for v1).
  const ys = [0, 1.6, 3.6, 5.6, 8.0];
  const points = ys.map((y, i) => new THREE.Vector3(jitter[i][0], y, jitter[i][1]));
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);

  // Generate constant-radius tube first
  const tube = new THREE.TubeGeometry(curve, TUBULAR_SEGS, BASE_RADIUS, RADIAL_SEGS, false);

  // Modulate radius along length: pinch near ends, swell mid, with low-freq
  // wobble. Each ring has (RADIAL_SEGS + 1) verts.
  const positions = tube.attributes.position.array;
  const ringVertCount = RADIAL_SEGS + 1;
  for (let s = 0; s <= TUBULAR_SEGS; s++) {
    const t = s / TUBULAR_SEGS;
    // Bell curve: zero-ish at t=0,1 ; peak at t=0.5
    const bell = Math.sin(t * Math.PI);
    const rTarget =
      BASE_RADIUS +
      RADIUS_BULGE * bell +
      RADIUS_WOBBLE * Math.sin(t * Math.PI * 6);
    const radiusScale = rTarget / BASE_RADIUS;

    // Centre of this ring (sample curve)
    const centre = curve.getPoint(t);

    for (let r = 0; r < ringVertCount; r++) {
      const idx = (s * ringVertCount + r) * 3;
      const px = positions[idx + 0];
      const py = positions[idx + 1];
      const pz = positions[idx + 2];
      // Vector from centre to vertex, scaled
      const dx = (px - centre.x) * radiusScale;
      const dy = (py - centre.y) * radiusScale;
      const dz = (pz - centre.z) * radiusScale;
      positions[idx + 0] = centre.x + dx;
      positions[idx + 1] = centre.y + dy;
      positions[idx + 2] = centre.z + dz;
    }
  }
  tube.attributes.position.needsUpdate = true;
  tube.computeVertexNormals();

  // Multiply UV.v by UV_V_REPEAT so texture tiles 4× along height
  const uvs = tube.attributes.uv.array;
  for (let i = 0; i < uvs.length; i += 2) {
    uvs[i + 1] = uvs[i + 1] * UV_V_REPEAT;
  }

  return tube;
}

// ── Minimal binary glTF (.glb) writer ─────────────────────────
// Layout:
//   Header (12 bytes)
//   JSON chunk
//   BIN chunk (POSITION + NORMAL + TEXCOORD_0 + INDICES)
function geometryToGLB(geom) {
  const pos = geom.attributes.position.array;       // Float32Array, vec3
  const nrm = geom.attributes.normal.array;         // Float32Array, vec3
  const uv  = geom.attributes.uv.array;             // Float32Array, vec2
  const idx = geom.index.array;                     // Uint32Array (TubeGeometry uses uint32)

  const vertexCount = pos.length / 3;

  // Per-attribute byte sizes
  const posBytes = pos.byteLength;
  const nrmBytes = nrm.byteLength;
  const uvBytes  = uv.byteLength;
  // Use UNSIGNED_INT (5125) for indices to match TubeGeometry's Uint32 default
  const idxIsUint16 = vertexCount < 65536;
  const indices = idxIsUint16 ? new Uint16Array(idx) : new Uint32Array(idx);
  const idxBytes = indices.byteLength;

  // Pack into one binary buffer with 4-byte alignment per view
  const align = (n) => (n + 3) & ~3;
  const posOffset = 0;
  const nrmOffset = align(posOffset + posBytes);
  const uvOffset  = align(nrmOffset + nrmBytes);
  const idxOffset = align(uvOffset + uvBytes);
  const totalBin  = align(idxOffset + idxBytes);

  const bin = new Uint8Array(totalBin);
  bin.set(new Uint8Array(pos.buffer, pos.byteOffset, posBytes), posOffset);
  bin.set(new Uint8Array(nrm.buffer, nrm.byteOffset, nrmBytes), nrmOffset);
  bin.set(new Uint8Array(uv.buffer, uv.byteOffset, uvBytes), uvOffset);
  bin.set(new Uint8Array(indices.buffer, indices.byteOffset, idxBytes), idxOffset);

  // Compute min/max for POSITION accessor (required by spec)
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) {
    if (pos[i + 0] < min[0]) min[0] = pos[i + 0];
    if (pos[i + 1] < min[1]) min[1] = pos[i + 1];
    if (pos[i + 2] < min[2]) min[2] = pos[i + 2];
    if (pos[i + 0] > max[0]) max[0] = pos[i + 0];
    if (pos[i + 1] > max[1]) max[1] = pos[i + 1];
    if (pos[i + 2] > max[2]) max[2] = pos[i + 2];
  }

  const json = {
    asset: { version: '2.0', generator: 'cairn gen_strand_glb.mjs' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{
      primitives: [{
        attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
        indices: 3,
        mode: 4, // TRIANGLES
        material: 0, // CRITICAL: Viro3DObject's `materials` prop overrides
                     // a mesh primitive's material slot. Without this,
                     // Viro native renderer falls back to a default white
                     // material and ignores props.materials entirely.
                     // (This is the v133-v136 white-strand bug root cause.)
      }],
    }],
    materials: [{
      name: 'strandSlot',
      pbrMetallicRoughness: {
        baseColorFactor: [1, 1, 1, 1],
        metallicFactor: 0.0,
        roughnessFactor: 1.0,
      },
    }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: vertexCount, type: 'VEC3', min, max }, // POSITION (FLOAT)
      { bufferView: 1, componentType: 5126, count: vertexCount, type: 'VEC3' },            // NORMAL
      { bufferView: 2, componentType: 5126, count: vertexCount, type: 'VEC2' },            // TEXCOORD_0
      {
        bufferView: 3,
        componentType: idxIsUint16 ? 5123 : 5125,
        count: indices.length,
        type: 'SCALAR',
      },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: posOffset, byteLength: posBytes, target: 34962 }, // ARRAY_BUFFER
      { buffer: 0, byteOffset: nrmOffset, byteLength: nrmBytes, target: 34962 },
      { buffer: 0, byteOffset: uvOffset,  byteLength: uvBytes,  target: 34962 },
      { buffer: 0, byteOffset: idxOffset, byteLength: idxBytes, target: 34963 }, // ELEMENT_ARRAY_BUFFER
    ],
    buffers: [{ byteLength: totalBin }],
  };

  // Encode JSON, pad to 4-byte boundary with spaces (0x20)
  let jsonStr = JSON.stringify(json);
  while (jsonStr.length % 4 !== 0) jsonStr += ' ';
  const jsonBytes = Buffer.from(jsonStr, 'utf8');

  // BIN chunk also padded with zeros to 4-byte boundary (already handled
  // above via align())
  const binPadded = bin; // totalBin already aligned

  // GLB total size
  const glbSize = 12 + 8 + jsonBytes.length + 8 + binPadded.length;
  const glb = Buffer.alloc(glbSize);
  let off = 0;

  // Header
  glb.writeUInt32LE(0x46546c67, off); off += 4;          // 'glTF'
  glb.writeUInt32LE(2, off); off += 4;                    // version
  glb.writeUInt32LE(glbSize, off); off += 4;              // total length

  // JSON chunk
  glb.writeUInt32LE(jsonBytes.length, off); off += 4;
  glb.writeUInt32LE(0x4e4f534a, off); off += 4;          // 'JSON'
  jsonBytes.copy(glb, off); off += jsonBytes.length;

  // BIN chunk
  glb.writeUInt32LE(binPadded.length, off); off += 4;
  glb.writeUInt32LE(0x004e4942, off); off += 4;          // 'BIN\0'
  Buffer.from(binPadded.buffer, binPadded.byteOffset, binPadded.byteLength).copy(glb, off);

  return glb;
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  for (const seed of SEEDS) {
    const geom = buildStrandGeometry(seed.jitter);
    const glb = geometryToGLB(geom);
    const out = join(OUT_DIR, `strand_${seed.name}.glb`);
    await writeFile(out, glb);
    const tris = geom.index.count / 3;
    const verts = geom.attributes.position.count;
    console.log(`wrote ${out}  (${glb.length} bytes, ${verts} verts, ${tris} tris)`);
  }
  console.log('\nDone. Drag any .glb into https://gltf-viewer.donmccurdy.com/ to inspect.');
}

main().catch(e => { console.error(e); process.exit(1); });
