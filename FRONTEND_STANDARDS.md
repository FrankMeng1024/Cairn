# Frontend Design Standards

## Quality Benchmark
Minimum quality bar for all frontend work in this factory:
- Smooth animations on all interactive elements (hover, active, loading)
- Fluid typography and spacing using `clamp()`
- Full light/dark theme support via CSS custom properties
- Mobile-first layout, works at 375px without horizontal scroll
- Every interactive element has hover, active, disabled, and loading states
- Designed empty states and error states — never a blank screen
- Inline SVG icon system — consistent weight and style, one set per project

See `docs/BENCHMARK.md` if the project defines a higher bar.

## Icon System
- **Never** use emoji as icons in production UI — they render at different sizes, styles, and positions across platforms
- **Never** use raw Unicode characters (▶ ✕ ☰ →) as primary icons
- **Always** use inline SVG icons — self-contained, scale perfectly, styleable with CSS `currentColor`
- Icon style (line weight, corner style, fill vs stroke) decided in Sprint 0 and documented in `UI_SPEC.md` — one style for the entire project
- Recommended open-source SVG icon sets: Heroicons (stroke-based, clean), Lucide (consistent weight), Phosphor (multiple weights). Pick one per project in Sprint 0.

## Visual Quality Bar
Every Sprint's frontend must meet this bar before QA signs off:
- **Typography**: consistent scale, line-height appropriate for context (1.4 compact, 1.6 body, 1.7+ reading)
- **Spacing**: all spacing from CSS variable system, no magic pixel numbers in component CSS
- **Competitive reference**: before implementing each component, reference 1-2 mainstream products in the same domain for interaction patterns. Note the reference in Story Notes. Skip only if no comparable product exists.
- **Color**: all colors from the design token system, no hardcoded values outside `variables.css`
- **Animation**: micro-interactions present and smooth — button press, loading spinner, skeleton loaders
- **Interactive states**: hover, active, disabled, focus — every interactive element, no exceptions
- **Empty states**: designed, not blank
- **Error states**: inline messages with appropriate visual styling, not browser alerts

## CSS Framework Choice
- **Vanilla CSS with modules**: default for projects with ≤ 8 pages. Split by concern: `variables.css`, `layout.css`, `components.css`, feature-specific files.
- **Tailwind CSS via CDN**: option for projects with rich, varied UI. No build step.

Decision made by Arch in Sprint 0, documented in `UI_SPEC.md`.

## CSS Design System
Every project defines a design token file (e.g. `css/variables.css`) before any component CSS is written. The token file establishes:

```css
:root {
  /* Brand colors — values set per project after Sprint 0 style confirmation */
  --primary: ;              /* main brand color */
  --primary-end: ;          /* gradient end (can equal --primary for flat) */
  --primary-gradient: linear-gradient(135deg, var(--primary), var(--primary-end));
  --bg: ;                   /* page background */
  --card: ;                 /* surface/card background */
  --text: ;                 /* primary text */
  --text2: ;                /* secondary/muted text */
  --border: ;               /* dividers and borders */

  /* Semantic colors — consistent across projects */
  --success: #10b981;
  --error: #ef4444;
  --warning: #f59e0b;
  --info: #3b82f6;

  /* Fluid spacing */
  --spacing-xs: clamp(6px, 1.5vw, 8px);
  --spacing-sm: clamp(8px, 2vw, 12px);
  --spacing-md: clamp(12px, 3vw, 16px);
  --spacing-lg: clamp(16px, 4vw, 24px);

  /* Fluid typography */
  --font-xs: clamp(10px, 2.5vw, 12px);
  --font-sm: clamp(12px, 3vw, 14px);
  --font-md: clamp(14px, 3.5vw, 16px);
  --font-lg: clamp(18px, 4.5vw, 22px);

  /* Layout — set per project */
  --header-h: ;
  --radius-sm: ;
  --radius-md: ;
  --radius-lg: ;
}

.dark {
  /* Dark mode overrides — all from confirmed style */
}
```

## JS Organization (Vanilla JS SPA pattern)
- `js/api.js`: fetch wrapper with auth header, 401 handling
- `js/state.js`: global state, getters/setters
- `js/utils.js`: pure utility functions (date formatting, string helpers, etc.)
- `js/init.js`: SPA entry point — reads pathname, imports correct module, handles navigation
- `js/modules/<feature>.js`: one file per page/feature, exports `init()`
- No inline event handlers in HTML (`onclick=`, `onchange=`)

For non-SPA frameworks (React, Vue, Next.js): follow that framework's conventions instead.

## MCP-Assisted Development

These MCP servers are installed globally and must be used at the specified trigger points. Using them is not optional — they directly raise output quality.

### context7 — Live Library Docs (mandatory)

**When to use**: Before writing any code that depends on an external npm library.

**How**: 
1. `resolve-library-id` with the library name (e.g. `tailwindcss`, `gsap`, `framer-motion`, `@shadcn/ui`)
2. `get-library-docs` with the returned ID to fetch current, version-correct documentation

**Required for**: Tailwind CSS utility classes, GSAP ScrollTrigger API, shadcn/ui component props, React hooks, Framer Motion variants — any library where Claude might use a stale or hallucinated API.

**Why**: Library APIs change between versions. Using context7 ensures the code matches what's actually installed, not what was documented 12 months ago. This is the single highest-leverage tool for preventing "it looked right but broke at runtime" bugs.

### UI Style Reference — Technical Capability Library

The `docs/ui-demos/` directory in the DRI project contains production-quality reference implementations. These demonstrate **what is technically achievable** — not what to copy.

| File | Stack | Key techniques |
|------|-------|----------------|
| `demo-1-pure-css.html` | Pure CSS | `@keyframes`, blob backgrounds, CSS scroll-driven animations, clip-path |
| `demo-2-tailwind-shadcn.html` | Tailwind CDN + shadcn language | Inter font, neutral palette, utility-first, SVG progress bars |
| `demo-3-gsap.html` | GSAP 3 + ScrollTrigger | Stagger reveals, parallax, counter animations, timeline sequences |
| `demo-4-framer.html` | Framer Motion aesthetic | Spring easing `cubic-bezier(0.34,1.56,0.64,1)`, magnetic buttons, card tilt, cursor glow |
| `demo-5-ultimate.html` | All techniques combined | The **craft and polish ceiling** — every component at maximum quality |

**`demo-5-ultimate.html` proves the quality ceiling.** When you look at demo-5, the question is not "how do I reproduce this?" — it is "can I match this level of craft and polish for *my* product's unique character?"

---

### Sprint 0 — Product Soul Protocol (mandatory before any UI code)

Before touching a line of CSS, Arch and Frontend Dev must answer three questions. Answers go into `docs/UI_SPEC.md`:

1. **What is this product's emotional core?**
   - Is it energising, calming, playful, authoritative, mysterious, warm, precise?
   - Example: news aggregator = authoritative + urgent. Idea generator = expansive + electric. Music app = fluid + emotional.

2. **What visual metaphor expresses it?**
   - What images, textures, movements, or metaphors are native to this domain?
   - Example: news = ink, paper, breaking headlines, urgency. Ideas = sparks, neural connections, open space. Nature app = organic growth, breathing rhythms.

3. **How does the interaction reinforce the product story?**
   - Every hover, transition, cursor, and scroll effect should make the user feel the product's character — not just look polished.
   - Example: idea tool cursor = small lightbulb or spark dot. News cursor = small newspaper. Finance = precise grid cursor. Game = pixel or controller icon.

**These answers are the creative brief.** All UI decisions trace back to them. An effect that looks great on demo-5 but contradicts the product soul is the wrong choice.

---

### Quality Bar — What Must Be True (not how to achieve it)

Every Sprint's frontend must meet these quality principles. **How** to achieve them is your creative decision — derive it from the product soul, not from a template.

**Motion & Interaction Quality**:
- Every interactive element has a response — hover, active, focus, disabled states are all designed, not default
- Entrances are earned — elements entering the viewport should feel intentional, not instant
- Transitions have physics — easing curves reflect the product character (spring = playful/energetic, ease-out = precise/professional, ease-in-out = calm/balanced)
- Loading states are designed — skeleton loaders, spinners, progress are on-brand, not browser-default

**Visual Craft Quality**:
- Typography is intentional — size scale, weight, line-height, and letter-spacing all set for context
- Spacing breathes — generous whitespace, consistent rhythm, no cramped layouts
- Color tells the story — palette derived from product soul, all from the design token system
- Empty and error states are designed — never a blank area, never a raw error string

**Thematic Imagination (required, not optional)**:
- At least one signature element per project that is unique to its domain — something that signals "this was made for this product, not assembled from templates"
- This can be: a custom cursor, a themed background pattern, a domain-specific icon language, an interaction metaphor native to the content, an animation that echoes the product's core action
- Borrowing technique from demo-5 is encouraged. Borrowing demo-5's *visual identity* is not — every project earns its own

---

### Thematic Imagination Examples

These are **inspiration examples** — adapt them, invent your own. The goal is that a first-time user should be able to *feel* what the product does from the UI alone.

| Product type | Possible signature elements |
|---|---|
| News / Media | Breaking-news ticker animation, ink-bleed text reveals, newspaper fold hover effect, urgency pulsing on live indicators |
| Idea / Creative tool | Spark burst on generation, constellation background (dots connecting), lightbulb cursor, hand-drawn sketch feel for drafts |
| Finance / Data | Grid lines, precise decimal counters, chart line drawing animation, monospace numbers, ultra-clean micro-typography |
| Music / Audio | Waveform animations, equaliser bars, vinyl rotation, beat-sync hover pulses |
| Health / Wellness | Breathing animations (scale in/out on inhale/exhale), organic blob backgrounds, soft gradients, rounded everything |
| Productivity / SaaS | Fast transitions (no lingering), keyboard shortcut indicators, compact density, status-dot indicators |
| Gaming | Pixel cursor, scan-line effects, XP bar animations, achievement-style toasts |
| Travel / Exploration | Map-pin drops, route-draw animations, horizon gradients, destination card flip |

---

### Dark / Light Theme

Every project must support both modes via CSS custom properties:

```css
:root { /* dark defaults */ }
[data-theme="light"] { /* light overrides — ~30 vars */ }
* { transition: background-color .3s ease, border-color .3s ease, color .3s ease; }
```

Toggle stored in `localStorage`. No flash on load (IIFE reads `localStorage` before first paint).

---

### Technical Techniques Available (reference when needed)

These techniques are in the demo library. Use them when they serve the product soul — not because they are on this list.

- Animated mesh gradient / floating orb background — for products that feel alive or expansive
- CSS `@property` border beam — for products with precision or energy
- `IntersectionObserver` fadeUp reveals — universal entrance pattern, adapt timing to character
- Spring easing `cubic-bezier(0.34,1.56,0.64,1)` — playful, energetic interactions
- `ease-out` curves — professional, confident interactions
- Counter animation on scroll — for stats, numbers that carry weight
- Magnetic buttons — for high-delight consumer products
- 3D card tilt (`perspective` + `rotateX/Y`) — for card-heavy layouts
- Glass morphism (`backdrop-filter: blur()`) — for layered, depth-forward designs
- Cursor custom element — mandatory to consider for every project (default: 6px brand dot; theme it per product soul)
- Shimmer sweep on buttons — for CTAs that need to stand out
- Scroll-driven animations (`animation-timeline: scroll()`) — for narrative, sequential content
