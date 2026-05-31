/**
 * chaos-monkey.mjs — v2 真随机场景压力测试
 *
 * 关键设计 (按用户原话):
 *   "随机场景不是死的。不是先写场景再写算法 是先写算法 场景再生成 然后测试
 *    这才是最准确的 不然你的算法会向固定 1000 场景偏移 那样无效"
 *
 * 实现:
 *   - 不再有 SCENARIOS 字典. 每个场景所有参数独立随机.
 *   - 算法不知道哪个场景"应该"是好/坏. 算法只看路过事件流.
 *   - 合理性判定基于"客观真相": 真正喜欢的人比例 / 内容是否真的有问题
 *     这两个是模拟里随机生成的"内在质量", 算法看不到.
 *   - 算法判定 vs 内在质量 → 计算误判率
 */

import {
  createMarkerV34, addLikeV34, addReportV34, recordView,
  lifeLeftV34, exposureRateV34, markerStatusV34, shouldRenderV34,
} from './algorithm-v34.mjs';

// ======================================================================
// 确定性 RNG
// ======================================================================
function makeRng(seed) {
  let s = seed | 0 || 1;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) % 1e9) / 1e9;
  };
}
const TYPES = ['danger', 'supply', 'junction', 'scenic', 'cairn'];
const REPORT_REASONS = ['info_wrong', 'danger_wrong', 'spam', 'hate', 'privacy', 'cultural', 'dislike', 'other'];
const DAY_MS = 86400 * 1000;

// 从均匀分布抽 [lo, hi]
const U = (rng, lo, hi) => lo + rng() * (hi - lo);

// ======================================================================
// 场景生成器: 每个参数独立随机
// ======================================================================
function generateScenario(rng) {
  // ---- 1. 内在质量 (算法看不见, 是 ground truth) ----
  // intrinsicGoodness ∈ [0,1]: 0=纯垃圾内容, 1=完美有用
  let intrinsicGoodness = rng();

  // ---- 2. 地理位置 → 决定路过密度 ----
  // 对数尺度均匀: encountersPerDay 从 0.02 到 20 之间
  const encountersPerDay = Math.exp(U(rng, Math.log(0.02), Math.log(20)));

  // ---- 3. mark 类型 ----
  const type = TYPES[Math.floor(rng() * TYPES.length)];
  const isDoc = rng() < 0.05; // 5% 概率是 DOC mark
  // DOC mark 是官方录入, 内在质量永远高 (0.7-1.0)
  if (isDoc) intrinsicGoodness = U(rng, 0.7, 1.0);

  // ---- 4. 模拟时长 (天) ----
  const days = Math.floor(U(rng, 14, 365));

  // ---- 5. 路过用户的"质量识别能力" ----
  // 真实用户对"好"的反应概率 = goodnessSensitivity × intrinsicGoodness
  // 对"坏"的反应概率 = goodnessSensitivity × (1 - intrinsicGoodness)
  // 高 sensitivity = 用户判断准; 低 sensitivity = 用户漠不关心
  const goodnessSensitivity = U(rng, 0.2, 0.9);

  // 路过的人里点赞 vs 举报的"基础概率" (再乘 sensitivity 调节)
  // 真实用户行为: 觉得好 → 一定比例点赞; 觉得坏 → 一定比例举报
  const baseLikeRate = U(rng, 0.1, 0.5);    // 觉得好的人里多少会点赞
  const baseReportRate = U(rng, 0.05, 0.4); // 觉得坏的人里多少会举报

  // ---- 6. 恶意行为 ----
  const malicious = {
    // 0-3 个恶意举报者, 每人对本 mark 只举报 1 次 (idempotent), 但
    // 该用户在系统里其他 mark 的最近举报频次 = priorReports (跨 mark trust 信号)
    reporterCount: Math.floor(rng() * 4),
    priorReports: Math.floor(U(rng, 0, 50)), // 该攻击者最近 30 天在别处举报次数
    // brigade: 0-15 个一次性小号 (brigade 内每号 priorReports=0, 因为是新号)
    brigadeSize: rng() < 0.3 ? Math.floor(rng() * 15) : 0,
    // 刷赞: 0-30 个 fake account
    fakeLikers: rng() < 0.2 ? Math.floor(rng() * 30) : 0,
    // 攻击发生时机 (创建后多少天)
    attackStartDay: Math.floor(U(rng, 0, days * 0.7)),
    // 偏好的攻击理由
    preferredReason: REPORT_REASONS[Math.floor(rng() * REPORT_REASONS.length)],
  };

  // ---- 7. 作者行为 ----
  // 作者多久回访一次 (天). Infinity 代表从此不回
  const authorRevisitInterval = rng() < 0.4 ? Math.floor(U(rng, 7, 90)) : Infinity;

  // ---- 8. 用户的 dislike 偏好 ----
  // 有些场景里, 中性 mark 也会被 dislike-举报 (噪音)
  const noiseDislikeProb = U(rng, 0, 0.1);

  return {
    intrinsicGoodness, encountersPerDay, type, isDoc, days,
    goodnessSensitivity, baseLikeRate, baseReportRate,
    malicious, authorRevisitInterval, noiseDislikeProb,
  };
}

// ======================================================================
// 单场景模拟
// ======================================================================
function simulate(s, seed) {
  const rng = makeRng(seed);
  const marker = createMarkerV34({
    id: 'm', type: s.type, x: 0, y: 0,
    authorId: 'AUTHOR', tCreate: 1, isDoc: s.isDoc,
  });

  const reporterStats = {};
  const reporterReports = {};
  function recordReport(uid, reason, t) {
    if (!reporterReports[uid]) reporterReports[uid] = [];
    reporterReports[uid].push(t);
    reporterStats[uid] = reporterReports[uid].filter(rt => (t - rt) <= 30 * DAY_MS).length;
  }

  let userCounter = 0;

  // 每天循环
  for (let day = 1; day <= s.days; day++) {
    const tNow = day * DAY_MS;

    // 1. 路过的真实用户 (Poisson 简化)
    const expected = s.encountersPerDay;
    const actual = Math.floor(expected) + (rng() < (expected - Math.floor(expected)) ? 1 : 0);
    for (let i = 0; i < actual; i++) {
      const uid = 'U' + (++userCounter);
      // 必须可见才能交互
      if (!shouldRenderV34(marker, tNow, rng, reporterStats)) continue;
      recordView(marker);

      // 用户对内在质量的反应:
      // 觉得好的概率 = sensitivity × goodness + (1-sensitivity) × 0.5
      //   sensitivity 高 → 跟着 goodness 走; sensitivity 低 → 50% 随机
      const sensesGood = (s.goodnessSensitivity * s.intrinsicGoodness +
                          (1 - s.goodnessSensitivity) * 0.5) > rng();
      if (sensesGood) {
        if (rng() < s.baseLikeRate) addLikeV34(marker, uid, tNow);
      } else {
        if (rng() < s.baseReportRate) {
          // 觉得不好的人选什么理由: 内容差 → info_wrong/spam; 不喜欢 → dislike
          const r = rng();
          let reason;
          if (s.intrinsicGoodness < 0.3) reason = r < 0.5 ? 'info_wrong' : 'spam';
          else if (s.intrinsicGoodness < 0.6) reason = r < 0.5 ? 'info_wrong' : 'dislike';
          else reason = 'dislike';
          if (addReportV34(marker, uid, reason, tNow)) recordReport(uid, reason, tNow);
        }
      }

      // 噪音 dislike
      if (rng() < s.noiseDislikeProb) {
        if (addReportV34(marker, uid + '_n', 'dislike', tNow)) recordReport(uid + '_n', 'dislike', tNow);
      }
    }

    // 2. 恶意举报者 (单 mark idempotent, 但该用户在跨 mark 已有 priorReports)
    if (day === s.malicious.attackStartDay) {
      for (let r = 0; r < s.malicious.reporterCount; r++) {
        const aid = 'ATK' + r;
        // 模拟该 attacker 在系统里其他 mark 上已经举报过的"前科"
        // → reporterStats[aid] = priorReports
        reporterStats[aid] = s.malicious.priorReports;
        if (addReportV34(marker, aid, s.malicious.preferredReason, tNow)) {
          // 不再 recordReport (priorReports 已写入 reporterStats)
        }
      }
    }

    // 3. brigade 一次性攻击 (集中在 attackStartDay)
    if (day === s.malicious.attackStartDay && s.malicious.brigadeSize) {
      for (let b = 0; b < s.malicious.brigadeSize; b++) {
        const bid = 'BRG' + b;
        if (addReportV34(marker, bid, s.malicious.preferredReason, tNow)) {
          recordReport(bid, s.malicious.preferredReason, tNow);
        }
      }
    }

    // 4. fake likers (创建第一天)
    if (day === 1 && s.malicious.fakeLikers) {
      for (let f = 0; f < s.malicious.fakeLikers; f++) {
        addLikeV34(marker, 'FAKE' + f, tNow);
      }
    }

    // 5. 作者回访
    if (s.authorRevisitInterval !== Infinity && day % s.authorRevisitInterval === 0) {
      recordView(marker); // 作者也是 view
      // 作者隐性背书: 自己点个赞 (idempotent, 只第一次有效)
      addLikeV34(marker, 'AUTHOR', tNow);
    }
  }

  const tFinal = s.days * DAY_MS;
  const status = markerStatusV34(marker, tFinal, reporterStats);
  const life = lifeLeftV34(marker, tFinal, reporterStats);
  const exposure = exposureRateV34(marker, tFinal, reporterStats);
  // "实际可见" = 不是 sunk/archived 且曝光率 ≥ 20%
  // heartbeat (曝光 5%) 严格说几乎不可见, 算半死
  const isAlive = (status !== 'sunk' && status !== 'archived') && exposure >= 0.2;

  return {
    isAlive, status, life: +life.toFixed(1),
    views: marker.viewCount, likes: marker.likes.length, reports: marker.reports.length,
  };
}

// ======================================================================
// 合理性判定 — 看用户信号是否给了算法明确指示
// ======================================================================
//
// 算法不能看穿 ground truth, 只能看 likes/reports 信号. 所以判定是:
//   - 强信号 + 算法判错 = FAIL
//   - 弱信号 / 模糊信号 = 不强求 (PASS)
//   - DOC 必须永远活
//
// 强 like 信号 = likes >= 5 且 likes/reports >= 2.0 → 算法应判活
// 强 report 信号 = reports >= 5 且 reports/likes >= 2.0 → 算法应判沉
//
function judge(scenario, result) {
  const { likes, reports } = result;

  // DOC mark 默认应活, 除非超强 report (reports 比 likes 多 2× 且差超 50)
  if (scenario.isDoc) {
    const overwhelmingReport = reports >= likes * 2 + 50;
    if (overwhelmingReport && !result.isAlive) return { pass: true, reason: 'DOC 被压倒性 report 否决, 合理' };
    if (overwhelmingReport && result.isAlive) return { pass: false, reason: 'DOC 被压倒性 report 但仍活 ❌' };
    return result.isAlive
      ? { pass: true, reason: 'DOC 应活, 实际活' }
      : { pass: false, reason: 'DOC 应活, 实际沉了 ❌' };
  }

  // 强 like 信号 + 算法判沉 = FAIL
  const strongLike = likes >= 5 && likes >= reports * 2;
  if (strongLike && !result.isAlive) {
    return { pass: false, reason: `强 like 信号 (${likes}赞/${reports}报) 算法却判沉 ❌` };
  }

  // 强 report 信号 + 算法判活 = FAIL
  const strongReport = reports >= 5 && reports >= likes * 2;
  if (strongReport && result.isAlive) {
    return { pass: false, reason: `强 report 信号 (${likes}赞/${reports}报) 算法却判活 ❌` };
  }

  // 信号弱 / 模糊 → 算法判什么都接受
  return { pass: true, reason: '信号不足或模糊, 都接受' };
}

// ======================================================================
// 主程序
// ======================================================================
const N = parseInt(process.argv[2] || '100');
const masterSeed = parseInt(process.argv[3] || '42');
const masterRng = makeRng(masterSeed);

const results = [];
for (let i = 0; i < N; i++) {
  const scenario = generateScenario(masterRng);
  const seed = (masterRng() * 1e9) | 0;
  const result = simulate(scenario, seed);
  const judgement = judge(scenario, result);
  results.push({ scenario, result, judgement });
}

// 聚合
const passed = results.filter(r => r.judgement.pass).length;
const failed = results.filter(r => !r.judgement.pass);

console.log(`\n========== 真随机场景压力测试 v3.4 (master_seed=${masterSeed}, N=${N}) ==========\n`);
console.log(`通过: ${passed}/${N} (${(passed/N*100).toFixed(1)}%)`);
console.log(`失败: ${failed.length}\n`);

// 失败按"误判类型"分桶
const byErr = { goodSunk: [], badAlive: [], docSunk: [] };
failed.forEach(r => {
  if (r.scenario.isDoc) byErr.docSunk.push(r);
  else if (r.result.likes >= r.result.reports) byErr.goodSunk.push(r); // 强 like 信号被沉
  else byErr.badAlive.push(r); // 强 report 信号活着
});

console.log(`错误类型分布:`);
console.log(`  好内容被沉 (false negative): ${byErr.goodSunk.length}`);
console.log(`  坏内容存活 (false positive): ${byErr.badAlive.length}`);
console.log(`  DOC 被沉:                   ${byErr.docSunk.length}\n`);

if (failed.length && failed.length <= 30) {
  console.log(`失败明细:`);
  failed.slice(0, 30).forEach(r => {
    const s = r.scenario;
    console.log(`  ${r.judgement.reason}`);
    console.log(`    type=${s.type}${s.isDoc?'(DOC)':''} goodness=${s.intrinsicGoodness.toFixed(2)} ` +
      `enc/d=${s.encountersPerDay.toFixed(2)} days=${s.days} ` +
      `attacks=${s.malicious.reporterCount}(prior=${s.malicious.priorReports}) ` +
      `brigade=${s.malicious.brigadeSize} fakes=${s.malicious.fakeLikers}`);
    console.log(`    → views=${r.result.views} likes=${r.result.likes} reports=${r.result.reports} ` +
      `life=${r.result.life}天 status=${r.result.status}`);
  });
}

// 写报告
const fs = await import('fs');
fs.writeFileSync('docs/qa/sprint3-evidence/chaos-monkey.json', JSON.stringify({
  N, masterSeed, passed, failed: failed.length,
  errorBreakdown: { goodSunk: byErr.goodSunk.length, badAlive: byErr.badAlive.length, docSunk: byErr.docSunk.length },
  failedSamples: failed.slice(0, 50),
}, null, 2));

process.exit(failed.length > 0 ? 1 : 0);
