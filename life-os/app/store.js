/* ================================================================
   LIFE//OS — store
   端末内のみ。localStorage に1キーで保持する。外部送信はしない。
   1日の境界は 04:00。深夜1時のログは前日に属する。
   ================================================================ */
(function (global) {
  'use strict';

  var KEY = 'lifeos.v1';
  var DAY_CUTOFF_HOUR = 4;

  /* ---------------- 日付 ---------------- */

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function keyOf(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /** 04:00 を境にした「その日」のキー */
  function dayKey(date) {
    var d = new Date(date || Date.now());
    if (d.getHours() < DAY_CUTOFF_HOUR) d.setDate(d.getDate() - 1);
    return keyOf(d);
  }

  function parseKey(k) {
    var p = k.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  function shiftKey(k, days) {
    var d = parseKey(k);
    d.setDate(d.getDate() + days);
    return keyOf(d);
  }

  /** 直近 n 日分のキー（古い順、末尾が今日） */
  function keyRange(endKey, n) {
    var out = [];
    for (var i = n - 1; i >= 0; i--) out.push(shiftKey(endKey, -i));
    return out;
  }

  function hhmm(date) {
    var d = new Date(date || Date.now());
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  /** 04:00 起点で並べ替えるための分。00:00〜03:59 は +24h 扱い */
  function sortMinutes(time) {
    var p = String(time || '00:00').split(':');
    var m = (+p[0]) * 60 + (+p[1]);
    return (+p[0]) < DAY_CUTOFF_HOUR ? m + 1440 : m;
  }

  /* ---------------- 既定値 ---------------- */

  function emptyState() {
    return {
      version: 1,
      createdAt: new Date().toISOString(),
      settings: {
        theme: 'dark',
        lastBootKey: '',
        seen: {},          // 演出の既読フラグ（キー→日付キー）
        unlocked: [],      // 解放したイースターエッグ
        demo: false        // デモデータが入っているか
      },
      days: {}
    };
  }

  function emptyDay(k) {
    return {
      date: k,
      startedAt: null,     // その日はじめて開いた時刻 "HH:MM"
      input: null,         // { sleep, condition, sharpness, social, stress }
      inputAt: null,
      status: null,        // { energy, focus, mood, body, social }
      missions: [],        // [{ id, text, tag, color, done }]
      events: [],          // [{ id, type, time, note, qty }]
      report: null         // { score, grades, comment, endedAt }
    };
  }

  /* ---------------- 読み書き ---------------- */

  var state = null;

  function load() {
    try {
      var raw = global.localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.days) {
          state = parsed;
          if (!state.settings) state.settings = emptyState().settings;
          if (!state.settings.seen) state.settings.seen = {};
          if (!state.settings.unlocked) state.settings.unlocked = [];
          return state;
        }
      }
    } catch (e) { /* 壊れていたら作り直す。既存データは上書き前に握りつぶさない */ }
    state = emptyState();
    return state;
  }

  var saveTimer = null;

  function save() {
    if (saveTimer) return;
    saveTimer = global.setTimeout(function () {
      saveTimer = null;
      try {
        global.localStorage.setItem(KEY, JSON.stringify(state));
      } catch (e) {
        global.dispatchEvent(new CustomEvent('lifeos:saveerror'));
      }
    }, 60);
  }

  function saveNow() {
    if (saveTimer) { global.clearTimeout(saveTimer); saveTimer = null; }
    try { global.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  /* ---------------- 参照 ---------------- */

  function get() { return state || load(); }

  function day(k, create) {
    var s = get();
    if (!s.days[k] && create) s.days[k] = emptyDay(k);
    return s.days[k] || null;
  }

  function today() { return dayKey(); }

  function todayDay(create) { return day(today(), create !== false); }

  /** 入力済みの日を古い順に返す */
  function recordedKeys() {
    var s = get();
    return Object.keys(s.days).filter(function (k) {
      return s.days[k] && s.days[k].status;
    }).sort();
  }

  /** 連続入力日数（今日または昨日を起点に遡る） */
  function streak() {
    var s = get();
    var t = today();
    var cursor = (s.days[t] && s.days[t].status) ? t : shiftKey(t, -1);
    var n = 0;
    while (s.days[cursor] && s.days[cursor].status) {
      n++;
      cursor = shiftKey(cursor, -1);
    }
    return n;
  }

  /* ---------------- 更新 ---------------- */

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function touchStart() {
    var d = todayDay(true);
    if (!d.startedAt) { d.startedAt = hhmm(); save(); }
    return d;
  }

  function addEvent(k, ev) {
    var d = day(k, true);
    ev.id = ev.id || uid();
    d.events.push(ev);
    sortEvents(d);
    save();
    return ev;
  }

  function updateEvent(k, id, patch) {
    var d = day(k);
    if (!d) return;
    for (var i = 0; i < d.events.length; i++) {
      if (d.events[i].id === id) {
        for (var p in patch) if (Object.prototype.hasOwnProperty.call(patch, p)) d.events[i][p] = patch[p];
        break;
      }
    }
    sortEvents(d);
    save();
  }

  function removeEvent(k, id) {
    var d = day(k);
    if (!d) return;
    d.events = d.events.filter(function (e) { return e.id !== id; });
    save();
  }

  function sortEvents(d) {
    d.events.sort(function (a, b) { return sortMinutes(a.time) - sortMinutes(b.time); });
  }

  function setSetting(name, value) {
    get().settings[name] = value;
    save();
  }

  function markSeen(name, value) {
    get().settings.seen[name] = value || today();
    save();
  }

  function hasSeen(name, value) {
    return get().settings.seen[name] === (value || today());
  }

  function unlock(name) {
    var u = get().settings.unlocked;
    if (u.indexOf(name) === -1) { u.push(name); save(); return true; }
    return false;
  }

  function isUnlocked(name) {
    return get().settings.unlocked.indexOf(name) !== -1;
  }

  /* ---------------- 書き出し・取り込み・消去 ---------------- */

  function exportJSON() {
    return JSON.stringify(get(), null, 2);
  }

  function importJSON(text) {
    var parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || !parsed.days) throw new Error('形式が違います');
    state = parsed;
    if (!state.settings) state.settings = emptyState().settings;
    if (!state.settings.seen) state.settings.seen = {};
    if (!state.settings.unlocked) state.settings.unlocked = [];
    saveNow();
  }

  function wipe() {
    state = emptyState();
    saveNow();
  }

  function byteSize() {
    try { return new Blob([global.localStorage.getItem(KEY) || '']).size; }
    catch (e) { return (global.localStorage.getItem(KEY) || '').length; }
  }

  global.LifeStore = {
    KEY: KEY,
    DAY_CUTOFF_HOUR: DAY_CUTOFF_HOUR,
    load: load, save: save, saveNow: saveNow, get: get,
    day: day, today: today, todayDay: todayDay, emptyDay: emptyDay,
    dayKey: dayKey, keyOf: keyOf, parseKey: parseKey, shiftKey: shiftKey,
    keyRange: keyRange, hhmm: hhmm, sortMinutes: sortMinutes, pad: pad,
    recordedKeys: recordedKeys, streak: streak, uid: uid, touchStart: touchStart,
    addEvent: addEvent, updateEvent: updateEvent, removeEvent: removeEvent,
    setSetting: setSetting, markSeen: markSeen, hasSeen: hasSeen,
    unlock: unlock, isUnlocked: isUnlocked,
    exportJSON: exportJSON, importJSON: importJSON, wipe: wipe, byteSize: byteSize
  };
})(window);
