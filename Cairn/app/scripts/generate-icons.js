/**
 * generate-icons.js — generate icon.png/adaptive-icon.png/splash-icon.png
 * from a CairnLogo-style SVG (3 stones) with NZ-flavored deep forest green
 * background.
 *
 * Run: node scripts/generate-icons.js
 *
 * Output:
 *   assets/icon.png            — 1024×1024 (iOS app icon)
 *   assets/adaptive-icon.png   — 1024×1024 (Android adaptive foreground, safe-zone aware)
 *   assets/splash-icon.png     — 1024×1024 (splash screen, transparent bg)
 *   assets/favicon.png         — 48×48 (web favicon)
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ASSETS = path.join(__dirname, '..', 'assets');

// NZ forest greens (sage/moss palette, NOT neon)
const BG_DARK = '#3d5a2e'; // deep moss
const BG_LIGHT = '#5d7c46'; // sage highlight (subtle gradient top)
const STONE_LIGHT = '#f5f1e6'; // warm cream (NZ tussock-grass tone)
const STONE_SHADOW = '#2d4a20'; // darker green for stone underside

// Gradient: top slightly lighter → bottom darker (natural lighting)
function bgSvg(size) {
  return `
    <defs>
      <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${BG_LIGHT}" stop-opacity="1"/>
        <stop offset="100%" stop-color="${BG_DARK}" stop-opacity="1"/>
      </linearGradient>
      <radialGradient id="vignette" cx="0.5" cy="0.5" r="0.7">
        <stop offset="0%" stop-color="${BG_DARK}" stop-opacity="0"/>
        <stop offset="100%" stop-color="${BG_DARK}" stop-opacity="0.35"/>
      </radialGradient>
    </defs>
    <rect width="${size}" height="${size}" fill="url(#bgGrad)"/>
    <rect width="${size}" height="${size}" fill="url(#vignette)"/>
  `;
}

/**
 * 3-stone cairn (matches CairnLogo.tsx geometry, scaled to fill 1024 viewBox).
 * Centered, occupies ~60% of the canvas leaving generous breathing room
 * for iOS's automatic squircle mask.
 */
function cairnSvg(size, scale = 0.55) {
  const cx = size / 2;
  const cy = size / 2;
  // Reference geometry from CairnLogo.tsx (viewBox 22×30):
  //   base   stone: cx=9.5  cy=22  rx=7.5  ry=2.4
  //   middle stone: cx=8.5  cy=17  rx=5.5  ry=2.0
  //   top    stone: cx=11   cy=12.5 rx=3.4 ry=1.7
  // We scale by `scale * size / 22` and re-center.
  const u = (scale * size) / 22;

  // Map original coordinates onto canvas centered at (cx, cy).
  // Original logo geometry spans x:[2..17], y:[10.8..24.4] in the 22×30 viewBox.
  // True visual center: (10, 17.5). Anchor cairn slightly above geometric
  // center so the bottom shadow has space — final visual center settles at
  // (10, 16.5) which then maps to canvas center.
  const ox = 10;
  const oy = 16.5;
  const project = (px, py) => ({
    x: cx + (px - ox) * u,
    y: cy + (py - oy) * u,
  });

  const base = { p: project(10, 22), rx: 7.5 * u, ry: 2.4 * u };
  const mid = { p: project(10, 17), rx: 5.5 * u, ry: 2.0 * u };
  const top = { p: project(10, 12.5), rx: 3.4 * u, ry: 1.7 * u };

  const stone = (s, shadowOp) => `
    <ellipse cx="${s.p.x}" cy="${s.p.y}" rx="${s.rx}" ry="${s.ry}" fill="${STONE_LIGHT}"/>
    <path d="M ${s.p.x - s.rx} ${s.p.y} a ${s.rx} ${s.ry} 0 0 0 ${s.rx * 2} 0" fill="${STONE_SHADOW}" opacity="${shadowOp}"/>
  `;

  // Soft drop-shadow under the cairn for grounding
  const shadowY = base.p.y + base.ry * 0.85;
  const shadowRx = base.rx * 1.1;

  return `
    <ellipse cx="${cx}" cy="${shadowY}" rx="${shadowRx}" ry="${base.ry * 0.5}" fill="#000" opacity="0.18"/>
    ${stone(base, 0.25)}
    ${stone(mid, 0.22)}
    ${stone(top, 0.18)}
  `;
}

function buildSvg(size, opts = { background: true }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${opts.background ? bgSvg(size) : ''}
  ${cairnSvg(size, opts.scale ?? 0.55)}
</svg>`;
}

async function ensureAssetsDir() {
  if (!fs.existsSync(ASSETS)) {
    fs.mkdirSync(ASSETS, { recursive: true });
  }
}

async function main() {
  await ensureAssetsDir();

  // 1. icon.png — full square with green background
  const iconSvg = buildSvg(1024);
  await sharp(Buffer.from(iconSvg)).png().toFile(path.join(ASSETS, 'icon.png'));
  console.log('✓ icon.png (1024×1024)');

  // 2. adaptive-icon.png — Android adaptive foreground; smaller stones to
  //    fit the central safe zone (40% of canvas), background is the green tile
  const adaptiveSvg = buildSvg(1024, { background: true, scale: 0.40 });
  await sharp(Buffer.from(adaptiveSvg)).png().toFile(path.join(ASSETS, 'adaptive-icon.png'));
  console.log('✓ adaptive-icon.png (1024×1024, safe-zone scale)');

  // 3. splash-icon.png — transparent background, larger stones for splash screen
  const splashSvg = buildSvg(1024, { background: false, scale: 0.50 });
  await sharp(Buffer.from(splashSvg)).png().toFile(path.join(ASSETS, 'splash-icon.png'));
  console.log('✓ splash-icon.png (1024×1024, transparent)');

  // 4. favicon.png — 48×48 small icon for web
  const faviconSvg = buildSvg(48);
  await sharp(Buffer.from(faviconSvg)).png().toFile(path.join(ASSETS, 'favicon.png'));
  console.log('✓ favicon.png (48×48)');
}

main().catch((err) => {
  console.error('icon generation failed:', err);
  process.exit(1);
});
