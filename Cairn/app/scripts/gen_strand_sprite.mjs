/**
 * Generate strand sprite PNG into app/assets/ar/strand_sprite.png
 *
 * The sprite is a vertically-elongated soft glow used by ViroParticleEmitter
 * to fake a "rising chiral strand" — when many sprites stack vertically with
 * upward velocity + slight horizontal jitter + alpha fade, the cumulative
 * effect reads as a wavy, thickness-varying golden thread (DS aesthetic).
 *
 * Run from app dir:
 *   node scripts/gen_strand_sprite.mjs
 */
import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'assets', 'ar');

// 256×512 (taller than wide) — base sprite. Each particle ViroParticleEmitter
// will additive-blend, so brightness stacks. Soft radial+vertical gradient.
const W = 128, H = 512;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <!-- Vertical streak: bright spine fading horizontally and tapering top/bottom -->
    <linearGradient id="taper" x1="0" y1="0" x2="0" y2="${H}">
      <stop offset="0%"   stop-color="#ffd690" stop-opacity="0"/>
      <stop offset="20%"  stop-color="#ffd690" stop-opacity="0.85"/>
      <stop offset="50%"  stop-color="#ffe0a0" stop-opacity="1.0"/>
      <stop offset="80%"  stop-color="#ffd690" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#ffd690" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="hsoft" x1="0" y1="0" x2="${W}" y2="0">
      <stop offset="0%"   stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="50%"  stop-color="#ffffff" stop-opacity="1"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <mask id="hmask">
      <rect width="${W}" height="${H}" fill="url(#hsoft)"/>
    </mask>
    <filter id="blur" x="-20%" y="-10%" width="140%" height="120%">
      <feGaussianBlur stdDeviation="6"/>
    </filter>
  </defs>

  <!-- Outer soft halo -->
  <rect width="${W}" height="${H}" fill="url(#taper)" mask="url(#hmask)" filter="url(#blur)" opacity="0.55"/>
  <!-- Inner crisp spine -->
  <rect x="${W * 0.40}" y="0" width="${W * 0.20}" height="${H}"
        fill="url(#taper)" filter="url(#blur)" opacity="0.85"/>
  <!-- Hot core -->
  <rect x="${W * 0.46}" y="${H * 0.10}" width="${W * 0.08}" height="${H * 0.80}"
        fill="#fff8e0" opacity="0.95" filter="url(#blur)"/>
</svg>`;

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const out = join(OUT_DIR, 'strand_sprite.png');
  await writeFile(out, png);
  console.log(`wrote ${out}  (${png.length} bytes)`);
}

main().catch(e => { console.error(e); process.exit(1); });
