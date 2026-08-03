/* 副業の帳簿 — 集計・CSV生成(純関数のみ)
 * DOMに触れない。ブラウザでは <script> で読み、Nodeの検証テストからも同じ実体を読む。
 * 金額の丸め方針: 途中計算は小数のまま持ち、表示・CSV出力の時点で円単位に丸める。
 * 経費算入額だけは1件ごとに丸める(一覧とCSVの行が突き合わせられるように)。
 */

'use strict';

(function (root) {

  /* ---------- 基本 ---------- */

  // 月額換算。年額契約は12で割る(小数のまま返す)
  function monthlyAmount(f) {
    return f.cycle === 'yearly' ? f.amount / 12 : f.amount;
  }

  // 経費算入額 = 支払金額 × 副業利用割合(1件ごとに円未満四捨五入)
  function deductible(amount, ratio) {
    return Math.round(amount * (ratio / 100));
  }

  function inMonth(dateStr, ym) {
    return typeof dateStr === 'string' && dateStr.slice(0, 7) === ym;
  }

  function inYear(dateStr, year) {
    return typeof dateStr === 'string' && dateStr.slice(0, 4) === String(year);
  }

  function sum(list, fn) {
    return list.reduce((t, x) => t + fn(x), 0);
  }

  function activeFixed(db) {
    return db.fixed.filter((f) => f.status === 'active');
  }

  /* ---------- 月次集計 ----------
   * 固定費は「現在契約中の月割り支払額」をその月に適用する(履歴は持たない)。
   * 回収率・損益分岐は支払額ベース。固定費0円のときは回収率をnullで返す(ゼロ除算しない)。 */
  function monthSummary(db, ym) {
    const sales = db.sales.filter((s) => inMonth(s.date, ym));
    const expenses = db.expenses.filter((e) => inMonth(e.date, ym));
    const fixed = activeFixed(db);

    const salesTotal = sum(sales, (s) => s.amount);
    const feeTotal = sum(sales, (s) => s.fee || 0);
    const expTotal = sum(expenses, (e) => e.amount);
    const expDeductible = sum(expenses, (e) => deductible(e.amount, e.ratio));
    const fixedMonthly = sum(fixed, monthlyAmount);
    const fixedDeductible = sum(fixed, (f) => monthlyAmount(f) * (f.ratio / 100));

    return {
      ym: ym,
      salesTotal: salesTotal,
      feeTotal: feeTotal,
      expTotal: expTotal,
      expDeductible: expDeductible,
      fixedMonthly: fixedMonthly,
      fixedDeductible: fixedDeductible,
      // 利益 = 売上 − 手数料 − 経費(固定費月割り+変動経費、支払額ベース)
      profit: salesTotal - feeTotal - fixedMonthly - expTotal,
      // 固定費回収率 = 当月売上 ÷ 当月固定費 × 100(固定費0円ならnull)
      recovery: fixedMonthly > 0 ? (salesTotal / fixedMonthly) * 100 : null,
      // 損益分岐までの残額 = max(当月固定費 − 当月売上, 0)
      breakeven: Math.max(fixedMonthly - salesTotal, 0),
    };
  }

  /* 推移に出す月: その年で売上・経費の記録がある月+基準月(今月)。
   * 記録のない過去月まで固定費だけの赤字として並べない。昇順で返す。 */
  function monthsWithData(db, year, currentYm) {
    const set = new Set();
    db.sales.concat(db.expenses).forEach((r) => {
      if (inYear(r.date, year)) set.add(r.date.slice(0, 7));
    });
    if (currentYm && currentYm.slice(0, 4) === String(year)) set.add(currentYm);
    return Array.from(set).sort();
  }

  // 年間累計収支 = 対象月(monthsWithData)の利益の合計
  function yearSummary(db, year, currentYm) {
    const months = monthsWithData(db, year, currentYm);
    const rows = months.map((ym) => monthSummary(db, ym));
    return {
      year: year,
      months: rows,
      profitTotal: sum(rows, (r) => r.profit),
      salesTotal: sum(rows, (r) => r.salesTotal),
      costTotal: sum(rows, (r) => r.feeTotal + r.fixedMonthly + r.expTotal),
    };
  }

  // 商品別利益(粗利 = 売上 − 手数料。変動経費・固定費は商品に紐付けない)
  function productProfit(db, year) {
    const map = new Map();
    db.sales.forEach((s) => {
      if (year && !inYear(s.date, year)) return;
      const cur = map.get(s.name) || { name: s.name, count: 0, amount: 0, fee: 0 };
      cur.count += 1;
      cur.amount += s.amount;
      cur.fee += s.fee || 0;
      map.set(s.name, cur);
    });
    return Array.from(map.values())
      .map((p) => ({ name: p.name, count: p.count, amount: p.amount, fee: p.fee, profit: p.amount - p.fee }))
      .sort((a, b) => b.profit - a.profit);
  }

  // サービス別コスト(契約中の固定費。月額換算の大きい順)
  function serviceCosts(db) {
    return activeFixed(db)
      .map((f) => ({
        id: f.id,
        name: f.name,
        category: f.category,
        monthly: monthlyAmount(f),
        ratio: f.ratio,
        monthlyDeductible: monthlyAmount(f) * (f.ratio / 100),
      }))
      .sort((a, b) => b.monthly - a.monthly);
  }

  /* ---------- バリデーション ----------
   * 返り値はエラーメッセージの配列(空なら合格)。 */

  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  }

  function checkAmount(v, label, errors) {
    const n = num(v);
    if (v === '' || v === null || v === undefined || Number.isNaN(n)) errors.push(label + 'を数字で入力してください');
    else if (n < 0) errors.push(label + 'は0以上で入力してください');
    return n;
  }

  function checkRatio(v, errors) {
    const n = num(v);
    if (v === '' || Number.isNaN(n)) errors.push('副業利用割合を数字で入力してください');
    else if (n < 0 || n > 100) errors.push('副業利用割合は0〜100の範囲で入力してください');
    return n;
  }

  function checkDate(v, label, errors) {
    if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) errors.push(label + 'を入力してください');
    return v;
  }

  function validateFixed(input) {
    const errors = [];
    if (!String(input.name || '').trim()) errors.push('サービス名を入力してください');
    checkAmount(input.amount, '金額', errors);
    checkRatio(input.ratio, errors);
    if (input.payDay !== '' && input.payDay !== null && input.payDay !== undefined) {
      const d = num(input.payDay);
      if (Number.isNaN(d) || d < 1 || d > 31 || d !== Math.floor(d)) errors.push('支払日は1〜31の数字で入力してください');
    }
    if (input.renewal && !/^\d{4}-\d{2}-\d{2}$/.test(input.renewal)) errors.push('更新日は日付で入力してください');
    return errors;
  }

  function validateSale(input) {
    const errors = [];
    checkDate(input.date, '売上日', errors);
    if (!String(input.name || '').trim()) errors.push('商品・サービス名を入力してください');
    const amount = checkAmount(input.amount, '売上金額', errors);
    const fee = input.fee === '' ? 0 : checkAmount(input.fee, '手数料', errors);
    if (!Number.isNaN(amount) && amount >= 0 && !Number.isNaN(fee) && fee > amount) errors.push('手数料が売上金額を超えています');
    return errors;
  }

  function validateExpense(input) {
    const errors = [];
    checkDate(input.date, '日付', errors);
    if (!String(input.payee || '').trim()) errors.push('支払先を入力してください');
    checkAmount(input.amount, '金額', errors);
    checkRatio(input.ratio, errors);
    return errors;
  }

  /* ---------- CSV ----------
   * Excelの文字化け対策としてBOM付きUTF-8・CRLFで組み立てる。 */

  function csvCell(v) {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function csv(rows) {
    return '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
  }

  const r0 = (n) => Math.round(n);

  // 月次CSV: 当月の明細(売上・固定費月割り・経費)+集計行
  function buildMonthlyCsv(db, ym) {
    const m = monthSummary(db, ym);
    const rows = [['種別', '日付', '名称', '区分', '金額', '手数料', '副業利用割合(%)', '経費算入額', 'メモ']];
    db.sales.filter((s) => inMonth(s.date, ym)).sort((a, b) => a.date.localeCompare(b.date)).forEach((s) => {
      rows.push(['売上', s.date, s.name, s.channel || '', s.amount, s.fee || 0, '', '', s.memo || '']);
    });
    activeFixed(db).forEach((f) => {
      rows.push(['固定費', ym + '(月割)', f.name, f.category, r0(monthlyAmount(f)), '', f.ratio,
        r0(monthlyAmount(f) * (f.ratio / 100)),
        f.cycle === 'yearly' ? '年額' + f.amount + '円の月割り' : '']);
    });
    db.expenses.filter((e) => inMonth(e.date, ym)).sort((a, b) => a.date.localeCompare(b.date)).forEach((e) => {
      rows.push(['経費', e.date, e.payee, e.account, e.amount, '', e.ratio, deductible(e.amount, e.ratio),
        [e.purpose, e.memo].filter(Boolean).join(' / ')]);
    });
    rows.push(['集計', ym, '売上合計', '', m.salesTotal, m.feeTotal, '', '', '']);
    rows.push(['集計', ym, '固定費合計(月割・支払額)', '', r0(m.fixedMonthly), '', '', r0(m.fixedDeductible), '']);
    rows.push(['集計', ym, '経費合計(支払額)', '', m.expTotal, '', '', m.expDeductible, '']);
    rows.push(['集計', ym, '利益(売上−手数料−固定費−経費)', '', r0(m.profit), '', '', '', '']);
    return csv(rows);
  }

  // 年次CSV: 記録のある月ごとの集計+合計
  function buildYearlyCsv(db, year, currentYm) {
    const y = yearSummary(db, year, currentYm);
    const rows = [['月', '売上', '手数料', '固定費(月割・支払額)', '固定費算入額', '経費(支払額)', '経費算入額', '利益']];
    y.months.forEach((m) => {
      rows.push([m.ym, m.salesTotal, m.feeTotal, r0(m.fixedMonthly), r0(m.fixedDeductible), m.expTotal, m.expDeductible, r0(m.profit)]);
    });
    rows.push(['合計', y.salesTotal,
      sum(y.months, (m) => m.feeTotal),
      r0(sum(y.months, (m) => m.fixedMonthly)),
      r0(sum(y.months, (m) => m.fixedDeductible)),
      sum(y.months, (m) => m.expTotal),
      sum(y.months, (m) => m.expDeductible),
      r0(y.profitTotal)]);
    return csv(rows);
  }

  // 確定申告用経費一覧CSV: 経費レコード(その年)+契約中固定費の年額換算
  function buildTaxCsv(db, year) {
    const rows = [['日付', '支払先・サービス名', '金額', '勘定科目', '副業利用割合(%)', '経費算入額', '用途', '証憑', 'メモ']];
    db.expenses.filter((e) => inYear(e.date, year)).sort((a, b) => a.date.localeCompare(b.date)).forEach((e) => {
      rows.push([e.date, e.payee, e.amount, e.account, e.ratio, deductible(e.amount, e.ratio),
        e.purpose || '', e.receipt ? 'あり' : 'なし', e.memo || '']);
    });
    activeFixed(db).forEach((f) => {
      const annual = f.cycle === 'yearly' ? f.amount : f.amount * 12;
      rows.push([
        f.cycle === 'yearly' ? (f.renewal || year + '(年払い)') : year + '(毎月)',
        f.name, annual, f.account || '', f.ratio, deductible(annual, f.ratio),
        '固定費(' + f.category + ')', '', '年額換算。年の途中の契約・解約は手で調整']);
    });
    return csv(rows);
  }

  // 売上一覧CSV(yearを省略すると全期間)
  function buildSalesCsv(db, year) {
    const rows = [['売上日', '商品・サービス名', '販売チャネル', '売上金額', '手数料', '利益', 'メモ']];
    db.sales
      .filter((s) => !year || inYear(s.date, year))
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach((s) => {
        rows.push([s.date, s.name, s.channel || '', s.amount, s.fee || 0, s.amount - (s.fee || 0), s.memo || '']);
      });
    return csv(rows);
  }

  root.KeiriCalc = {
    monthlyAmount, deductible, monthSummary, monthsWithData, yearSummary,
    productProfit, serviceCosts,
    validateFixed, validateSale, validateExpense,
    buildMonthlyCsv, buildYearlyCsv, buildTaxCsv, buildSalesCsv,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
