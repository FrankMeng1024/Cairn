# TECH_SPEC.md — Cairn

## §type
Mobile App (React Native + Expo)

## §acceptance
`acceptance_mode: auto`
`ui_only_sprints: 3` (Sprints 3–5 were UI-only; user review completed after Sprint 5, full iteration resumes Sprint 6+)

## §stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Framework** | React Native + Expo SDK 52+ | 跨平台，Expo Go零配置测试，个人开发者最高效 |
| **Language** | TypeScript | 类型安全，大型项目必需 |
| **Map** | Mapbox React Native SDK | 离线地图支持、自定义图层、免费层25K MAU |
| **Navigation** | React Navigation 7 | RN标准导航库 |
| **State** | Zustand | 轻量、持久化方便（AsyncStorage） |
| **Local DB** | WatermelonDB | 离线优先、同步友好、React Native性能好 |
| **Auth** | Firebase Auth | 邮箱+Google+Apple登录，免费层足够 |
| **Backend** | Node.js + Express | 简单REST API |
| **Database** | MySQL 8 (existing server) | 用户现有服务器 |
| **TTS** | expo-speech | 系统TTS，支持压低音乐音量 |
| **GPS** | expo-location | 后台定位、地理围栏 |
| **Keep Awake** | expo-keep-awake | 运动中防息屏（跑步/徒步 tracking state） |
| **AR (Phase 2)** | expo-three + ARKit/ARCore | Phase 2加入 |
| **Icons** | lucide-react-native + react-native-svg | 统一SVG图标系统，2px stroke，替代emoji |

## §viewports
- Primary: iPhone 14/15 (390×844pt)
- Secondary: iPhone SE (375×667pt)
- Tertiary: Android mid-range (360×800dp)

## §start-script
`start.sh` — installs deps, starts backend, starts Expo dev server, confirms health check

## §test-runner
`scripts/test_runner.js`

## §test-config
`config/test.json`

## §git
- Strategy: A (auto-commit after each Story Done)
- Branch: direct to main

## §deploy
- Development: Expo Go on physical iPhone (LAN connection)
- Production (future): EAS Build → TestFlight → App Store

## §performance-targets
| Metric | Target |
|--------|--------|
| Health check | < 100ms |
| Map tile load (cached) | < 500ms |
| GPS fix | < 5s |
| Voice announcement delay | < 2s |
| Offline mode switch | < 1s |
| App cold start | < 3s |

## §spike-decision
Sprint 1 required. System dependencies to spike:
1. Mapbox offline map download + NZ tile coverage
2. expo-location background GPS accuracy in NZ bush environment
3. expo-speech TTS with music audio ducking
4. WatermelonDB offline-first sync strategy

## §ux-thresholds
- Navigation friction: 3 taps max to any primary feature
- Feedback delay: 2s (any action without visible response = bug)

## §geo-extensibility
**Mandatory constraint — enforced at every Arch Code Review.**

All geography/region logic must be data-driven and extensible. Hard-coding NZ-specific values in application code is forbidden.

| Concern | Rule |
|---------|------|
| Map regions | Configured in `src/config/regions.ts` — bounds, tile URLs, zoom levels per region. Never hardcoded in components. |
| Safety data providers | `SafetyDataProvider` interface. NZ DOC = first implementation. AU/US/JP = new providers, zero code change in consumers. |
| Trail IDs | Format: `{region_code}:{trail_id}` e.g. `nz:tongariro-alpine-crossing` |
| Distance/elevation units | Read from user preference store. Never hardcoded km/m. |
| Voice announcement strings | i18n keys only. No hardcoded ZH/EN strings in logic layer. |
| Backend geo queries | All endpoints accept `region` param. No server-side NZ filter. |
| Marker types | Global taxonomy (danger/scenic/supply/junction/free). No region-specific types in Phase 1. |

## §acceptance
`acceptance_mode: auto`
