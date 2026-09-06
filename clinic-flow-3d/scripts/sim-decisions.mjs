/* 経営の分岐点 — 方針別シミュレーション(設計の偏りの検査)
 * 実行: node clinic-flow-3d/scripts/sim-decisions.mjs
 * 200日間、簡略化した経営モデル(患者数・売上・費用)の上で相談を回し、固定の選び方
 * (常に1番目/2番目/3番目・最安・最高額・ランダム)で結果を比べる。特定の位置だけで勝てる設計になっていないかを見る。
 * ここでの経済は game.js の簡略版(検査用)。数字はゲーム本体の値ではない */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const D = require(join(ROOT, 'app', 'decisions.js'));
const dir = join(ROOT, 'app', 'decisions');
for (const f of readdirSync(dir).filter((x) => /^cases-.*\.js$/.test(x)).sort()) D.register(require(join(dir, f)));

const COST = { doctors: 80000, nurses: 18000, receptionists: 10000, pts: 16000, rehaAides: 10000 };
function run(strategy, seed, specialty) {
  const G = { money: 2000000, rep: 60, aw: 0.3, coins: 0, relations: { hospital: { lv: 0, last: 0 }, caremane: { lv: 0, last: 0 }, rouken: { lv: 0, last: 0 }, pharmacy: { lv: 0, last: 0 }, company: { lv: 0, last: 0 }, sports: { lv: 0, last: 0 }, school: { lv: 0, last: 0 }, shoutengai: { lv: 0, last: 0 }, houkatsu: { lv: 0, last: 0 } } };
  const s = { doctors: 1, nurses: 1, receptionists: 1, pts: 0, rehaAides: 0, floorLv: 1, examMean: 6, rehaLevel: 0 };
  const st = D.newState(seed);
  const hist = [];
  let decided = 0, blockedPicks = 0, chains = 0;
  const rnd = D.rng(`${seed}|world`);
  for (let day = 1; day <= 200; day++) {
    // 簡略の1日: 新患は認知×評判、再診は評判、能力は医師数と診察時間、余力で診察時間が変わる
    const examDelta = D.examDelta(st, day);
    const cap = Math.max(10, s.doctors * (480 / (s.examMean + examDelta + 1.5)) * 0.72);
    const demand = (52 * G.aw * (G.rep / (G.rep + 55)) + 14 + D.trustReferrals(st)) * D.newMul(st, day) * (0.9 + rnd() * 0.2);
    const patients = Math.round(Math.min(demand, cap * 1.1));
    const revenue = patients * (5200 + (s.pts ? 900 : 0));
    const staffCost = Object.entries(COST).reduce((a, [k, v]) => a + (k === 'doctors' ? (s[k] - 1) * v : (s[k] || 0) * v), 0);
    const cost = 25000 + 8000 + staffCost + D.dailyCost(st, day) + patients * 300;
    G.money += revenue - cost;
    // 待ちと評判: 需要が能力を超えると評判が落ちる
    const load = demand / cap;
    G.rep = Math.max(15, Math.min(97, G.rep + (load > 1 ? -0.15 : 0.05) + (D.examDelta(st, day) > 1 ? -0.05 : 0)));
    G.aw = Math.max(0.05, Math.min(0.95, G.aw + 0.001));
    hist.push({ day, patients, revenue, cost, load });
    D.tick({ G, settings: s }, st, day);
    if (day < 5) continue;
    const h7 = hist.slice(-7);
    const ctx = {
      day, money: G.money, rep: G.rep, aw: G.aw, staff: { doctors: s.doctors, nurses: s.nurses, receptionists: s.receptionists, pts: s.pts, rehaAides: s.rehaAides },
      staffTotal: s.doctors + s.nurses + s.receptionists + s.pts + s.rehaAides, specialty, stage: day >= 8 ? 3 : day >= 4 ? 2 : 1,
      depts: [], branches: 0, hospital: false, rehaLevel: s.rehaLevel, flags: st.flags, slack: st.slack, trust: st.trust,
      load: Math.round(Math.min(1.2, h7.reduce((a, x) => a + x.load, 0) / h7.length) * 100) / 100,
      patients7: Math.round(h7.reduce((a, x) => a + x.patients, 0) / h7.length), newp7: Math.round(patients * 0.3), refer7: Math.round(D.trustReferrals(st) * 10) / 10,
      waitAvg: Math.round(10 + Math.max(0, load - 0.6) * 60), balked7: load > 1 ? 2 : 0,
      monthProfit: hist.slice(-30).reduce((a, x) => a + x.revenue - x.cost, 0), monthRevenue: hist.slice(-30).reduce((a, x) => a + x.revenue, 0),
      dailyCost: Math.round(cost), runway: Math.max(0, Math.round(G.money / Math.max(1, cost))), rentDay: 25000, examMean: s.examMean,
      relations: Object.fromEntries(Object.entries(G.relations).map(([k, v]) => [k, v.lv])), kaitei: 0
    };
    const picked = D.pick(ctx, st);
    if (!picked) continue;
    const c = picked.c;
    if (picked.viaChain) chains++;
    const outs = c.choices.map((ch) => ({ ch, o: D.evaluate(c, ch, ctx, st) }));
    const okOuts = outs.filter((x) => x.o.ok);
    if (!okOuts.length) { blockedPicks++; st.cool[c.id] = day + 30; st.chainDue = st.chainDue.filter((x) => x.id !== c.id); st.nextDay = day + 3; continue; }
    let pickIdx;
    const order = outs.map((x, i) => i).filter((i) => outs[i].o.ok);
    if (strategy === 'first') pickIdx = order[0];
    else if (strategy === 'middle') pickIdx = order[Math.floor((order.length - 1) / 2)];
    else if (strategy === 'last') pickIdx = order[order.length - 1];
    else if (strategy === 'cheapest') pickIdx = order.slice().sort((a, b) => (outs[b].o.fx.money || 0) - (outs[a].o.fx.money || 0))[0];
    else if (strategy === 'spender') pickIdx = order.slice().sort((a, b) => (outs[a].o.fx.money || 0) - (outs[b].o.fx.money || 0))[0];
    else pickIdx = order[Math.floor(rnd() * order.length)];
    const { ch, o } = outs[pickIdx];
    D.commit(c, ch, o, { G, settings: s }, st, { viaChain: picked.viaChain });
    decided++;
  }
  return { money: Math.round(G.money), rep: Math.round(G.rep * 10) / 10, slack: st.slack, trust: st.trust, staff: s.doctors + s.nurses + s.receptionists + s.pts + s.rehaAides, decided, chains, blockedPicks, uniq: Object.keys(st.seen).length };
}

const strategies = ['first', 'middle', 'last', 'cheapest', 'spender', 'random'];
const seeds = ['a', 'b', 'c', 'd', 'e'];
const table = {};
for (const sg of strategies) {
  const rs = seeds.flatMap((sd) => ['orthopedics', 'internal'].map((sp) => run(sg, sd, sp)));
  const avg = (k) => Math.round(rs.reduce((a, r) => a + r[k], 0) / rs.length);
  table[sg] = { money: avg('money'), rep: avg('rep'), slack: (rs.reduce((a, r) => a + r.slack, 0) / rs.length).toFixed(1), trust: (rs.reduce((a, r) => a + r.trust, 0) / rs.length).toFixed(1), staff: avg('staff'), decided: avg('decided'), chains: avg('chains'), uniq: avg('uniq') };
}
console.table(table);
// 判定: どの単一戦略も「資金・評判・余力・信頼」の4指標すべてで首位にならない(=位置だけで勝てない)
const keys = ['money', 'rep', 'slack', 'trust'];
const winners = keys.map((k) => strategies.slice().sort((a, b) => Number(table[b][k]) - Number(table[a][k]))[0]);
const dominant = strategies.find((sg) => winners.every((w) => w === sg));
console.log('指標ごとの首位:', Object.fromEntries(keys.map((k, i) => [k, winners[i]])));
if (dominant) { console.log(`NG: ${dominant} が4指標すべてで首位(位置だけで勝てる)`); process.exit(1); }
const decidedMin = Math.min(...strategies.map((s) => table[s].decided));
if (decidedMin < 20) { console.log(`NG: 200日で判断が${decidedMin}回しか出ない`); process.exit(1); }
console.log('sim-decisions: OK(単一の位置で全指標を取る戦略は無い)');
