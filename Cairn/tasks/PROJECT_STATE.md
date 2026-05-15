# PROJECT_STATE.md — Cairn

**Status**: IN_PROGRESS
**Current Sprint**: 13 (UI uplift complete)
**Last Updated**: 2026-05-15

## Sprint History
- Sprint 0: COMPLETE (2026-05-15) — Foundation, docs, tech stack, Style B confirmed
- Sprint 1: COMPLETE (2026-05-15) — Spike Review PASS，4/4 VIABLE WITH CONDITIONS
- Sprint 6: COMPLETE (2026-05-15) — HomeScreen SVG redesign (emoji → lucide icons)
- Sprint 7: COMPLETE (2026-05-15) — RunningScreen SVG redesign + expo-keep-awake
- Sprint 8: COMPLETE (2026-05-15) — HikingScreen SVG redesign (map markers, flag picker, spring press)
- Sprint 9: COMPLETE (2026-05-15) — AuthScreen SVG redesign (AnimatedCairn, PressBtn, persistence fix)
- Sprint 10: COMPLETE (2026-05-15) — MapHistoryScreen SVG redesign (PressRow, tabs, route cards)
- Sprint 11: COMPLETE (2026-05-15) — FriendsScreen SVG redesign (Users illustration, Mail input, Send button)
- Sprint 12: COMPLETE (2026-05-15) — SettingsScreen SVG redesign + localStorage uiMode persistence
- Sprint 13: COMPLETE (2026-05-15) — MapScreen + RoutesScreen SVG cleanup (orphaned files)

## UI Uplift Summary
All 9 screens fully migrated to lucide-react-native SVG icons. Zero emoji remain in any screen.
Icon.tsx exports: Mountain, PersonStanding, Map, Users, Settings2, ChevronRight/Left, Play, Square,
Flag, TriangleAlert, Star, Navigation, Lock, Unlock, Target, Timer, Heart, Zap, MapPin, Route,
Droplets, X, Trash2, Navigation2, GitBranch, Check, CircleCheck, LogIn, Eye, EyeOff, Mail,
KeyRound, UserPlus, Info, Send, BookOpen, Moon, Volume2, LogOut, User, ArrowUp, Save, Globe, ThumbsUp

## Next Work (pending Sprint Planning)
- CR-003: Real functionality — expo-location GPS tracking
- EAS Development Build configuration (blocks Mapbox/GPS background/WatermelonDB)
- Backend /sync endpoint (WatermelonDB sync)
- Physical device validation: GPS accuracy + TTS ducking

## Key Decisions
- acceptance_mode: manual
- Style: B (Natural Warm)
- Tech: React Native + Expo, Mapbox, Firebase Auth, WatermelonDB
- Phase 1: No AR (地图pin标记), Phase 2: AR
- Test device: iPhone (Expo Go)
- Backend: 122.51.174.118 MySQL
- Git: Strategy A, direct to main
