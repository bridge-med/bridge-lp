/* ================================================================
   BRIDGE Compass — 判定(純関数のみ。DOMに触れない)
   回答 → 経験資産 → 役割 → 橋、の3段で翻訳する。
   どの段でも「どの回答から来たか」を持ち回り、結果の理由を本人の回答で説明できるようにする。
   点数や%は外に出さない(画面に出すのは言葉だけ)。

   重み(変えるときはテストの persona を見ながら):
     経験 exp      0〜1  経験資産の相対値 × 役割の重み
     関心 interest 0〜1  Q6・Q8(1問で0.5)× 0.6
     価値 value    ≦0.15 Q7。弱い補正。これだけで橋が決まらない上限
     回避 penalty  Q5 の資産への依存が 0.45 以上の役割を 0.15 下げる(資産そのものは減点しない)
   ================================================================ */
(function (root) {
  'use strict';
  const D = (typeof module === 'object' && module.exports) ? require('./data.js') : root.COMPASS_DATA;
  const { ASSETS, QUESTIONS, ROLES, BRIDGES, TRANSLATIONS, SLOTS, HEADLINES } = D;

  const W_INTEREST = 0.6;
  const VALUE_CAP = 0.15;
  const VALUE_UNIT = 0.08;
  const AVOID_LINE = 0.45;
  const AVOID_PENALTY = 0.15;

  const ASSET_KEYS = Object.keys(ASSETS);
  const ROLE_KEYS = Object.keys(ROLES);
  const Q = Object.fromEntries(QUESTIONS.map(q => [q.id, q]));
  const asList = v => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);
  const optionsOf = (q, ans) => asList(ans).map(id => q.options.find(o => o.id === id)).filter(Boolean);

  /* ---- 1. 経験資産(Q1〜Q4)。sources に「どの回答が何点入れたか」を残す ---- */
  function computeAssets(answers) {
    const scores = Object.fromEntries(ASSET_KEYS.map(k => [k, 0]));
    const sources = Object.fromEntries(ASSET_KEYS.map(k => [k, []]));
    for (const q of QUESTIONS) {
      if (q.role === 'avoid' || q.type === 'text') continue;
      for (const o of optionsOf(q, answers[q.id])) {
        for (const [a, pt] of Object.entries(o.score || {})) {
          scores[a] += pt;
          sources[a].push({ q: q.id, label: o.label, pt });
        }
      }
    }
    const max = Math.max(1, ...Object.values(scores));
    const share = Object.fromEntries(ASSET_KEYS.map(k => [k, scores[k] / max]));
    return { scores, share, sources };
  }

  /* ---- 2. 「できるけれど、今後はあまりやりたくない」(Q5)。減点ではなく別の情報として持つ ---- */
  function computeAvoid(answers) {
    const assets = new Set();
    const labels = {};
    for (const q of QUESTIONS.filter(q => q.role === 'avoid')) {
      for (const o of optionsOf(q, answers[q.id])) {
        for (const a of o.avoid || []) { assets.add(a); (labels[a] = labels[a] || []).push(o.label); }
      }
    }
    return { assets, labels };
  }

  /* ---- 3. 役割 ---- */
  function computeRoles(answers, assetRes, avoidRes) {
    const interestSum = Object.fromEntries(ROLE_KEYS.map(k => [k, 0]));
    const interestFrom = Object.fromEntries(ROLE_KEYS.map(k => [k, []]));
    const valueSum = Object.fromEntries(ROLE_KEYS.map(k => [k, 0]));
    const valueFrom = Object.fromEntries(ROLE_KEYS.map(k => [k, []]));
    for (const q of QUESTIONS) {
      for (const o of (q.options ? optionsOf(q, answers[q.id]) : [])) {
        for (const [r, v] of Object.entries(o.interest || {})) {
          interestSum[r] += v;
          if (v >= 1) interestFrom[r].push({ q: q.id, label: o.label });
        }
        for (const [r, v] of Object.entries(o.value || {})) {
          valueSum[r] += v;
          valueFrom[r].push({ q: q.id, label: o.label });
        }
      }
    }
    const roles = {};
    for (const r of ROLE_KEYS) {
      const w = ROLES[r].weights;
      let exp = 0, avoidDep = 0;
      for (const [a, wt] of Object.entries(w)) {
        exp += wt * assetRes.share[a];
        if (avoidRes.assets.has(a)) avoidDep += wt;
      }
      const interest = Math.min(1, interestSum[r] * 0.5);
      const value = Math.min(VALUE_CAP, valueSum[r] * VALUE_UNIT);
      const penalty = avoidDep >= AVOID_LINE ? AVOID_PENALTY : 0;
      roles[r] = {
        exp, interest, value, avoidDep, penalty,
        total: exp + W_INTEREST * interest + value - penalty,
        interestFrom: interestFrom[r], valueFrom: valueFrom[r],
      };
    }
    return roles;
  }

  /* ---- 4. 橋。役割の重みつき平均 ---- */
  function computeBridges(roles) {
    return BRIDGES.map(b => {
      const agg = { exp: 0, interest: 0, value: 0, penalty: 0, avoidDep: 0, total: 0 };
      const interestFrom = [], valueFrom = [];
      for (const [r, wt] of Object.entries(b.roles)) {
        for (const k of Object.keys(agg)) agg[k] += wt * roles[r][k];
        interestFrom.push(...roles[r].interestFrom);
        valueFrom.push(...roles[r].valueFrom);
      }
      /* 関心は平均ではなく、橋の主な役割への関心の強さで測る。
         平均にすると、関心と無関係な役割を含む橋(例: DX は運営改善を含む)ほど不利になるため */
      agg.interest = Math.max(...Object.entries(b.roles).map(([r, wt]) => roles[r].interest * Math.min(1, wt / 0.5)));
      /* 本人が Q6/Q8 で直接選んだ方向か(橋の主な役割への関心が一つでも立っているか) */
      const direct = Object.entries(b.roles).some(([r, wt]) => wt >= 0.3 && roles[r].interestFrom.length > 0);
      return { bridge: b, ...agg, direct, interestFrom: uniqBy(interestFrom, x => x.label), valueFrom: uniqBy(valueFrom, x => x.label) };
    });
  }

  function uniqBy(arr, key) {
    const seen = new Set();
    return arr.filter(x => { const k = key(x); if (seen.has(k)) return false; seen.add(k); return true; });
  }
  /* 安定した並べ替え(同点は BRIDGES の並び順) */
  const best = (list, score) => list.slice().sort((a, b) => score(b) - score(a) || BRIDGES.indexOf(a.bridge) - BRIDGES.indexOf(b.bridge))[0];

  /* ---- 5. 3つの橋を選ぶ。同じ橋は二度出さない ----
     経験:   経験の一致が最も強い橋
     関心:   Q6/Q8 で直接選んだ方向のうち、関心+経験の半分が最も高い橋(関心だけでは決めない)
     未発見: Q6/Q8 では選んでいない方向のうち、経験の一致が最も強い橋 */
  function pickBridges(bridgeScores) {
    const used = new Set();
    const take = x => { used.add(x.bridge.id); return x; };
    const rest = () => bridgeScores.filter(x => !used.has(x.bridge.id));

    const exp = take(best(rest(), x => x.exp - x.penalty + x.value * 0.5));
    const interested = rest().filter(x => x.direct);
    const leaning = rest().filter(x => x.interest > 0);
    const intPool = interested.length ? interested : leaning.length ? leaning : rest();
    const int = take(best(intPool, x => W_INTEREST * x.interest + 0.5 * x.exp + x.value - x.penalty));
    const hiddenPool = rest().filter(x => !x.direct);
    const hid = take(best(hiddenPool.length ? hiddenPool : rest(), x => x.exp - x.penalty));
    return [
      { slot: SLOTS[0], ...exp },
      { slot: SLOTS[1], ...int },
      { slot: SLOTS[2], ...hid },
    ];
  }

  /* ---- 6. 説明。この橋がなぜ見えたかを、経験資産と本人の回答で ---- */
  function evidence(pick, assetRes) {
    const contrib = {};
    for (const [r, wr] of Object.entries(pick.bridge.roles)) {
      for (const [a, wa] of Object.entries(ROLES[r].weights)) {
        contrib[a] = (contrib[a] || 0) + wr * wa * assetRes.share[a];
      }
    }
    const assets = Object.keys(contrib).filter(a => contrib[a] > 0)
      .sort((a, b) => contrib[b] - contrib[a] || ASSET_KEYS.indexOf(a) - ASSET_KEYS.indexOf(b)).slice(0, 2);
    /* 経験1つにつき、いちばん強く効いた回答を1つ。引用した回答と、つなぐ経験を食い違わせない */
    const answers = uniqBy(
      assets.map(a => assetRes.sources[a].slice().sort((x, y) => y.pt - x.pt)[0]).filter(Boolean),
      x => x.label
    );
    return { assets, answers };
  }

  const quote = list => list.map(x => '「' + x.label + '」').join('');
  /* 「業務改善の経験」「仮説を立てる経験」。word は動詞で終わる呼び名 */
  const assetNames = list => list.map(a => ASSETS[a].word ? ASSETS[a].word + '経験' : ASSETS[a].label + 'の経験').join('と');

  function reasonText(pick, ev, avoidRes) {
    const A = assetNames(ev.assets);
    let s;
    if (pick.slot.id === 'experience') {
      s = ev.answers.length
        ? quote(ev.answers) + 'という答えに、' + A + 'が表れています。この橋では、その経験が活かせる可能性があります。'
        : A + 'が、この橋で活かせる可能性があります。';
    } else if (pick.slot.id === 'interest') {
      const from = pick.interestFrom.length ? pick.interestFrom : [];
      if (from.length) {
        /* 橋の主な方向そのものを選んだか、選んだ方向の先にこの橋があるか */
        s = quote(from) + (pick.direct ? 'を選んでいます。' : 'を選んだ先に、この橋もあります。') +
          (A ? A + 'も、この方向で使えるかもしれません。' : '') + '一度試してみてもよさそうです。';
      } else {
        s = (A ? A + 'は、この方向でも使われます。' : '') +
          (pick.valueFrom.length ? 'これから欲しいものに選んだ' + quote(pick.valueFrom) + 'とも近い橋です。' : '') + '一度のぞいてみてもよさそうです。';
      }
    } else {
      s = (A ? A + 'は、この橋でもよく使われます。' : '') + '今回の答えでは選ばれていない方向です。まだ使っていない経験かもしれません。';
    }
    /* Q5 との重なり。候補から外すのではなく、入り方の話として添える */
    const avoided = ev.assets.filter(a => avoidRes.assets.has(a));
    if (pick.avoidDep >= 0.3 && avoided.length) {
      const labels = uniqBy(avoided.flatMap(a => avoidRes.labels[a]), x => x);
      s += 'ただ、' + labels.map(l => '「' + l + '」').join('') + 'は今後あまりやりたくないとも答えています。この橋を考えるなら、その仕事がどのくらいの割合を占めるかも確かめてみてください。';
    }
    return s;
  }

  /* ---- 7. 見出し・タグ・言いかえ ---- */
  function topAssets(assetRes, n) {
    return ASSET_KEYS.filter(a => assetRes.scores[a] > 0)
      .sort((a, b) => assetRes.scores[b] - assetRes.scores[a] || ASSET_KEYS.indexOf(a) - ASSET_KEYS.indexOf(b))
      .slice(0, n);
  }

  /* 見出しは2行。上位2つの組み合わせに言いかえがあればそれを、無ければ ren/term から組み立てる */
  function headlineLines(top) {
    if (!top.length) return ['これまでの', '仕事の力'];
    if (top.length === 1) return [ASSETS[top[0]].term, '力'];
    const key = top.slice(0, 2).sort().join('+');
    if (HEADLINES && HEADLINES[key]) return HEADLINES[key].slice();
    return [ASSETS[top[0]].ren + '、', ASSETS[top[1]].term + '力'];
  }

  function pickTranslations(profession, assetRes, n) {
    const list = TRANSLATIONS[profession] || TRANSLATIONS.other;
    const scored = list.map((t, i) => ({ t, i, s: t.assets.reduce((sum, a) => sum + assetRes.share[a], 0) / t.assets.length }));
    return scored.sort((a, b) => b.s - a.s || a.i - b.i).slice(0, n).map(x => x.t);
  }

  /* Q4 と Q5 で同じ項目を選んでいる=「できるが、やりたいとは限らない」 */
  function overlaps(answers) {
    const q4 = asList(answers.q4), q5 = asList(answers.q5);
    return Q.q4.options.filter(o => q4.includes(o.id) && q5.includes(o.id)).map(o => o.label);
  }

  /* ---- 全体 ---- */
  function buildResult(answers) {
    const assetRes = computeAssets(answers);
    const avoidRes = computeAvoid(answers);
    const roles = computeRoles(answers, assetRes, avoidRes);
    const bridgeScores = computeBridges(roles);
    const picks = pickBridges(bridgeScores).map(p => {
      const ev = evidence(p, assetRes);
      return {
        slot: p.slot, bridge: p.bridge,
        reason: reasonText(p, ev, avoidRes),
        basis: { assets: ev.assets.map(a => ASSETS[a].tag), answers: ev.answers.map(x => x.label) },
      };
    });
    const top = topAssets(assetRes, 4);
    const text = s => (typeof s === 'string' ? s.trim() : '');
    return {
      headline: headlineLines(top).join(''),
      headlineLines: headlineLines(top),
      tags: top.map(a => ASSETS[a].tag),
      overlaps: overlaps(answers),
      translations: pickTranslations(answers.profession, assetRes, 2),
      bridges: picks,
      made: text(answers.q9),
      wish: text(answers.q10),
      _debug: { assetRes, roles, bridgeScores },
    };
  }

  /* 共有文。自由記述(Q9/Q10)は入れない */
  function shareText(result) {
    return 'BRIDGE Compassをやってみた。\n自分の経験から見えた橋は\n' +
      result.bridges.map(b => '『' + b.bridge.name + '』').join('') + '。\n\n' +
      '医療職としての経験を、別の角度から見てみる。\n#BRIDGECompass';
  }

  const ENGINE = { computeAssets, computeAvoid, computeRoles, computeBridges, pickBridges, buildResult, shareText, topAssets };
  if (typeof module === 'object' && module.exports) module.exports = ENGINE;
  else root.COMPASS_ENGINE = ENGINE;
})(typeof window !== 'undefined' ? window : globalThis);
