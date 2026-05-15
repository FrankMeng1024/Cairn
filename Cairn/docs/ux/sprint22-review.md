# UX Review — Sprint 22

**Sprint**: 22
**Reviewer**: UX subagent (claude-opus-4-6)
**Confidence**: HIGH

## Overall Assessment

Sprint 22 delivers a polished set of improvements that a first-time user would experience as a cohesive, premium outdoor app. The changes are subtle but effective: the auth splash feels inviting and purposeful, the home screen presents stats without confusion or visual noise, the route selection uses proper iconography that communicates state clearly, and the friends screen switches look standard and trustworthy. No friction points rise above 'Low' severity — the app flows naturally from first launch through core features.

## Friction Items

| Severity | Description | Screenshot |
|----------|-------------|------------|
| Low | The `--` placeholder for zero-distance stats is clear but slightly ambiguous on first encounter — a new user might momentarily wonder if data failed to load rather than understanding it means 'no distance recorded yet'. Context ('2 sessions' nearby) makes it inferrable. | home-02.png |
| Low | The radial glow behind the cairn logo on the auth splash is pleasant but very subtle — it reads as a soft warm halo rather than a distinct design element. Not a problem, but could be slightly more pronounced. | auth-splash-01.png |

## Untested Paths

- Dark mode appearance of the design token changes (if dark mode exists)
- Landscape orientation behavior of the auth splash animation
- Actual entrance animation timing (static screenshot cannot confirm motion smoothness)
- Edge case: extremely long stat values — does token system handle overflow gracefully?

## Knowledge Updates

- Sprint 22 design token migration is visually invisible to users (correct — tokens should not change appearance, only improve maintainability). Warm cream background and green accent palette remain consistent across all screens.
- Zero-value stat display using `--` and human-readable dates ('Today') is a clear UX improvement over raw numbers and ISO dates. Hidden secondary stats row when all zeros reduces clutter effectively.
- Lucide Check icon in RunningScreen route selection is a clear upgrade from unicode `✓` — reads as a proper UI element rather than text, reinforcing the premium app feel.
- AuthScreen splash redesign with larger stones, split tagline, and 56px buttons creates a strong first impression. Two-line tagline has good rhythm and communicates purpose quickly.
- Switch components in FriendsScreen show consistent white thumbColor — visually clean and standard mobile pattern.
- Navigation regression passed cleanly — no jarring transitions or lost state across all tested flows.
