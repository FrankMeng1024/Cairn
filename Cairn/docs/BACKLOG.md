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
