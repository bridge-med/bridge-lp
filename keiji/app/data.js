/* 掲示じたく — 文面の型
 * 6種のお知らせの「型」をここに集約する。app.js は型を読んで描画するだけ。
 * 文面はクリニックの掲示で広く使われる定型からの再構成(社長の実務照合は出荷後の宿題)。網羅より、そのまま使えることを優先。
 */

'use strict';

/* ---------- 日付 ---------- */

const KEIJI_DAYS = ['日', '月', '火', '水', '木', '金', '土'];

function keijiParseDate(v) {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/* 「8月14日(金)」。年が今年と違うときだけ「2027年1月4日(日)」と年を付ける */
function keijiFormatDate(v, opts) {
  const dt = keijiParseDate(v);
  if (!dt) return null;
  const withYear = (opts && opts.year === 'always') || dt.getFullYear() !== new Date().getFullYear();
  const y = withYear ? dt.getFullYear() + '年' : '';
  return y + (dt.getMonth() + 1) + '月' + dt.getDate() + '日(' + KEIJI_DAYS[dt.getDay()] + ')';
}

/* 掲示の右上に置く「2026年7月31日」。年は常に付ける */
function keijiFormatIssueDate(v) {
  const dt = keijiParseDate(v);
  if (!dt) return null;
  return dt.getFullYear() + '年' + (dt.getMonth() + 1) + '月' + dt.getDate() + '日';
}

/* 未入力の日付は「〇月〇日(〇)」で場所だけ示す(プレビューで空欄が見えるように) */
function d(v) { return keijiFormatDate(v) || '〇月〇日(〇)'; }

/* 自由入力の改行を1行につなぐ。そのまま空白にすると「。 期間中は」と句点のあとが空くため、
   文末で終わっている行は詰めてつなぎ、そうでない行だけ空白で区切る */
function keijiJoinLines(s) {
  return String(s || '').split(/\n+/).map((x) => x.trim()).filter(Boolean)
    .reduce((acc, line) => (acc ? acc + (/[。！？」』）)]$/.test(acc) ? '' : ' ') + line : line), '');
}

/* ---------- 型の定義 ----------
 * build(f) は f(入力値の連想配列)から掲示ブロック列と、HP/SNS用テキストを返す。
 * ブロック: {t:'p', text} 段落 / {t:'big', text} 中央の大書き / {t:'kv', items:[{k,v}]} 表 / {t:'pre', text} 改行保持
 */

const KEIJI_TYPES = [
  {
    id: 'rinji',
    name: '臨時休診',
    desc: '研修や学会などで、特定の日を休診にするとき',
    fields: [
      { key: 'date', label: '休診する日', type: 'date', required: true },
      { key: 'scope', label: '休診の範囲', type: 'select', options: ['終日', '午前のみ', '午後のみ'] },
      { key: 'reason', label: '理由', type: 'select', options: ['院内研修のため', '学会参加のため', '設備点検のため', '都合により', '書かない'], custom: '自分で書く', customPlaceholder: '例: 院内行事のため' },
      { key: 'resume', label: '通常どおり診療する日', type: 'date', hint: '空欄なら、この一文は載りません' },
    ],
    build(f) {
      const scope = f.scope || '終日';
      const scopeBig = { '終日': '終日休診', '午前のみ': '午前休診', '午後のみ': '午後休診' }[scope];
      const reason = f.reason === '書かない' ? '' : (f.reason || '院内研修のため') + '、';
      const blocks = [
        { t: 'p', text: '誠に勝手ながら、' + reason + '下記のとおり休診とさせていただきます。' },
        { t: 'big', text: d(f.date) + '　' + scopeBig },
      ];
      if (scope === '午前のみ') blocks.push({ t: 'p', text: '同日の午後は、通常どおり診療いたします。' });
      if (scope === '午後のみ') blocks.push({ t: 'p', text: '同日の午前は、通常どおり診療いたします。' });
      if (f.resume) blocks.push({ t: 'p', text: keijiFormatDate(f.resume) + 'からは、通常どおり診療いたします。' });
      blocks.push({ t: 'p', text: 'ご迷惑をおかけしますが、ご理解のほどよろしくお願い申し上げます。' });

      /* 「8月14日(金)は、午前は休診」と「は」が重ならないよう、範囲は日付側に寄せる */
      const head = d(f.date) + (scope === '終日' ? 'は、' : scope === '午前のみ' ? 'の午前は、' : 'の午後は、');
      let web = '【臨時休診のお知らせ】' + head + reason
        + (scope === '終日' ? '終日休診いたします。' : scope === '午前のみ' ? '休診いたします。午後は通常どおり診療いたします。' : '休診いたします。午前は通常どおり診療いたします。');
      if (f.resume) web += keijiFormatDate(f.resume) + 'からは通常どおり診療いたします。';
      web += 'ご迷惑をおかけしますが、よろしくお願いいたします。';
      return { title: '臨時休診のお知らせ', blocks, web };
    },
  },
  {
    id: 'jikan',
    name: '診療時間の変更',
    desc: '診療時間や受付時間が変わるとき',
    fields: [
      { key: 'start', label: '変更を始める日', type: 'date', required: true },
      { key: 'hours', label: '変更後の診療時間', type: 'textarea', required: true, placeholder: '午前 9:00〜12:30\n午後 15:00〜18:00', hint: '1行ずつ書くと、そのまま表になります' },
      { key: 'until', label: '期間', type: 'select', options: ['当面の間', '終了日が決まっている', '書かない'] },
      { key: 'end', label: '終了する日', type: 'date', showIf: { until: '終了日が決まっている' } },
      { key: 'reason', label: '理由', type: 'text', placeholder: '例: 医師の勤務体制の見直しのため', hint: '空欄なら、理由は載りません' },
    ],
    build(f) {
      const until = f.until || '当面の間';
      const reason = f.reason ? f.reason.replace(/[、。]$/, '') + '、' : '';
      const blocks = [
        { t: 'p', text: reason + d(f.start) + 'より、診療時間を下記のとおり変更いたします。' },
        { t: 'pre', label: '変更後の診療時間', text: f.hours || '' },
      ];
      if (until === '当面の間') blocks.push({ t: 'p', text: '当面の間、上記の時間で診療いたします。' });
      if (until === '終了日が決まっている' && f.end) blocks.push({ t: 'p', text: 'この変更は、' + keijiFormatDate(f.end) + 'までの予定です。' });
      blocks.push({ t: 'p', text: 'ご不便をおかけしますが、ご理解のほどよろしくお願い申し上げます。' });

      let web = '【診療時間変更のお知らせ】' + d(f.start) + 'より、診療時間を変更いたします。変更後は、'
        + (f.hours || '').split('\n').map((s) => s.trim()).filter(Boolean).join(' / ') + 'です。';
      if (until === '当面の間') web += '当面の間、この時間で診療いたします。';
      if (until === '終了日が決まっている' && f.end) web += keijiFormatDate(f.end) + 'までの予定です。';
      web += 'ご不便をおかけしますが、よろしくお願いいたします。';
      return { title: '診療時間変更のお知らせ', blocks, web };
    },
  },
  {
    id: 'tanto',
    name: '担当医の変更',
    desc: '外来の担当医が交代するとき',
    fields: [
      { key: 'target', label: '変更がある枠', type: 'text', required: true, placeholder: '例: 毎週火曜日 午前の内科外来' },
      { key: 'start', label: '変更する日', type: 'date', required: true },
      { key: 'newDoc', label: '新しい担当医', type: 'text', required: true, placeholder: '例: 山田 太郎 医師' },
      { key: 'oldDoc', label: 'これまでの担当医', type: 'text', placeholder: '空欄なら、この行は載りません' },
      { key: 'note', label: 'ひとこと補足', type: 'text', placeholder: '例: 診療内容に変更はありません' },
    ],
    build(f) {
      const blocks = [
        { t: 'p', text: d(f.start) + 'より、' + (f.target || '外来') + 'の担当医が変わります。' },
      ];
      const items = [];
      if (f.oldDoc) items.push({ k: 'これまでの担当医', v: f.oldDoc });
      items.push({ k: f.oldDoc ? '新しい担当医' : '担当医', v: f.newDoc || '' });
      blocks.push({ t: 'kv', items });
      if (f.note) blocks.push({ t: 'p', text: f.note.replace(/[。]$/, '') + '。' });
      blocks.push({ t: 'p', text: '今後とも、どうぞよろしくお願い申し上げます。' });

      let web = '【担当医変更のお知らせ】' + d(f.start) + 'より、' + (f.target || '外来') + 'の担当医が'
        + (f.newDoc || '') + 'に変わります。';
      if (f.note) web += f.note.replace(/[。]$/, '') + '。';
      web += '今後ともよろしくお願いいたします。';
      return { title: '担当医変更のお知らせ', blocks, web };
    },
  },
  {
    id: 'kyuka',
    name: '休診期間のお知らせ',
    desc: '年末年始・お盆など、まとまった休みのとき',
    fields: [
      { key: 'name', label: '休みの名目', type: 'select', options: ['年末年始', 'お盆', 'ゴールデンウィーク', '夏季'], custom: '自分で書く', customPlaceholder: '例: 改装工事' },
      { key: 'start', label: '休診の初日', type: 'date', required: true },
      { key: 'end', label: '休診の最終日', type: 'date', required: true },
      { key: 'resume', label: '通常どおり診療する日', type: 'date', hint: '空欄なら、この一文は載りません' },
      { key: 'emergency', label: '休診中の対応', type: 'textarea', placeholder: '例: 急を要する場合は、〇〇市の休日当番医(電話 000-000-0000)をご利用ください', hint: '空欄なら、この段落は載りません' },
    ],
    build(f) {
      const name = f.name || '年末年始';
      const blocks = [
        { t: 'p', text: '誠に勝手ながら、下記の期間を休診とさせていただきます。' },
        { t: 'big', text: d(f.start) + ' 〜 ' + d(f.end) },
      ];
      if (f.resume) blocks.push({ t: 'p', text: keijiFormatDate(f.resume) + 'からは、通常どおり診療いたします。' });
      if (f.emergency) blocks.push({ t: 'p', text: f.emergency.replace(/[。]$/, '') + '。' });
      blocks.push({ t: 'p', text: 'ご迷惑をおかけしますが、ご理解のほどよろしくお願い申し上げます。' });

      let web = '【' + name + '休診のお知らせ】' + d(f.start) + 'から' + d(f.end) + 'までは休診いたします。';
      if (f.resume) web += keijiFormatDate(f.resume) + 'からは通常どおり診療いたします。';
      if (f.emergency) web += f.emergency.replace(/[。]$/, '') + '。';
      web += 'ご迷惑をおかけしますが、よろしくお願いいたします。';
      return { title: name + '休診のお知らせ', blocks, web };
    },
  },
  {
    id: 'hatsunetsu',
    name: '発熱・かぜ症状の方への案内',
    desc: '来院前の電話連絡をお願いするとき',
    fields: [
      { key: 'tel', label: '連絡先の電話番号', type: 'text', required: true, placeholder: '例: 03-0000-0000' },
      { key: 'hours', label: '電話の受付時間', type: 'text', placeholder: '例: 平日 9:00〜17:00', hint: '空欄なら、この行は載りません' },
      { key: 'mask', label: 'マスクのお願い', type: 'select', options: ['載せる', '載せない'] },
      { key: 'note', label: '補足', type: 'textarea', placeholder: '例: 駐車場に着きましたら、車内からお電話ください', hint: '空欄なら、この段落は載りません' },
    ],
    build(f) {
      const blocks = [
        { t: 'p', text: '発熱、せき、のどの痛みなどの症状がある方は、来院される前に、お電話でご連絡ください。入口や受付の方法を、通常と分けてご案内する場合があります。' },
      ];
      const items = [{ k: '電話番号', v: f.tel || '' }];
      if (f.hours) items.push({ k: '電話受付時間', v: f.hours });
      blocks.push({ t: 'kv', items });
      if (f.note) blocks.push({ t: 'p', text: f.note.replace(/[。]$/, '') + '。' });
      if (f.mask !== '載せない') blocks.push({ t: 'p', text: '院内では、マスクの着用にご協力をお願いいたします。' });

      let web = '【発熱・かぜ症状のある方へ】発熱やかぜ症状のある方は、来院前にお電話(' + (f.tel || '') + ')でご連絡ください。';
      if (f.hours) web += '電話の受付時間は' + f.hours + 'です。';
      web += '入口や受付の方法を、通常と分けてご案内する場合があります。';
      if (f.note) web += f.note.replace(/[。]$/, '') + '。';
      if (f.mask !== '載せない') web += '院内ではマスクの着用にご協力をお願いいたします。';
      return { title: '発熱・かぜ症状のある方へ', blocks, web };
    },
  },
  {
    id: 'free',
    name: '自由に書く',
    desc: '駐車場工事など、上の型にないお知らせ',
    fields: [
      { key: 'title', label: '見出し', type: 'text', required: true, placeholder: '例: 駐車場工事のお知らせ' },
      { key: 'body', label: '本文', type: 'textarea', required: true, placeholder: '例: 8月18日(月)から22日(金)まで、駐車場の舗装工事を行います。期間中は隣の第2駐車場をご利用ください。', hint: '空行で段落が分かれます。A4一枚に収まる目安は、あわせて15行ほどです' },
    ],
    build(f) {
      const blocks = (f.body || '').split(/\n{2,}/).map((s) => keijiJoinLines(s)).filter(Boolean)
        .map((text) => ({ t: 'p', text }));
      const web = '【' + (f.title || '') + '】' + keijiJoinLines(f.body);
      return { title: f.title || 'お知らせ', blocks, web };
    },
  },
];

/* node からのサンプル生成用(ブラウザでは何もしない) */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { KEIJI_TYPES, keijiFormatDate, keijiFormatIssueDate };
}
