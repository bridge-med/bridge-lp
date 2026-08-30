/* クリニックタウン3D — 現場スタッフ(キャラクター)
 * 「かわいい説明キャラ」ではなく「実際に働いていそうな現場メンバー」。
 * 数字と経営判断が主役。キャラはボトルネックの翻訳者に徹する。
 *
 * ctx = { h(昨日の実績), s(settings), G, wait, load, standing, rehaUtil, labor, profit }
 */

'use strict';

const STAFF_UI = (() => {

  /* ================= 顔(SVG・表情差分をプログラム描画) ================= */
  // mood: normal | good | busy | tired | warn | idea

  const LOOKS = {
    doctor:  { skin: '#F2CFAE', hair: '#8B8580', hairStyle: 'part', top: '#FFFFFF', collar: '#3E7CA6', acc: 'stetho' },
    front:   { skin: '#F6D7B8', hair: '#4A3B33', hairStyle: 'bob', top: '#E8EEF4', collar: '#3E7CA6', acc: 'intercom' },
    nurse:   { skin: '#F2CFAE', hair: '#2E2A33', hairStyle: 'tied', top: '#37597A', collar: '#274460', acc: 'none' },
    reha:    { skin: '#F0C9A2', hair: '#54401F', hairStyle: 'short', top: '#4FA98C', collar: '#3A8A70', acc: 'lanyard' },
    billing: { skin: '#F6D7B8', hair: '#3E3730', hairStyle: 'bob', top: '#C7B8D6', collar: '#8C7BC4', acc: 'glasses' },
    advisor: { skin: '#F6D7B8', hair: '#6E6A66', hairStyle: 'part', top: '#41454D', collar: '#FFFFFF', acc: 'glasses' }
  };

  function faceSVG(key, mood, size) {
    const L = LOOKS[key];
    const s = size || 40;
    // 表情パーツ
    const eyes = {
      normal: '<circle cx="26" cy="30" r="1.9" fill="#33302E"/><circle cx="38" cy="30" r="1.9" fill="#33302E"/>',
      good: '<path d="M23.6 30 Q26 27.4 28.4 30" stroke="#33302E" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M35.6 30 Q38 27.4 40.4 30" stroke="#33302E" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
      busy: '<circle cx="26" cy="30" r="1.9" fill="#33302E"/><circle cx="38" cy="30" r="1.9" fill="#33302E"/><path d="M22 25.5 L29 27" stroke="#33302E" stroke-width="1.5" stroke-linecap="round"/><path d="M42 25.5 L35 27" stroke="#33302E" stroke-width="1.5" stroke-linecap="round"/>',
      tired: '<path d="M23.6 30.6 Q26 32 28.4 30.6" stroke="#33302E" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M35.6 30.6 Q38 32 40.4 30.6" stroke="#33302E" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
      warn: '<circle cx="26" cy="30" r="2.2" fill="#33302E"/><circle cx="38" cy="30" r="2.2" fill="#33302E"/><path d="M22 26.5 L29 25" stroke="#33302E" stroke-width="1.6" stroke-linecap="round"/><path d="M42 26.5 L35 25" stroke="#33302E" stroke-width="1.6" stroke-linecap="round"/>',
      idea: '<circle cx="26" cy="29.5" r="2.1" fill="#33302E"/><circle cx="38" cy="29.5" r="2.1" fill="#33302E"/>'
    }[mood] || '';
    const mouth = {
      normal: '<path d="M29.5 38 H34.5" stroke="#B0736A" stroke-width="1.8" stroke-linecap="round"/>',
      good: '<path d="M28.5 37 Q32 40.5 35.5 37" stroke="#B0736A" stroke-width="1.9" fill="none" stroke-linecap="round"/>',
      busy: '<path d="M29 38.6 H35" stroke="#B0736A" stroke-width="1.8" stroke-linecap="round"/>',
      tired: '<path d="M29 39.4 Q32 37.6 35 39.4" stroke="#B0736A" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
      warn: '<path d="M29 39.5 Q32 37.2 35 39.5" stroke="#9E5A50" stroke-width="2" fill="none" stroke-linecap="round"/>',
      idea: '<path d="M29 37.4 Q32 40.8 35.6 36.8" stroke="#B0736A" stroke-width="1.9" fill="none" stroke-linecap="round"/>'
    }[mood] || '';
    const marks = {
      tired: '<path d="M46.5 22 q2.2 3.4 0 5.4 q-2.2 -2 0 -5.4" fill="#7FB4D6"/>',
      busy: '<path d="M46.5 22 q2.2 3.4 0 5.4 q-2.2 -2 0 -5.4" fill="#7FB4D6" opacity="0.7"/>',
      warn: '<text x="48" y="22" font-size="12" font-weight="900" fill="#C4574E">!</text>',
      idea: '<text x="46" y="21" font-size="11" font-weight="900" fill="#C98A2D">✦</text>',
      good: '<text x="46" y="21" font-size="10" font-weight="900" fill="#4FA98C">✓</text>'
    }[mood] || '';

    // 髪型
    const hair = {
      bob: `<path d="M17 30 Q15 12 32 11 Q49 12 47 30 L47 24 Q47 15 32 15 Q17 15 17 24 Z" fill="${L.hair}"/><path d="M17 24 Q17 34 19 36 L19 24 Z" fill="${L.hair}"/><path d="M47 24 Q47 34 45 36 L45 24 Z" fill="${L.hair}"/>`,
      tied: `<path d="M17 28 Q16 12 32 11 Q48 12 47 28 L47 22 Q45 14 32 14 Q19 14 17 22 Z" fill="${L.hair}"/><circle cx="48.5" cy="16" r="4.2" fill="${L.hair}"/>`,
      short: `<path d="M17 26 Q17 11 32 11 Q47 11 47 26 L47 21 Q44 13 32 14 Q20 13 17 21 Z" fill="${L.hair}"/>`,
      part: `<path d="M17 25 Q17 11 32 11 Q47 11 47 25 L47 20 Q43 13 30 14 Q20 14 17 22 Z" fill="${L.hair}"/>`
    }[L.hairStyle] || '';

    const acc = {
      intercom: '<path d="M17 28 Q14 33 17 37" stroke="#4A5D68" stroke-width="1.8" fill="none"/><circle cx="18" cy="37.5" r="2" fill="#4A5D68"/>',
      glasses: '<rect x="21" y="26.5" width="10" height="7.5" rx="3.2" fill="none" stroke="#5B5751" stroke-width="1.6"/><rect x="33" y="26.5" width="10" height="7.5" rx="3.2" fill="none" stroke="#5B5751" stroke-width="1.6"/><path d="M31 30 H33" stroke="#5B5751" stroke-width="1.6"/>',
      lanyard: '<path d="M26 50 L29 57 M38 50 L35 57" stroke="#2C5F82" stroke-width="1.8"/><rect x="29.5" y="56" width="5.5" height="7" rx="1" fill="#fff" stroke="#2C5F82" stroke-width="1"/>',
      stetho: '<path d="M25 49 Q25 58 32 58 Q39 58 39 49" stroke="#4A5D68" stroke-width="1.9" fill="none"/><circle cx="32" cy="59.5" r="2.6" fill="#4A5D68"/>',
      none: ''
    }[L.acc] || '';

    return `<svg viewBox="0 0 64 64" width="${s}" height="${s}" aria-hidden="true">
      <circle cx="32" cy="30" r="15.5" fill="${L.skin}"/>
      ${hair}
      ${eyes}${mouth}
      <path d="M13 64 Q14 49 26 47 L32 51 L38 47 Q50 49 51 64 Z" fill="${L.top}"/>
      <path d="M26 47 L32 51 L38 47 L36 45.5 L32 48 L28 45.5 Z" fill="${L.collar}"/>
      ${acc}${marks}
    </svg>`;
  }

  /* ================= キャラクター定義 ================= */

  const MOOD_LABEL = { normal: '通常', good: '順調', busy: '混雑', tired: '疲労', warn: '警告', idea: '提案' };

  const STAFF = {
    doctor: {
      name: '剣持', title: '院長',
      mood(c) {
        if (c.load >= 0.95) return 'tired';
        if (c.load >= 0.78) return 'busy';
        if (c.load <= 0.5 && c.h && c.h.patients >= 10) return 'good';
        return 'normal';
      },
      comments: [
        { id: 'd_long', prio: 86, cond: (c) => c.load >= 0.9,
          text: () => `今日は途中から説明を短くせざるを得なかった。診療の質を守るなら、医師を増やすか予約でならしてほしい。` },
        { id: 'd_quality', prio: 64, cond: (c) => c.s.examMean <= 4 && c.h && c.h.patients >= 15,
          text: () => `診察1人4分はさすがに駆け足だ。回転は上がるが、聞き逃しは再診離れにつながる。少し戻さないか。` },
        { id: 'd_inj', prio: 58, cond: (c) => c.s.pInj >= 0.2 && c.s.pInj <= 0.4 && c.h && (c.h.injCount + c.h.trigCount) / Math.max(1, c.h.patients) >= 0.2,
          text: (c) => `注射は適応をきちんと診て打てている。この実施率(${Math.round((c.h.injCount + c.h.trigCount) / c.h.patients * 100)}%)は医学的にも妥当な範囲だ。` },
        { id: 'd_calm', prio: 16, cond: (c) => c.load <= 0.5 && c.h && c.h.patients >= 10,
          text: () => `今日は一人ひとりに時間を使えた。こういう診療を続けたい。` }
      ],
      invest: { doctor: '任せられる先生が来るなら心強い。ただ、診察が本当に詰まってからでいい。' }
    },
    front: {
      name: '松岡', title: '受付リーダー',
      mood(c) {
        if (c.standing > 0 || c.wait >= 35) return 'warn';
        if (c.wait >= 20) return 'busy';
        if (c.h && c.h.patients >= 15 && c.wait <= 14) return 'good';
        return 'normal';
      },
      comments: [
        { id: 'f_balk', prio: 98, cond: (c) => c.h && (c.h.balked || 0) >= 3,
          text: (c) => `今日は${c.h.balked}人、混雑を見て入口で帰ってしまいました…。売上の前に「入れる器」です。椅子と回転(受付・診察)、どちらかを今すぐ。` },
        { id: 'f_stand', prio: 96, cond: (c) => c.standing > 0,
          text: (c) => `待合で立っている患者さんが出ています。椅子を足すのも手ですが、根本は回転です — 受付短縮(Web問診)か診察キャパを先に。` },
        { id: 'f_wait40', prio: 92, cond: (c) => c.wait >= 35,
          text: (c) => `平均待ち${Math.round(c.wait)}分。これは口コミに響くラインです。今日の受付、正直かなり厳しかったです。` },
        { id: 'f_ads_wait', prio: 80, cond: (c) => c.wait >= 22 && c.h && c.h.newCount >= 8,
          text: () => `広告で新患は増えていますが、待ちが伸びています。このまま増やすと評判側で返ってきます。` },
        { id: 'f_kaikei', prio: 66, cond: (c) => !c.s.kiosk && c.h && c.h.patients >= 30,
          text: () => `会計前が詰まり気味です。この患者数なら自動精算機の検討ラインだと思います。` },
        { id: 'f_web', prio: 60, cond: (c) => !c.s.webIntake && c.h && c.h.patients >= 22,
          text: () => `初診の問診対応に時間を取られています。Web問診があれば受付はかなり軽くなります。` },
        { id: 'f_good', prio: 20, cond: (c) => c.wait <= 13 && c.h && c.h.patients >= 12,
          text: (c) => `今日は待ち${Math.round(c.wait)}分。受付は良い流れでした。この体感を落とさないようにしたいです。` }
      ],
      invest: { webIntake: '問診が事前に済むと、受付の説明時間をかなり減らせます。', recep: '窓口が2つあると初診ラッシュで詰まらなくなります。', chairs: '椅子は応急処置です。立ち待ちが続くなら回転側も見てください。', kiosk: '会計の詰まりは最後の印象を悪くします。効果は大きいです。' }
    },

    nurse: {
      name: '榊', title: '看護師長',
      mood(c) {
        if (c.load >= 0.95) return 'tired';
        if (c.load >= 0.75) return 'busy';
        if (c.load <= 0.45 && c.h && c.h.patients >= 10) return 'good';
        return 'normal';
      },
      comments: [
        { id: 'n_over', prio: 94, cond: (c) => c.load >= 0.95,
          text: () => `現場は限界に近いです。この患者数を続けるなら、医師か診察時間の設計を先に。無理は事故につながります。` },
        { id: 'n_treat', prio: 78, cond: (c) => c.s.beds > c.s.nurses,
          text: (c) => `処置ベッドが${c.s.beds}台に対して看護師が${c.s.nurses}人。ベッドが遊んでいます。増やすなら人が先です。` },
        { id: 'n_doctor', prio: 72, cond: (c) => c.load >= 0.8,
          text: () => `診察が詰まっています。患者数を増やす前に、診察室側の回転を見直した方がよさそうです。` },
        { id: 'n_inj', prio: 55, cond: (c) => c.s.pInj < 0.15 && c.h && c.h.patients >= 15,
          text: () => `関節注射の適応がありそうな方を何人か見ました。医学的に必要な処置の取りこぼしは、患者さんのためにもなりません。` },
        { id: 'n_calm', prio: 18, cond: (c) => c.load <= 0.5 && c.h && c.h.patients >= 10,
          text: () => `現場は落ち着いて回せています。余力があるうちに、次の一手を仕込む時期です。` }
      ],
      invest: { doctor: '診察室が増えれば回転は上がります。ただし患者が付くまで人件費は重いですよ。', nurse: '処置と採血が並行できるようになります。ベッドとセットで。', beds: 'ベッドだけ増えても人がいないと回りません。看護師数と合わせて。' }
    },

    reha: {
      name: '湊', title: 'リハ・物療担当',
      mood(c) {
        if (c.rehaUtil >= 0.85) return 'good';
        if (c.rehaUtil >= 0.6) return 'busy';
        if (c.s.rehaLevel > 0 && c.rehaUtil < 0.35 && c.s.pts > 0) return 'idea';
        return 'normal';
      },
      comments: [
        { id: 'r_full', prio: 88, cond: (c) => c.rehaUtil >= 0.95,
          text: () => `リハ枠が満杯で、振替をお願いした患者さんがいます。PT採用か助手の増員を検討してほしいです。継続が切れるのが一番もったいない。` },
        { id: 'r_idle', prio: 70, cond: (c) => c.s.rehaLevel > 0 && c.rehaUtil < 0.35 && c.s.pts > 0,
          text: () => `リハ枠に余裕があります。診察からの案内(リハ提案方針)を上げるか、ケアマネ・老健への営業で埋めたいです。` },
        { id: 'r_physio', prio: 62, cond: (c) => c.s.physio === 0 && c.h && c.h.patients >= 18,
          text: () => `物療希望の患者さんは結構います。機器があれば低単価でも高回転で、継続来院の受け皿になります。` },
        { id: 'r_kijun', prio: 76, cond: (c) => c.s.rehaLevel === 2 && c.s.pts >= 4 && c.s.floorLv >= 2,
          text: () => `PT4名と面積要件、揃っています。運動器リハ(I)に届出を上げれば1回あたり+¥300です。` },
        { id: 'r_good', prio: 22, cond: (c) => c.rehaUtil >= 0.8 && c.rehaUtil < 0.95,
          text: () => `リハ室、いい稼働です。患者さんの継続も安定しています。この調子で。` }
      ],
      invest: { pt: 'リハ枠を広げるなら採用だけでなく、予約枠の設計もセットで考えたいです。', machines: '機器はPT×2まで稼働します。人と機器のバランスを。', rehaAide: '準備を助手に任せられると、PTは単位に集中できます。回転がかなり違います。', physio: '物療は継続の入口です。案内方針も一緒に上げましょう。' }
    },

    billing: {
      name: '佐伯', title: '医事課(レセプト)',
      mood(c) {
        if (c.h && c.h.kanriCount >= 10) return 'idea';
        if (c.h && c.h.patients > 0 && c.h.revenue / c.h.patients >= 4500) return 'good';
        return 'normal';
      },
      comments: [
        { id: 'b_kasan', prio: 88, cond: (c) => c.h && c.h.patients >= 12 && !c.s.kasanMeisai,
          text: () => `明細書発行体制等加算(再診+1点)、まだ届け出ていません。1点=10円でも月1,000再診なら1万円 — 「届出だけで取れる加算」から埋めるのが医事の鉄則です。経営タブの施設基準・届出からどうぞ。` },
        { id: 'b_kanri', prio: 60, cond: (c) => c.h && c.h.kanriCount >= 8,
          text: (c) => `外来管理加算が${c.h.kanriCount}件。裏を返せば“何もしていない再診”がそれだけあります。注射や物療の適応、先生と確認しませんか。` },
        { id: 'b_kijun2', prio: 74, cond: (c) => c.s.rehaLevel === 1 && c.s.pts >= 2,
          text: () => `PTが2名になっています。運動器(II)へ届出を上げればリハ1回+¥1,700。書類はこちらで整えます。` },
        { id: 'b_kijun1', prio: 76, cond: (c) => c.s.rehaLevel === 2 && c.s.pts >= 4 && c.s.floorLv >= 2,
          text: () => `PT4名と100㎡、(I)の要件が揃いました。届出を上げましょう。リハ1回+¥300は年間で効いてきます。` },
        { id: 'b_unit', prio: 22, cond: (c) => c.h && c.h.patients >= 15 && c.h.revenue / c.h.patients >= 4500,
          text: (c) => `本日単価¥${Math.round(c.h.revenue / c.h.patients).toLocaleString()}。診療の中身が厚くなってきました。算定漏れもありません。` }
      ],
      invest: {}
    },
    advisor: {
      name: '白瀬', title: '経営アドバイザー(本部)',
      mood(c) {
        if (c.G.money < 300000 || (c.h && c.h.profit + (c.h.brProfit || 0) < -100000)) return 'warn';
        if (c.labor > 0.6) return 'busy';
        if (c.h && c.h.profit + (c.h.brProfit || 0) > 100000) return 'good';
        return 'normal';
      },
      comments: [
        { id: 'a_cash', prio: 98, cond: (c) => c.G.money < 300000,
          text: (c) => `資金が心細くなっています。緊急融資は高くつきます — 事業計画を整えて通常融資の枠を先に確保してください。` },
        { id: 'a_red', prio: 84, cond: (c) => c.profit < 0 && c.labor > 0.6,
          text: (c) => `赤字の主因は人件費率${Math.round(c.labor * 100)}%です。人を増やす前に、今の人員で単価を上げる打ち手(注射・リハ・基準)を。` },
        { id: 'a_unit', prio: 68, cond: (c) => c.h && c.h.patients >= 25 && c.h.revenue / c.h.patients < 3000,
          text: (c) => `患者数は付いてきました。単価${Math.round(c.h.revenue / c.h.patients).toLocaleString()}円は伸びしろです。次は“数を増やす投資”より“単価を上げる投資”を。` },
        { id: 'a_hosp', prio: 47, cond: (c) => c.G.league && c.G.league.beaten >= 7 && !c.G.hospital,
          text: () => `県の頂点に立ちました。次のステージは病院です — 回復期リハ病棟(入院料2,229点/日×病床)は外来とは別次元の算定の世界。法人タブで建設条件を確認してみてください。` },
        { id: 'a_newlow', prio: 58, cond: (c) => c.h && c.h.newCount <= 3 && c.G.aw < 0.45,
          text: (c) => `新患${c.h.newCount}人は少ないですね。認知${Math.round(c.G.aw * 100)}%が原因です。広告か看板、または商店街への顔出しを。` },
        { id: 'a_black', prio: 24, cond: (c) => c.profit > 150000,
          text: (c) => `本日+${Math.round(c.profit / 1000)}千円。良い数字ですが、単月の黒字と構造の黒字は別物です。人件費率と再診の定着を見続けてください。` }
      ],
      invest: { expand: '増築は運動器(I)への布石。回収は「+¥300×リハ件数」で逆算を。', mri: '1日3件で回収400診療日(約15か月)。稼働の目処(初診数・紹介)を先に。', doctor: '医師は最大の固定費。診察キャパが本当にボトルネックか確認してから。' }
    }
  };

  /* ================= ランダムイベント(キャラからの報告) ================= */
  // apply(G, settings) は当日限りの効果。planDay内で適用。

  const STAFF_EVENTS = [
    { id: 'rain', char: 'front', p: 0.030, text: '今日は朝から雨です。予約のキャンセルが増えそうです。',
      apply: (G, s) => { G.evArrivalMul = 0.75; } },
    { id: 'goodReview', char: 'front', p: 0.020, cond: (G) => G.rep >= 68,
      text: '口コミに「丁寧に説明してもらえた」と星5の投稿が入りました!',
      apply: (G) => { G.rep = Math.min(97, G.rep + 1.2); G.aw = Math.min(0.95, G.aw + 0.008); } },
    { id: 'claim', char: 'front', p: 0.018, cond: (G) => G.rep < 80,
      text: '受付で強めのクレームがありました。対応はしましたが、口コミが少し心配です。',
      apply: (G) => { G.rep = Math.max(15, G.rep - 1.5); } },
    { id: 'frontTired', char: 'front', p: 0.018, cond: (G, s) => !s.webIntake,
      text: '受付メンバーに疲れが見えます。今日は少し処理が遅くなるかもしれません。',
      apply: (G, s) => { G.evRecepSlow = true; } },
    { id: 'docSlow', char: 'nurse', p: 0.025,
      text: '先生の診察が長引いています。丁寧なのは良いことですが、今日は回転が落ちそうです。',
      apply: (G) => { G.evExamDelta = 2; } },
    { id: 'physioBreak', char: 'reha', p: 0.015, cond: (G, s) => s.physio > 0,
      text: '物療機器が1台故障しました。今日は物療の回転が落ちます。修理は夕方に完了予定です。',
      apply: (G) => { G.evPhysioDown = true; } },
    { id: 'referral', char: 'reha', p: 0.022, cond: (G, s) => s.rehaLevel > 0,
      text: '連携先から「リハをお願いしたい」と紹介の連絡がありました。今日、数名いらっしゃいます。',
      apply: (G) => { G.evExtraRefer = 2; } },
    { id: 'rivalAds', char: 'advisor', p: 0.018,
      text: '競合が広告を強めています。今週はCPCが上がりそうです。無理に追わない判断もあります。',
      apply: (G) => { G.adPressure = Math.min(0.6, G.adPressure + 0.08); } },
    { id: 'kaizen', char: 'nurse', p: 0.020,
      text: 'スタッフから動線の改善提案が出ました。小さな工夫ですが、今日は現場がスムーズです。',
      apply: (G) => { G.rep = Math.min(97, G.rep + 0.8); } },
    { id: 'flu', char: 'nurse', p: 0.012,
      text: '地域で感染症が流行り始めています。今日は急な来院が増えるかもしれません。',
      apply: (G) => { G.evArrivalMul = 1.25; } }
  ];

  return { STAFF, STAFF_EVENTS, faceSVG, MOOD_LABEL };
})();
