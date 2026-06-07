/* ============================================================
 * CxO Roadmap Log — 保存層 (localStorage)
 *
 * UI から見える API は collection(all/get/upsert/remove) に統一。
 * 将来 Supabase に差し替えるときは、この collection() の中身だけを
 * 非同期実装に置き換えれば UI 側の呼び出しは概ねそのまま使える。
 *
 * シードに入れる実績は「ユーザーが実際に行った リハ単位数改善」のみ。
 * 架空の成果は入れない。金額換算は未済なので空欄(=未計算)で保存する。
 * ============================================================ */
window.CXO = window.CXO || {};
CXO.store = (function () {
  'use strict';
  const NS = 'cxolog:v1:';
  const now = () => new Date().toISOString();
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function read(key) {
    try { return JSON.parse(localStorage.getItem(NS + key)) || []; }
    catch (e) { return []; }
  }
  function write(key, arr) { localStorage.setItem(NS + key, JSON.stringify(arr)); }

  function collection(key) {
    return {
      all() { return read(key); },
      get(id) { return read(key).find(x => x.id === id) || null; },
      upsert(obj) {
        const arr = read(key);
        if (!obj.id) { obj.id = uid(); obj.createdAt = now(); }
        obj.updatedAt = now();
        const i = arr.findIndex(x => x.id === obj.id);
        if (i >= 0) arr[i] = obj; else arr.unshift(obj);
        write(key, arr);
        return obj;
      },
      remove(id) { write(key, read(key).filter(x => x.id !== id)); },
    };
  }

  const dailyLogs = collection('dailyLogs');
  const cases = collection('cases');
  const numbers = collection('numbers');
  const weekly = collection('weekly');
  const monthly = collection('monthly');
  const skills = collection('skills');

  // ---- バックアップ用: 全データ書き出し / 取り込み ----
  function exportAll() {
    return {
      _app: 'cxo-roadmap-log', _version: 1, exportedAt: now(),
      dailyLogs: dailyLogs.all(), cases: cases.all(), numbers: numbers.all(),
      weekly: weekly.all(), monthly: monthly.all(), skills: skills.all(),
    };
  }
  function importAll(data) {
    ['dailyLogs', 'cases', 'numbers', 'weekly', 'monthly', 'skills'].forEach(k => {
      if (Array.isArray(data[k])) write(k, data[k]);
    });
  }
  function resetAll() {
    ['dailyLogs', 'cases', 'numbers', 'weekly', 'monthly', 'skills', 'seeded']
      .forEach(k => localStorage.removeItem(NS + k));
  }

  // ============================================================
  // 初回シード(実データのみ)
  // ============================================================
  function seedCase() {
    return {
      title: 'リハビリテーション部門の平均単位数改善',
      date: '2026-03-31',
      category: 'リハ単位数・稼働率',
      state: '完了',
      importance: '高',
      stakeholders: ['リハ部門スタッフ', 'リハ管理者'],
      rawMemo: '',
      aiCorrected: '',
      confirmed: '平均単位数を19→23単位へ改善。運用フロー見直しとインセンティブ設計に関与。',
      background: '平均単位数が19単位程度で伸び悩んでおり、リハ部門の生産性改善が課題となっていた。',
      current: 'スタッフの稼働はしているものの、運用上のボトルネックがあり、単位数が十分に伸びていなかった。',
      issue: '平均単位数を改善するためには、単なる声かけではなく、オペレーションの見直しと行動変容を促す仕組みが必要だった。',
      bottleneck: '運用上のボトルネック(段取り・配分・稼働の谷間)により、稼働が単位数に変換しきれていなかった。',
      fieldReaction: 'インセンティブ設計により、現場スタッフの行動変容が起こった。',
      targetMetrics: '平均単位数, 月間総単位数, PT1人あたり単位数, 稼働率, リハ売上, インセンティブ支給額',
      before: '平均19単位',
      after: '平均23単位',
      improvement: '+4単位',
      monetary: '', // 未計算
      uncalculated: '月間総単位数, リハ売上の増収額, インセンティブの費用対効果(いずれも今後金額換算すべき)',
      futureMetrics: '月間総単位数, 稼働率, リハ売上, 増収額, インセンティブ支給額, 費用対効果',
      involvement: 'オペレーション変更とインセンティブ設計に関与。',
      measures: 'リハ運営上のボトルネックを整理し、単位数向上に向けたオペレーションを変更。加えて、現場スタッフの行動変容を促すためにインセンティブ設計を行った。',
      stakeholderEngagement: '現場スタッフへインセンティブ設計の意図を共有し、行動変容を促した。',
      opsChange: 'リハ運営のオペレーションを単位数向上に向けて変更。',
      systematized: '現状単位数の把握 → ボトルネック特定 → オペレーション変更 → インセンティブ設計 → 単位数変化の確認、という改善フローを型化。',
      achieved: '平均単位数を19単位から23単位へ改善した。',
      validating: '収益(増収額)への寄与は、金額換算が未済のため検証中。',
      qualitative: '現場スタッフの行動変容が起こった。',
      quantitative: '平均単位数 +4単位(19→23)。',
      bizRevenue: '単位数増により収益改善につながる可能性。金額は未計算のため断定はしない。',
      bizProfit: '増収分の利益寄与は今後の金額換算で検証する。',
      bizProductivity: 'リハ部門の生産性(単位数)が向上した。',
      bizHiring: '',
      bizOrg: 'オペレーションとインセンティブの組み合わせで現場の行動変容を起こせることを実証。',
      bizRisk: '',
      learning: 'オペレーション変更とインセンティブ設計を組み合わせると、声かけだけでは動かない現場の行動変容を促せる。',
      horizontal: '他院・他部署のリハ部門へ、同じ改善フローで横展開できそう。',
      template: '現状把握→ボトルネック特定→オペ変更→インセンティブ設計→効果確認、のテンプレート。',
      standardFlow: 'リハ単位数改善の標準フローとして整備可能。',
      resume: 'リハビリテーション部門において、運用フローの見直しとインセンティブ設計に関与。平均単位数を19単位から23単位へ改善し、部門の生産性向上に寄与した。',
      linkedin: 'リハビリテーション部門の運営改善において、オペレーション変更とインセンティブ設計を通じて平均単位数を19単位から23単位へ改善。現場の行動変容と生産性向上を両立する施策に取り組みました。',
      promotion: 'リハ部門の平均単位数改善に向け、運用上の課題整理、オペレーション変更、インセンティブ設計に関与しました。結果として平均単位数が19単位から23単位に改善し、部門運営の生産性向上に貢献しました。',
      oneLiner: 'リハ部門の平均単位数を19→23単位に改善（運用見直し＋インセンティブ設計）',
    };
  }

  function seedNumber(caseId) {
    return {
      name: 'リハ部門 平均単位数の改善',
      date: '2026-03-31',
      area: 'リハ単位数・稼働率',
      relatedCaseId: caseId,
      before: '19',
      after: '23',
      improvement: '+4',
      unit: '単位（平均）',
      monetary: '', // 未計算 → UI で「未計算」表示
      monetaryBasis: '',
      futureMetric: '増収額（リハ売上）・インセンティブ費用対効果',
      involvement: 'オペレーション変更とインセンティブ設計に関与。',
      measures: 'ボトルネック整理 → オペレーション変更 → インセンティブ設計。',
      businessMeaning: 'リハ部門の生産性向上に寄与。収益改善につながる可能性（金額は未計算）。',
      reproducibility: '高（改善フローを型化済み）',
      horizontal: '他院・他部署のリハ部門へ展開可能',
      resume: 'リハ部門の運用見直しとインセンティブ設計に関与し、平均単位数を19→23単位へ改善。',
    };
  }

  function seed() {
    if (localStorage.getItem(NS + 'seeded')) return;
    const c = cases.upsert(seedCase());
    numbers.upsert(seedNumber(c.id));
    // スキルは名称だけ用意(レベルは空=ユーザーが埋める。架空の達成度は入れない)。
    // upsert は新しいものを先頭に積むため、定義順に並ぶよう逆順で投入する。
    CXO.schema.SKILL_CATEGORIES.slice().reverse().forEach(name => {
      skills.upsert({
        name, currentLevel: '', targetLevel: '', progress: '',
        missingExperience: '', thisYearExperience: '', provingAchievement: '',
        relatedCases: '', memo: '',
      });
    });
    localStorage.setItem(NS + 'seeded', '1');
  }

  return {
    dailyLogs, cases, numbers, weekly, monthly, skills,
    exportAll, importAll, resetAll, seed,
  };
})();
