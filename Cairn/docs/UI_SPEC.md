# UI_SPEC.md — Cairn

## Confirmed Style Direction
**Style B: Natural Warm** (confirmed at CP1)

---

## Design System

### Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--primary` | `#5d7c46` | Primary actions, active states, trail lines |
| `--primary-light` | `rgba(93,124,70,0.15)` | Backgrounds, subtle highlights |
| `--bg` | `#faf7f2` | App background |
| `--surface` | `#ffffff` | Cards, sheets, overlays |
| `--border` | `#ece6de` | Subtle borders |
| `--text-primary` | `#2d2a26` | Headings, body text |
| `--text-secondary` | `#8c7e72` | Labels, captions |
| `--text-muted` | `#b5a99d` | Disabled, placeholder |
| `--danger` | `#c53d2e` | Danger markers, critical alerts |
| `--danger-bg` | `#f4e0dc` | Danger marker background |
| `--warning` | `#b36b00` | Weather advisories |
| `--warning-bg` | `#fff3e0` | Warning background |
| `--info` | `#2e6cc5` | Scenic markers, info |
| `--info-bg` | `#dce8f4` | Info marker background |
| `--success` | `#2e8c3a` | Supply markers, GPS active |
| `--success-bg` | `#dcf4de` | Supply marker background |

### Typography

| Level | Size | Weight | Use |
|-------|------|--------|-----|
| H1 | 28px | 700 | Screen title |
| H2 | 20px | 700 | Section headers |
| H3 | 17px | 600 | Card titles |
| Body | 15px | 400 | Main text |
| Caption | 13px | 500 | Subtitle, labels |
| Small | 11px | 500 | Stats, chips |
| Tiny | 9px | 600 | Nav labels |

Font: System (-apple-system / SF Pro Display)

### Spacing

Base unit: 4px. Use multiples: 4, 8, 12, 16, 20, 24, 32.

### Border Radius

| Element | Radius |
|---------|--------|
| Cards | 14-20px |
| Buttons | 12px |
| Chips/Pills | 20px (full round) |
| Map container | 20px |
| Markers | 50% (circle) |
| Bottom sheet | 20px 20px 0 0 |

### Shadows

- Card: `0 4px 20px rgba(0,0,0,0.08)`
- FAB: `0 4px 16px rgba(93,124,70,0.35)`
- Overlay: `0 -4px 20px rgba(0,0,0,0.06)`

---

## Product Soul

### Emotional Core
"独处时感受到人类温度" — 一个人在步道上，但知道有人来过这里、为你留下了什么。

### Visual Metaphor
Cairn（石堆路标）— 真实世界中数千年的传统，简单的石头堆叠，为后来者指路。

### Interaction Story
打开app → 看到地图上散落的温暖标记 → 接近一个标记 → 展开看到内容和距离 → 感到安全/感动 → 在自己觉得值得标记的地方轻轻点一下插旗按钮 → 简单几秒操作 → 继续走路

---

## Marker Visual System

### Flag Types (Map Pin View — Phase 1)

| Type | Icon | Border Color | Background | Label Example |
|------|------|--------------|------------|---------------|
| Danger ⚠️ | `!` | `--danger` | `--danger-bg` | "Slippery" |
| Scenic 🏔️ | `★` | `--info` | `--info-bg` | "Vista" |
| Supply 💧 | `+` | `--success` | `--success-bg` | "Water" |
| Junction ↗️ | `→` | `--warning` | `--warning-bg` | "Left fork" |
| Free 💬 | `○` | `--text-secondary` | `--surface` | User text |

### Marker States

- Default: 28px circle, border + bg + icon
- Selected: expand to card (title + text + distance + time ago)
- Friend marker: adds small avatar ring
- System marker (DOC): distinct official badge style

---

## Mode UI Differences

### Hiking Mode
- Full map interaction
- Markers visible as interactive pins
- Bottom sheet with route stats
- FAB for marking visible

### Running Mode
- Map minimal/locked
- Large compass arrow for direction
- Voice-only interaction
- Screen can be off
- Single "mark later" button for post-run review

---

## Beginner vs Expert Mode

### Beginner (Default for new users)
- Markers have text labels below icons
- First-time tooltips on key actions
- Permission picker has full explanations
- Route stats include unit explanations

### Expert
- Icons only, no labels
- No tooltips
- Permission picker is icon-only quick select
- Minimal chrome, maximum map space
