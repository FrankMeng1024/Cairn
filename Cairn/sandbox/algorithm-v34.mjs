/**
 * algorithm-v34.mjs — Cairn 算法 v3.4 "曝光老化 + 举报者可信度"
 *
 * 跟 v3.3 比的核心改动:
 *   1. effectiveAge = α × 日历天 + (1-α) × (views / refViewsPerDay)
 *      偏远 mark 没人看 → views 不增 → 老得慢
 *   2. reporterTrust(report.user.recentReportRate) 折扣举报权重
 *      恶意刷子越举报越无效 (狼来了)
 *   3. heat / penalty 衰减用 effectiveAge 同一把尺子
 *      避免日历快、热度衰减也快, 但 effectiveAge 慢的悖论
 *
 * 设计哲学: "你走过的路不是孤单的"
 *   - 偏远好 mark 不该因人少而死
 *   - 市区差 mark 不该因人多刷赞而活
 *   - 抗操纵: 刷曝光反而加速老化, 刷子无利可图
 */

// ======================================================================
// 类型参数 — 每类有自己的"日历权重 alpha"
// alpha 越高 = 越看日历 (时效性强); alpha 越低 = 越看曝光 (时效性弱)
// ======================================================================

export const TYPE_PARAMS_V34 = {
  // 危险信息: 时效性极强, 长时间没更新就该过期
  danger:   { baseLifetime: 14,  tau: 21,  boost: 4, alpha: 0.85 },
  // 补给点: 商家可能搬走但也可能开很久, 中等
  supply:   { baseLifetime: 60,  tau: 60,  boost: 6, alpha: 0.50 },
  // 岔路: 路本身基本不变
  junction: { baseLifetime: 120, tau: 120, boost: 5, alpha: 0.30 },
  // 风景: 山就是山
  scenic:   { baseLifetime: 180, tau: 180, boost: 5, alpha: 0.20 },
  // 石堆: 几乎只看曝光, 但还是要有一定日历约束防坏 mark 长存
  cairn:    { baseLifetime: 365, tau: 365, boost: 5, alpha: 0.25 },
};

// 基准曝光速度: 平均每天被路过的次数 (市区水平)
// 偏远地区实际曝光会远低于这个数, 触发慢老化机制
export const REF_VIEWS_PER_DAY = 3;

// 举报者可信度参数: 最近 30 天举报 N 次, 可信度 = 1 / (1 + k*N)
export const REPORTER_K = 0.15;
export const REPORTER_WINDOW_DAYS = 30;

// 2 年硬上限 (跟 v3.3 一致)
const HARD_CAP_DAYS = 730;

// 举报理由权重 (跟 v3.3 一致, 不动)
const REPORT_REASON_WEIGHTS = {
  info_wrong:   1.0,
  danger_wrong: 1.0,
  spam:         1.0,
  hate:         1.5,
  privacy:      1.5,
  cultural:     1.2,
  dislike:      0.3,
  other:        0.5,
};

const MS_PER_DAY = 24 * 3600 * 1000;
const daysBetween = (t1, t2) => (t2 - t1) / MS_PER_DAY;

// ======================================================================
// DOC mark: 强制基础寿命 ≥ 365 天 + 永远 100% 曝光
// ======================================================================

export function docParams(type) {
  const p = TYPE_PARAMS_V34[type];
  return { ...p, baseLifetime: Math.max(p.baseLifetime, 365), isDoc: true };
}

// ======================================================================
// 曝光当量天数 (核心创新)
// ======================================================================

/**
 * effectiveAge: 这个 mark "实际老化了多少天"
 * v3.5: 加 healthAdjust — 当负面信号占主导, alpha 提到 0.9 (按日历老化)
 *   思路: 偏远保护只给"还没被否定"的 mark, 一旦累计被否定就让日历推进死亡
 */
export function effectiveAge(marker, now) {
  const calendarDays = daysBetween(marker.tCreate, now);
  const params = marker.isDoc ? docParams(marker.type) : TYPE_PARAMS_V34[marker.type];
  const views = marker.viewCount || 0;
  const viewBasedDays = views / REF_VIEWS_PER_DAY;

  // 健康调整: 计算 likes - reports 比, 比例失衡时取消偏远保护
  const likeCount = (marker.likes || []).length;
  const reportCount = (marker.reports || []).length;
  let alpha = params.alpha;
  if (reportCount >= 3 && reportCount > likeCount) {
    // 负面信号占优, 强制按日历老化
    alpha = Math.max(alpha, 0.9);
  }

  return alpha * calendarDays + (1 - alpha) * viewBasedDays;
}

// ======================================================================
// 举报者可信度
// ======================================================================

/**
 * reporterTrust: 举报者最近 30 天举报次数越多, 可信度越低
 * 第一次举报: 1.0
 * 30 天内 5 次: 1/(1+0.75) = 0.57
 * 30 天内 20 次: 1/(1+3) = 0.25
 * 30 天内 50 次: 1/(1+7.5) = 0.118
 *
 * 注: recentReportCount 由 simulator 传入 (统计该 user 在 [now-30d, now] 区间举报数)
 */
export function reporterTrust(recentReportCount) {
  return 1 / (1 + REPORTER_K * recentReportCount);
}

// ======================================================================
// 单赞/单举报值 (用 effectiveAge 衰减, 不再用日历天)
// ======================================================================

/**
 * 一个赞或举报在 mark 时间线上的"effectiveAge"差
 * 我们仍用 mark.tCreate 作 0 点, 但所有时间换成 effectiveAge
 * 简化: 假设 effectiveAge 跟时间线性 → like.tEff = effectiveAge(now=like.t)
 *
 * 实际实现里, like.t 是日历时间戳, 我们计算 like 时刻到 now 时刻
 * 之间的 effectiveAge 差, 然后 e^(-Δeff/τ)
 */
export function likeValueV34(like, marker, now) {
  // like 之后到 now 之间, marker 老化了多少 effectiveAge
  // 简化: 用 calendar 比例缩 alpha + view 增量缩 (1-alpha)
  const calendarDelta = daysBetween(like.t, now);
  const params = marker.isDoc ? docParams(marker.type) : TYPE_PARAMS_V34[marker.type];
  // 假设 view 在时间上均匀分布 (simulator 会真给 viewsAtTime)
  // 这里用平均: 从 like.t 到 now 之间贡献的 view 数 = views × (calendarDelta / totalCalendar)
  const totalCalendar = daysBetween(marker.tCreate, now);
  const viewShare = totalCalendar > 0 ? (calendarDelta / totalCalendar) : 0;
  const viewsSinceLike = (marker.viewCount || 0) * viewShare;
  const effDelta = params.alpha * calendarDelta + (1 - params.alpha) * (viewsSinceLike / REF_VIEWS_PER_DAY);
  return Math.exp(-effDelta / params.tau);
}

export function currentHeatV34(marker, now) {
  return (marker.likes || []).reduce((sum, like) => sum + likeValueV34(like, marker, now), 0);
}

/**
 * 举报惩罚: 用 reporterTrust × reasonWeight × 衰减
 * v3.5: 同一 reason 累计折扣防 brigade
 *       不同 reason 各自独立计算 (多元化的负面信号更可信)
 *       同 reason 前 3 个全权重, 4-10 个 0.5, 11+ 个 0.2
 */
export function reportPenaltyV34(marker, now, reporterStats = {}) {
  const reports = marker.reports || [];
  // 按 reason 分组
  const byReason = {};
  reports.forEach(r => {
    if (!byReason[r.reason]) byReason[r.reason] = [];
    byReason[r.reason].push(r);
  });

  let total = 0;
  for (const [reason, group] of Object.entries(byReason)) {
    // 每条算 raw 值
    const rawValues = group.map(r => {
      const reasonW = REPORT_REASON_WEIGHTS[reason] || 0.5;
      const trust = reporterTrust(reporterStats[r.userId] || 0);
      const calendarDelta = daysBetween(r.t, now);
      const params = marker.isDoc ? docParams(marker.type) : TYPE_PARAMS_V34[marker.type];
      const totalCalendar = daysBetween(marker.tCreate, now);
      const viewShare = totalCalendar > 0 ? (calendarDelta / totalCalendar) : 0;
      const viewsSinceReport = (marker.viewCount || 0) * viewShare;
      const effDelta = params.alpha * calendarDelta + (1 - params.alpha) * (viewsSinceReport / REF_VIEWS_PER_DAY);
      const decay = Math.exp(-effDelta / params.tau);
      return { value: decay * reasonW * trust, t: r.t };
    });
    // 按时间倒序
    rawValues.sort((a, b) => b.t - a.t);
    rawValues.forEach((rv, i) => {
      let weight;
      if (i < 3) weight = 1.0;
      else if (i < 10) weight = 0.5;
      else weight = 0.2;
      total += rv.value * weight;
    });
  }
  return total;
}

// ======================================================================
// 剩余寿命 (用 effectiveAge 替代 daysAlive)
// ======================================================================

export function lifeLeftV34(marker, now, reporterStats = {}) {
  const params = marker.isDoc ? docParams(marker.type) : TYPE_PARAMS_V34[marker.type];
  const calendarDays = daysBetween(marker.tCreate, now);
  if (calendarDays > HARD_CAP_DAYS) return -Infinity;

  // 冬季冻结 (沿用 v3.3)
  const effNow = marker.winterFrozenStart || now;
  const effCal = marker.winterFrozenStart
    ? daysBetween(marker.tCreate, marker.winterFrozenStart)
    : calendarDays;

  // 用 effectiveAge 替换 daysAlive
  const eff = effectiveAge({ ...marker, viewCount: marker.viewCount || 0 }, effNow);
  const heat = currentHeatV34(marker, effNow);
  const penalty = reportPenaltyV34(marker, effNow, reporterStats);

  // v3.5: 累积 like 资本 (不衰减) + 累积 report 重压
  //   净 like 每个给 +2 天 (上限 +365 天) — 强支持长寿命
  //   净 report 每个给 -3 天 (无上限) — 负面更贵
  const cumulativeLikes = (marker.likes || []).length;
  const cumulativeReports = (marker.reports || []).length;
  const netLikes = Math.max(0, cumulativeLikes - cumulativeReports);
  const netReports = Math.max(0, cumulativeReports - cumulativeLikes);
  const accumulatedBoost = Math.min(365, netLikes * 2.0);
  const accumulatedDrain = netReports * 3.0;

  return params.baseLifetime + heat * params.boost - penalty * params.boost - eff + accumulatedBoost - accumulatedDrain;
}

// ======================================================================
// 曝光率 (跟 v3.3 同, 但用 v34 的 heat / penalty)
// ======================================================================

const REPORT_WEIGHT_V34 = 1.5;

export function exposureRateV34(marker, now, reporterStats = {}) {
  if (marker.isDoc) return 1.0;
  const heat = currentHeatV34(marker, now);
  const penalty = reportPenaltyV34(marker, now, reporterStats);
  const score = heat - REPORT_WEIGHT_V34 * penalty;
  if (score >= 5) return 1.0;
  if (score >= 1) return 0.8;
  if (score >= 0) return 0.5;
  if (score >= -2) return 0.2;
  return 0.05;
}

export const MARKER_STATUS_V34 = {
  HEALTHY: 'healthy', BORDERLINE: 'borderline', WEAK: 'weak',
  HEARTBEAT: 'heartbeat', SUNK: 'sunk', ARCHIVED: 'archived',
};

export function markerStatusV34(marker, now, reporterStats = {}) {
  const life = lifeLeftV34(marker, now, reporterStats);
  if (life === -Infinity) return MARKER_STATUS_V34.ARCHIVED;
  if (life <= 0) return MARKER_STATUS_V34.SUNK;
  const exp = exposureRateV34(marker, now, reporterStats);
  if (exp >= 0.8) return MARKER_STATUS_V34.HEALTHY;
  if (exp >= 0.5) return MARKER_STATUS_V34.BORDERLINE;
  if (exp >= 0.2) return MARKER_STATUS_V34.WEAK;
  return MARKER_STATUS_V34.HEARTBEAT;
}

export function shouldRenderV34(marker, now, rng = Math.random, reporterStats = {}) {
  const s = markerStatusV34(marker, now, reporterStats);
  if (s === MARKER_STATUS_V34.ARCHIVED) return false;
  if (s === MARKER_STATUS_V34.SUNK) return false;
  if (s === MARKER_STATUS_V34.HEARTBEAT) return rng() < 0.2;
  return true;
}

// ======================================================================
// Marker 工厂 (加 viewCount 字段)
// ======================================================================

export function createMarkerV34({ id, type, x, y, authorId, tCreate, isDoc = false }) {
  return {
    id, type, x, y, authorId,
    tCreate: tCreate || 1,
    isDoc,
    likes: [], reports: [],
    viewCount: 0,
  };
}

export function addLikeV34(marker, userId, now) {
  if (marker.likes.find(l => l.userId === userId)) return false;
  marker.likes.push({ userId, t: now });
  return true;
}

export function addReportV34(marker, userId, reason, now) {
  if (marker.reports.find(r => r.userId === userId)) return false;
  marker.reports.push({ userId, reason, t: now });
  return true;
}

// 当 mark 被路过曝光一次, simulator 调用此函数
export function recordView(marker) {
  marker.viewCount = (marker.viewCount || 0) + 1;
}
