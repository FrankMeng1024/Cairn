# BACKLOG.md — Cairn

## Phase 1 — 地图 + GPS（最高优先级）

| # | Feature | Epic | Priority | Notes |
|---|---------|------|----------|-------|
| 1 | Mapbox真实地图渲染（替换占位图） | E-001 | Must Have | 需EAS development build |
| 2 | 离线tile分区域下载 + 进度UI | E-001 | Must Have | NZ区域包：Tongariro、南岛步道等 |
| 3 | Kalman Filter GPS平滑 + 动态采样频率 | E-002 | Must Have | 静止0.1Hz→走路1Hz→跑步2Hz |
| 4 | GPS速度/方向一致性检测 | E-002 | Must Have | 去掉漂移假运动 |
| 5 | 模拟定位测试框架（NZ坐标注入） | E-002 | Must Have | 开发阶段必备 |

## Phase 2 — 路线 + 播报 + 旗帜管理 + SOS

| # | Feature | Epic | Priority | Notes |
|---|---------|------|----------|-------|
| 6 | MAP路线绘制/添加 | E-007 | Must Have | |
| 7 | Waypoint（临时播报点） | E-007 | Must Have | |
| 8 | 路线偏离检测 + 语音纠偏 | E-007/E-008 | Must Have | |
| 9 | Audio ducking TTS（不打断音乐） | E-008 | Must Have | 需原生模块 |
| 10 | 播报优先级队列 + 合并策略 | E-008 | Must Have | P0/P1/P2 + 15s间隔 |
| 11 | MAP旗帜修改/删除 | E-006 | Must Have | |
| 12 | 旗帜权限变更（个人↔好友↔社区） | E-006 | Should Have | |
| 13 | SOS一键求助（长按+SMS fallback） | E-011 | Must Have | |
| 14 | 行程分享（预计时间+超时通知） | E-011 | Should Have | |
| 15 | 路线历史 + 跑步次数统计 | E-007 | Should Have | |
| 16 | GPX导入/导出 | E-007 | Should Have | |
| 17 | 预定义路线高亮 + 旗帜关联 | E-007 | Must Have | |
| 18 | 路线分享给好友 | E-007 | Should Have | Phase 2.5好友系统就绪后 |

## Phase 2.5 — 好友 + 天气路况

| # | Feature | Epic | Priority | Notes |
|---|---------|------|----------|-------|
| 19 | 双向好友确认（in-app + email） | E-004 | Must Have | |
| 20 | 好友旗帜同步 + 视觉区分 | E-004 | Must Have | |
| 21 | 好友旗帜屏蔽/分享管理 | E-004 | Should Have | |
| 22 | 旗帜时效性显示 + 过滤器 | E-004 | Should Have | |
| 23 | DOC步道状态接入 | E-009 | Must Have | 免费，户外最相关 |
| 24 | Open-Meteo天气集成 | E-009 | Must Have | 免费，山区加disclaimer |
| 25 | NZTA路况接入 | E-009 | Could Have | 公路覆盖，步道不适用 |
| 26 | 数据源冲突整合逻辑 | E-009 | Must Have | 优先级：DOC > Open-Meteo > NZTA |

## Phase 3 — AR + 社区

| # | Feature | Epic | Priority | Notes |
|---|---------|------|----------|-------|
| 27 | AR插旗（拖拽放置+取消+间距控制） | E-003 | Must Have | |
| 28 | AR旗帜3D外观（类型决定模型） | E-003 | Must Have | |
| 29 | AR降级（光线不足→地图模式） | E-003 | Must Have | |
| 30 | AR旗帜修改 | E-006 | Should Have | |
| 31 | 关键词黑名单筛选 | E-003 | Must Have | 好友级别起用 |
| 32 | 社区旗帜展示开放 | E-005 | Should Have | 用户量>1000后 |
| 33 | 社区旗帜聚合+投票+举报 | E-005 | Should Have | |
| 34 | 社区危险disclaimer | E-005 | Must Have | 法务审查后 |

## 贯穿所有Phase — 非功能性

| # | Feature | Epic | Priority | Notes |
|---|---------|------|----------|-------|
| 35 | 暗色模式（自动+手动覆盖） | E-010 | Should Have | Phase 1就可开始 |
| 36 | i18n架构搭建（仅英文内容） | E-010 | Should Have | Phase 1 |
| 37 | GDPR隐私合规（删除/导出/最小化） | E-010 | Must Have | Phase 2前完成 |
| 38 | 无障碍基础（VoiceOver/TalkBack/44pt） | E-010 | Must Have | 持续 |
| 39 | 个人统计展示（好友可见） | E-010 | Could Have | Phase 2 |
| 40 | Onboarding轻量引导（3-5屏可跳过） | E-010 | Should Have | Phase 1 |

## 延期/已有 — 保留原backlog条目

| # | Feature | Epic | Priority | Notes |
|---|---------|------|----------|-------|
| 41 | Apple Watch震动方向指引 | E-002 | Could Have | Phase 3+ |
| 42 | 步道关闭实时推送 | E-009 | Could Have | Phase 3 |
| 43 | AU步道数据接入 | E-001 | Could Have | Phase 3 |
| 44 | 多语言支持 | E-010 | Could Have | Phase 3 |
| 45 | 旗帜5秒语音memo | E-003 | Should Have | Phase 3 和AR同期 |
| 46 | "有帮助"反馈+周汇总通知 | E-005 | Should Have | Phase 3 |
| 47 | 发现密度算法 | E-005 | Should Have | Phase 3 |
| 48 | AR cairn halo PNG asset | E-003 | Should Have | **Needs native build** — 加 1 张 radial gradient PNG 进 assets/，后续 OTA 启用 ViroSpriteMaterial halo（消除"边缘硬"，加柔光雾化感）。和下一次必要 build 一起捎带，不单独消耗 build 额度。 |
| 49 | AR cairn 高级视觉（如 Step 1 Viro shader 仍不够好） | E-003 | Could Have | 评估迁移到 SceneKit 或 RealityKit + CustomMaterial Metal shader，得到真 Fresnel/transmission/post-bloom。**工程量大**（5-8 天，几乎重写 AR 层），仅在 Step 1 OTA 路径视觉验收不通过时启动。 |
| 50 | ARWorldMap 持久化（同 cairn 跨 session 零漂移） | E-003 | Could Have | **Needs native build (Swift)** — 序列化 ARKit 当前 session 的 worldMap 到 device，下次 AR scene 启动时 relocalize 回同一 anchor。当前 v68+ 跨 session 会有 GPS 噪声 ±5-10m 偏移（消费级 GPS 上限），用 ARWorldMap 可消除这个偏移。优先级低：当前 ±10m 偏移可接受。 |
| 51 | DragCairnPicker 死代码清理 | E-003 | Could Have | ARScreen.tsx 里 ~230 行 DragCairnPicker 早被 PlantSheet 替代但未删。下次有 native build 顺手清。 |
| 52 | getDistanceScale + AR_SNAP_RANGE_M 死代码 | E-003 | Could Have | ARScreen.tsx 里 export 了但零调用。同上一条一起清。 |
| 53 | AR plant 模式：精细距离控制 | E-003 | Could Have | 当前 v72 hit-test 自动判断（看哪点哪），但 power user 可能想手动设 5/10/20m 精确距离。如有 user feedback 需要再做（PlantSheet 加距离 chip 选择器）。 |
| 54 | AR cairn 远距视觉降级 | E-003 | Should Have | 100m+ 的 cairn 在屏幕上几乎是一个点，3D 球细节看不到反而费 GPU。改成距离 > 80m 时只渲染发光 billboard sprite（一个发亮的点），保留颜色和 type。Phase 3 与 AR 优化一起。 |
| 55 | AR cairn 类型扩展 (cairn / free) | E-003 | Should Have | 当前 v70 把 `cairn` / `free` 这两个 MarkerType fallback 渲染为灰色通用球。两种类型的产品语义还没定义清楚，需要 PO 拍板：留还是删，或给独立视觉。 |
| 56 | AR 视觉 — 粒子贴图 + Fresnel 强度 | E-003 | Should Have | 配合 #48 加 PNG 贴图后，把 Viro 内置 fresnelExponent 调到 ~3.0 + 加 ViroParticleEmitter 替换当前 30 ViroSphere 粒子（更顺滑、性能更好）。 |
| 57 | AR cairn note 长文本/语音 | E-003 | Should Have | 当前 v71 在球上方 billboard 显示 note 文字（30m 内）。后续：> 60 字省略号点击可展开；语音 memo（参考 #45）需要单独 UI 按钮播放。 |
| 58 | AR cairn 跨 session 漂移修复（ARWorldMap 持久化）| E-003 | Should Have | **Needs native build (Swift)**. 用户报告：在同一地点 plant 一个 flag，关 AR，回到该点重开 AR，flag 出现在前方 5-10m。再循环越来越前。根因：每次 AR session 启动 ARKit 用当前 GPS 设原点，GPS 噪声 ±5-10m 累积。修法：调用 ARSession.getCurrentWorldMap() 序列化保存到 device，下次启动 ARSession.initialWorldMap = saved 让 ARKit relocalize 回原坐标系，零漂移。需要写 Swift native module 暴露 worldMap 序列化 + relocalize 接口。约 200 行 Swift + 50 行 RN bridge，下次 native build 一起做。|
