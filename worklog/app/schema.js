/* ============================================================
 * CxO Roadmap Log — 型定義 / フォーム定義 / マスタ
 *
 * このファイルは「データの形」と「入力フォームの構成」だけを持つ。
 * 保存処理(store.js)・描画(app.js)からは独立しているので、
 * 将来 Supabase + AI API に差し替えるときもここが単一の真実になる。
 * ============================================================ */
window.CXO = window.CXO || {};
CXO.schema = (function () {
  'use strict';

  // ---- マスタ(本業に合わせたカテゴリ) ----
  const CATEGORIES = [
    'リハ部門改善', 'リハ単位数・稼働率', 'PT採用', '医療職採用',
    'クリニック運営', 'PMI・統合支援', '施設基準・加算', '診療単価・収益改善',
    '業務フロー改善', '現場調整', '組織改善', 'スタッフ教育',
    '管理者支援', '行政・届出対応', 'レセプト・請求', '電子カルテ・システム',
    'AI/DX', '経営資料作成', 'その他',
  ];

  const SKILL_CATEGORIES = [
    'PL管理', '会計・財務', 'KPI設計', 'リハ部門運営', 'クリニック運営',
    '採用', '組織開発', 'PMI', '施設基準・加算', '診療報酬・レセプト',
    '経営資料作成', '現場調整', '医師・管理者対応', '行政・労務',
    'AI/DX', 'マネジメント', '事業開発',
  ];

  // 日次ログのステータス
  const DAILY_STATUS = ['メモ', '要整理', '実績候補', '実績化済み', '保留'];
  // 案件の状態(未実現は提案中/検証中で扱う)
  const CASE_STATE = ['提案中', '進行中', '検証中', '完了', '保留'];
  const IMPORTANCE = ['高', '中', '低'];
  const LEVELS = ['', '1', '2', '3', '4', '5']; // スキルの現在/目標レベル

  // ---- フィールド型ヘルパ ----
  // type: text | textarea | date | number | select | checkbox | tags | caseRef | range
  const F = (key, label, type, opts) => Object.assign({ key, label, type: type || 'text' }, opts || {});

  // ============================================================
  // フォーム定義(セクション分割)。section.open=true は常時表示、
  // それ以外は <details> で折りたたみ(長いフォームをスマホで扱うため)。
  // ============================================================

  const forms = {
    // ---------- 日次ログ ----------
    daily: {
      title: '日次ログ',
      sections: [
        {
          title: 'クイック入力', open: true,
          hint: '必須は日付とメモだけ。スマホで1分以内に。',
          fields: [
            F('date', '日付', 'date', { required: true }),
            F('memo', '雑メモ', 'textarea', { required: true, placeholder: '今日あったことを雑に。あとで整える前提でOK', rows: 4 }),
          ],
        },
        {
          title: '詳細（任意）', open: false,
          fields: [
            F('project', '今日関わった案件', 'text', { placeholder: '例: リハ部門の単位数改善' }),
            F('stakeholders', '関係者', 'tags', { placeholder: '院長, リハ主任, 事務長（カンマ区切り）' }),
            F('relatedNumbers', '何の数字に関係しそうか', 'text', { placeholder: '例: 平均単位数, 稼働率, リハ売上' }),
            F('cxoInsight', 'CxO視点で意味がありそうなこと', 'textarea', { placeholder: '生産性 / オペ改善 / 仕組み化 / 組織 など', rows: 2 }),
            F('promote', '後で実績ログ化する', 'checkbox'),
            F('status', 'ステータス', 'select', { options: DAILY_STATUS }),
          ],
        },
      ],
    },

    // ---------- 案件ログ ----------
    case: {
      title: '案件ログ',
      sections: [
        {
          title: '基本情報', open: true,
          fields: [
            F('title', '案件名', 'text', { required: true, placeholder: '例: リハビリテーション部門の平均単位数改善' }),
            F('date', '日付', 'date', { required: true }),
            F('category', 'カテゴリ', 'select', { options: CATEGORIES }),
            F('state', '状態', 'select', { options: CASE_STATE }),
            F('importance', '重要度', 'select', { options: IMPORTANCE }),
            F('stakeholders', '関係者', 'tags', { placeholder: '院長, リハ主任 …' }),
          ],
        },
        {
          title: '下書き（AI補正前提）', open: false,
          hint: '雑メモ → ChatGPT/Claudeで整形 → 確定、の3段で残せます。',
          fields: [
            F('rawMemo', '雑メモ', 'textarea', { placeholder: '思いつくまま', rows: 3 }),
            F('aiCorrected', 'AI補正後', 'textarea', { placeholder: 'AIで整えた文章を貼り付け', rows: 3 }),
            F('confirmed', '確定ログ', 'textarea', { placeholder: '自分で最終確認した版', rows: 3 }),
          ],
        },
        {
          title: '現状整理', open: false,
          fields: [
            F('background', '背景', 'textarea', { rows: 2 }),
            F('current', '現状', 'textarea', { rows: 2 }),
            F('issue', '課題', 'textarea', { rows: 2 }),
            F('bottleneck', 'ボトルネック', 'textarea', { rows: 2 }),
            F('fieldReaction', '現場の反応', 'textarea', { rows: 2 }),
          ],
        },
        {
          title: '数字', open: false,
          hint: '金額換算が未済なら空欄でOK。「未計算の数字」「今後追う数字」に書いておく。',
          fields: [
            F('targetMetrics', '追う数字', 'text', { placeholder: '平均単位数, 稼働率, リハ売上 …' }),
            F('before', 'Before', 'text', { placeholder: '例: 平均19単位' }),
            F('after', 'After', 'text', { placeholder: '例: 平均23単位' }),
            F('improvement', '改善幅', 'text', { placeholder: '例: +4単位' }),
            F('monetary', '金額換算', 'text', { placeholder: '未計算なら空欄' }),
            F('uncalculated', 'まだ未計算の数字', 'textarea', { placeholder: '金額にできていないが重要な数字', rows: 2 }),
            F('futureMetrics', '今後追うべき数字', 'textarea', { placeholder: '増収額, 費用対効果 …', rows: 2 }),
          ],
        },
        {
          title: '打ち手', open: false,
          fields: [
            F('involvement', '自分の関与', 'textarea', { rows: 2 }),
            F('measures', '実施した施策', 'textarea', { rows: 2 }),
            F('stakeholderEngagement', '関係者への働きかけ', 'textarea', { rows: 2 }),
            F('opsChange', 'オペレーション変更', 'textarea', { rows: 2 }),
            F('systematized', '仕組み化したこと', 'textarea', { rows: 2 }),
          ],
        },
        {
          title: '成果', open: false,
          hint: '実現した成果と、まだ検証中の仮説を分けて書く。',
          fields: [
            F('achieved', '実現した成果', 'textarea', { rows: 2 }),
            F('validating', 'まだ検証中の成果', 'textarea', { rows: 2 }),
            F('qualitative', '定性的な変化', 'textarea', { rows: 2 }),
            F('quantitative', '定量的な変化', 'textarea', { rows: 2 }),
          ],
        },
        {
          title: '経営的な意味', open: false,
          hint: '断定しすぎず「〜に寄与する可能性」で。金額未計算は可能性として扱う。',
          fields: [
            F('bizRevenue', '売上への影響', 'textarea', { rows: 2 }),
            F('bizProfit', '利益への影響', 'textarea', { rows: 2 }),
            F('bizProductivity', '生産性への影響', 'textarea', { rows: 2 }),
            F('bizHiring', '採用・定着への影響', 'textarea', { rows: 2 }),
            F('bizOrg', '組織運営への影響', 'textarea', { rows: 2 }),
            F('bizRisk', 'リスク低減への影響', 'textarea', { rows: 2 }),
          ],
        },
        {
          title: '再利用できる型', open: false,
          fields: [
            F('learning', '今回の学び', 'textarea', { rows: 2 }),
            F('horizontal', '横展開できそうなこと', 'textarea', { rows: 2 }),
            F('template', '次回使えるテンプレート', 'textarea', { rows: 2 }),
            F('standardFlow', '標準化できそうな業務フロー', 'textarea', { rows: 2 }),
          ],
        },
        {
          title: 'キャリア転用', open: false,
          hint: '大げさにせず、実務成果として自然に。',
          fields: [
            F('resume', '職務経歴書用表現', 'textarea', { rows: 2 }),
            F('linkedin', 'LinkedIn用表現', 'textarea', { rows: 2 }),
            F('promotion', '昇格面談用表現', 'textarea', { rows: 2 }),
            F('oneLiner', '1行サマリー', 'text'),
          ],
        },
      ],
    },

    // ---------- 数字成果 ----------
    number: {
      title: '数字成果',
      sections: [
        {
          title: '基本', open: true,
          fields: [
            F('name', '成果名', 'text', { required: true, placeholder: '例: リハ部門 平均単位数の改善' }),
            F('date', '日付', 'date', { required: true }),
            F('area', '領域', 'select', { options: CATEGORIES }),
            F('relatedCaseId', '関連案件', 'caseRef'),
          ],
        },
        {
          title: '数値', open: true,
          hint: '金額換算が未済なら空欄に。自動で「未計算」と表示されます。',
          fields: [
            F('before', 'Before数値', 'text', { placeholder: '例: 19' }),
            F('after', 'After数値', 'text', { placeholder: '例: 23' }),
            F('improvement', '改善幅', 'text', { placeholder: '例: +4' }),
            F('unit', '単位', 'text', { placeholder: '例: 単位 / %' }),
            F('monetary', '金額換算', 'text', { placeholder: '未計算なら空欄' }),
            F('monetaryBasis', '金額換算の根拠', 'textarea', { rows: 2 }),
            F('futureMetric', '今後計算すべき数字', 'text', { placeholder: '例: 増収額, 費用対効果' }),
          ],
        },
        {
          title: '文脈（CxOとして語る）', open: false,
          fields: [
            F('involvement', '自分の関与', 'textarea', { rows: 2 }),
            F('measures', '打ち手', 'textarea', { rows: 2 }),
            F('businessMeaning', '経営的な意味', 'textarea', { rows: 2 }),
            F('reproducibility', '再現性', 'text'),
            F('horizontal', '横展開可能性', 'text'),
            F('resume', '職務経歴書用表現', 'textarea', { rows: 2 }),
          ],
        },
      ],
    },

    // ---------- 週次レビュー ----------
    weekly: {
      title: '週次レビュー',
      sections: [
        {
          title: '対象週', open: true,
          fields: [F('week', '週', 'text', { required: true, placeholder: '例: 2026-W23' })],
        },
        {
          title: '振り返り', open: true,
          fields: [
            F('mainCases', '今週の主な案件', 'textarea', { rows: 2 }),
            F('achievementCandidates', '実績候補になりそうなもの', 'textarea', { rows: 2 }),
            F('numberMoves', '数字につながりそうな動き', 'textarea', { rows: 2 }),
            F('cxoLearning', 'CxO視点で意味があった学び', 'textarea', { rows: 2 }),
            F('reusableType', '再利用できそうな型', 'textarea', { rows: 2 }),
            F('nextWeekMetrics', '来週追う数字', 'textarea', { rows: 2 }),
            F('nextWeekActions', '来週やるべきアクション', 'textarea', { rows: 2 }),
            F('selfRating', '今週の自己評価', 'select', { options: ['5', '4', '3', '2', '1'] }),
            F('comment', 'コメント', 'textarea', { rows: 2 }),
          ],
        },
      ],
    },

    // ---------- 月次レビュー ----------
    monthly: {
      title: '月次レビュー',
      sections: [
        {
          title: '対象月', open: true,
          fields: [F('month', '月', 'text', { required: true, placeholder: '例: 2026-06' })],
        },
        {
          title: 'CxOロードマップ振り返り', open: true,
          fields: [
            F('repCases', '今月の代表案件', 'textarea', { rows: 2 }),
            F('numericResults', '今月の数字成果', 'textarea', { rows: 2 }),
            F('learning', '今月の学び', 'textarea', { rows: 2 }),
            F('systemsBuilt', '今月作れた仕組み', 'textarea', { rows: 2 }),
            F('businessMeaning', '経営的な意味があった仕事', 'textarea', { rows: 2 }),
            F('cxoProgress', 'CxOに近づいたと感じる経験', 'textarea', { rows: 2 }),
            F('gaps', '足りなかった経験', 'textarea', { rows: 2 }),
            F('nextMonthExperience', '来月取りに行く経験', 'textarea', { rows: 2 }),
            F('nextMonthMetrics', '来月追う数字', 'textarea', { rows: 2 }),
            F('resumeLine', '職務経歴書に残せそうな一文', 'textarea', { rows: 2 }),
          ],
        },
      ],
    },

    // ---------- スキル ----------
    skill: {
      title: 'スキル',
      sections: [
        {
          title: 'スキル', open: true,
          fields: [
            F('name', 'スキル名', 'select', { options: SKILL_CATEGORIES, required: true }),
            F('currentLevel', '現在レベル', 'select', { options: LEVELS }),
            F('targetLevel', '目標レベル', 'select', { options: LEVELS }),
            F('progress', '進捗(%)', 'number', { min: 0, max: 100, placeholder: '0-100' }),
          ],
        },
        {
          title: '詳細', open: true,
          fields: [
            F('missingExperience', '不足している経験', 'textarea', { rows: 2 }),
            F('thisYearExperience', '今年取りに行く経験', 'textarea', { rows: 2 }),
            F('provingAchievement', '証明する実績', 'text'),
            F('relatedCases', '関連案件', 'text'),
            F('memo', 'メモ', 'textarea', { rows: 2 }),
          ],
        },
      ],
    },
  };

  // ---- 空オブジェクト生成(全キーを既定値で埋める) ----
  function blankFromForm(form, defaults) {
    const o = {};
    form.sections.forEach(s => s.fields.forEach(f => {
      o[f.key] = f.type === 'tags' ? [] : (f.type === 'checkbox' ? false : '');
    }));
    return Object.assign(o, defaults || {});
  }

  const today = () => new Date().toISOString().slice(0, 10);

  const factories = {
    daily: () => blankFromForm(forms.daily, { date: today(), status: 'メモ', promote: false }),
    case: () => blankFromForm(forms.case, { date: today(), category: 'リハ部門改善', state: '進行中', importance: '中' }),
    number: () => blankFromForm(forms.number, { date: today(), area: 'リハ単位数・稼働率' }),
    weekly: () => blankFromForm(forms.weekly, { week: isoWeek(new Date()) }),
    monthly: () => blankFromForm(forms.monthly, { month: today().slice(0, 7) }),
    skill: () => blankFromForm(forms.skill, {}),
  };

  // ---- ISO週(YYYY-Www) ----
  function isoWeek(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
    return date.getUTCFullYear() + '-W' + String(week).padStart(2, '0');
  }

  return { CATEGORIES, SKILL_CATEGORIES, DAILY_STATUS, CASE_STATE, IMPORTANCE, LEVELS, forms, factories, isoWeek, today, blankFromForm };
})();
