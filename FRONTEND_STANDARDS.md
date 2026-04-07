# Frontend Design Standards

## Quality Benchmark
The minimum quality bar for all frontend work in this factory is **FrankProject** (`C:\ClaudeCodeProjects\FrankProject`):
- Smooth animations on all interactive elements (hover, active, loading)
- Fluid typography and spacing using `clamp()`
- Full light/dark theme support via CSS custom properties
- Mobile-first layout, works at 375px without horizontal scroll
- Every interactive element has hover, active, disabled, and loading states
- Designed empty states and error states — never a blank screen

FrankProject scores approximately 7.5/10 visually. New projects must meet or exceed this. The key area where new projects must exceed FrankProject: **icon system** (FrankProject uses emoji; new projects must use consistent SVG icons).

See `docs/BENCHMARK.md` for the detailed FrankProject frontend analysis.

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
