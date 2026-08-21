/* =========================================================================
 * みせびらき — store.js
 * データモデル・端末内保存・集計・購読(pub/sub)。
 * UI(app.js)はこの層だけを通じてデータを読み書きする。
 * 工程と文面の定義は data.js が持つ(この層は「どこまで進んだか」だけを持つ)。
 * データは localStorage にのみ保存する。外部送信はしない。
 *
 * 型:
 *   Product : { id, name, kind, price:number, priceModel, note,
 *               steps: { [stepKey]: { done:boolean, doneAt:string, memo:string } },
 *               createdAt, updatedAt }
 *   Settings: { budget:number }   // 直近に選んだ持ち時間
 *
 * 工程の進捗を配列ではなくキー付きの辞書で持つ理由:
 *   data.js に工程を足したとき、既存データを壊さずに「未完了の工程が1つ増えた」
 *   として自然に現れるようにするため。
 * ========================================================================= */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'bridge-misebiraki-v1';
  const D = global.MisebirakiData;

  const empty = () => ({ v: 1, products: [], settings: { budget: 30 } });
  let state = empty();
  let listeners = [];

  const uid = () => 'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const nowIso = () => new Date().toISOString();

  /* ---- 永続化 ---- */
  function load() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.products)) return false;
      const base = empty();
      base.products = parsed.products.filter((p) => p && typeof p === 'object' && p.id);
      if (parsed.settings && typeof parsed.settings === 'object') {
        base.settings = Object.assign(base.settings, parsed.settings);
      }
      state = base;
      return true;
    } catch (e) {
      return false; // 壊れていたら初期化にフォールバックする
    }
  }

  function save() {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* 保存できない環境(プライベートモード等)でも操作は続けられるようにする */
    }
    listeners.forEach((fn) => fn());
  }

  /* ---- デモデータ ---- */
  function seedDemo() {
    state = empty();
    for (const d of D.DEMO) {
      const p = newProduct({ name: d.name, kind: d.kind, price: d.price, priceModel: d.priceModel, note: d.note }, true);
      for (const k of d.doneKeys) p.steps[k] = { done: true, doneAt: nowIso(), memo: '' };
      state.products.push(p);
    }
    save();
  }

  function newProduct(input, detachedOnly) {
    const p = {
      id: uid(),
      name: (input.name || '').trim(),
      kind: input.kind || D.KINDS[0].key,
      price: Number(input.price) || 0,
      priceModel: input.priceModel || D.PRICE_MODELS[0],
      note: (input.note || '').trim(),
      steps: {},
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    if (!detachedOnly) {
      state.products.push(p);
      save();
    }
    return p;
  }

  function updateProduct(id, patch) {
    const p = state.products.find((x) => x.id === id);
    if (!p) return null;
    if ('name' in patch) p.name = (patch.name || '').trim();
    if ('kind' in patch && patch.kind !== p.kind) {
      p.kind = patch.kind;
      p.steps = {}; // 型を変えると工程が変わるため、進捗は引き継がない
    }
    if ('price' in patch) p.price = Number(patch.price) || 0;
    if ('priceModel' in patch) p.priceModel = patch.priceModel;
    if ('note' in patch) p.note = (patch.note || '').trim();
    p.updatedAt = nowIso();
    save();
    return p;
  }

  function removeProduct(id) {
    state.products = state.products.filter((x) => x.id !== id);
    save();
  }

  function stepState(product, key) {
    return product.steps[key] || { done: false, doneAt: '', memo: '' };
  }

  function setStepDone(productId, key, done) {
    const p = state.products.find((x) => x.id === productId);
    if (!p) return;
    const cur = stepState(p, key);
    p.steps[key] = { done: !!done, doneAt: done ? nowIso() : '', memo: cur.memo || '' };
    p.updatedAt = nowIso();
    save();
  }

  function setStepMemo(productId, key, memo) {
    const p = state.products.find((x) => x.id === productId);
    if (!p) return;
    const cur = stepState(p, key);
    p.steps[key] = { done: cur.done, doneAt: cur.doneAt, memo: memo };
    p.updatedAt = nowIso();
    save();
  }

  /* ---- 集計 ---- */
  const stepsOf = (product) => D.kindByKey(product.kind).steps;

  function progress(product) {
    const steps = stepsOf(product);
    const done = steps.filter((s) => stepState(product, s.key).done).length;
    return { done: done, total: steps.length, remaining: steps.length - done };
  }

  /** 型の順で、最初の未完了の工程。全部終わっていれば null */
  function nextStep(product) {
    return stepsOf(product).find((s) => !stepState(product, s.key).done) || null;
  }

  const isOpen = (product) => nextStep(product) === null;

  /**
   * 今夜の1手を選ぶ。
   *   1. まだ売れる状態になっていない商品だけを見る
   *   2. その商品の「次の工程」だけを候補にする(飛ばして先をやっても経路は通らない)
   *   3. 持ち時間に収まるものだけに絞る
   *   4. 残り手数が少ない商品を優先する(最短で1件売れる状態に届く)
   *   5. 同じなら、放置が長いものから
   * 収まるものが無ければ、いちばん短い次の工程を fallback として返す。
   */
  function tonight(minutes) {
    const cands = [];
    for (const p of state.products) {
      const s = nextStep(p);
      if (!s) continue;
      cands.push({ product: p, step: s, remaining: progress(p).remaining });
    }
    /* 「1つも登録がない」と「全部売れる状態になった」は別物として返す */
    if (!state.products.length) return { pick: null, fallback: null, empty: true, allOpen: false };
    if (!cands.length) return { pick: null, fallback: null, empty: false, allOpen: true };

    const sorter = (a, b) => {
      if (a.remaining !== b.remaining) return a.remaining - b.remaining;
      return String(a.product.updatedAt).localeCompare(String(b.product.updatedAt));
    };
    const fits = cands.filter((c) => c.step.min <= minutes).sort(sorter);
    if (fits.length) return { pick: fits[0], fallback: null, empty: false, allOpen: false };

    const shortest = cands.slice().sort((a, b) => a.step.min - b.step.min || sorter(a, b))[0];
    return { pick: null, fallback: shortest, empty: false, allOpen: false };
  }

  /** 一覧の並び: 売れる状態になっていないものを先に、残り手数の少ない順 */
  function productsSorted() {
    return state.products.slice().sort((a, b) => {
      const oa = isOpen(a) ? 1 : 0;
      const ob = isOpen(b) ? 1 : 0;
      if (oa !== ob) return oa - ob;
      return progress(a).remaining - progress(b).remaining;
    });
  }

  function summary() {
    const all = state.products;
    const open = all.filter(isOpen);
    return {
      total: all.length,
      open: open.length,
      building: all.length - open.length,
      steps: all.reduce((n, p) => n + progress(p).remaining, 0)
    };
  }

  function exportJson() {
    return JSON.stringify(state, null, 2);
  }

  /* ---- 初期化 ---- */
  function init() {
    if (!load()) seedDemo();
  }

  global.MisebirakiStore = {
    init,
    subscribe: (fn) => { listeners.push(fn); },
    get products() { return state.products; },
    get settings() { return state.settings; },
    setBudget(v) { state.settings.budget = Number(v) || 30; save(); },
    newProduct, updateProduct, removeProduct,
    stepState, setStepDone, setStepMemo,
    stepsOf, progress, nextStep, isOpen, tonight, productsSorted, summary,
    exportJson, seedDemo,
    byId: (id) => state.products.find((x) => x.id === id) || null
  };
})(window);
