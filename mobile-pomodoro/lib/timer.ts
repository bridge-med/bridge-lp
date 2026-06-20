// The Pomodoro engine — a small reactive store driving the timer.
//
// Countdown is timestamp-based (we store the absolute end time, not a decrementing
// counter), so it stays accurate across re-renders, tab switches and the screen
// turning off. A lightweight interval only nudges subscribers to re-render; the
// truth is `endAt - Date.now()`. A one-shot local notification is scheduled for
// the end time so the bell still fires when backgrounded.

import { useSyncExternalStore } from 'react';
import { tapSuccess } from './haptics';
import { nowIso } from './id';
import { todayKey } from './date';
import { sessions } from './data';
import { cancelAlarm, scheduleAlarm } from './notifications';
import { durationFor, prefs } from './prefs';
import type { SessionKind } from './types';

export interface TimerState {
  kind: SessionKind;
  running: boolean;
  totalSec: number; // length of the current interval
  remainingSec: number; // live remaining (ceil)
  completedFocus: number; // focus sessions finished in the current set
}

const LABEL: Record<SessionKind, string> = {
  focus: '集中しよう',
  short: 'ひと息つこう',
  long: 'しっかり休もう',
};

const NEXT_MSG: Record<SessionKind, { title: string; body: string }> = {
  focus: { title: '集中おつかれさま🍅', body: 'ひと息つこう。休憩タイマーを開始できます。' },
  short: { title: '休憩おわり☕️', body: 'つぎの集中をはじめよう。' },
  long: { title: '休憩おわり🌿', body: 'よく休めた。つぎの集中へ。' },
};

type Listener = () => void;

class Timer {
  private kind: SessionKind = 'focus';
  private running = false;
  private totalSec = durationFor(prefs.getSnapshot(), 'focus');
  private endAt = 0; // ms timestamp while running
  private remainMs = this.totalSec * 1000; // remaining while paused
  private completedFocus = 0;
  private startedAtIso = '';
  private alarmId: string | null = null;

  private tickHandle: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<Listener>();
  private snap: TimerState = this.build();

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): TimerState => this.snap;

  labelFor(kind: SessionKind = this.kind): string {
    return LABEL[kind];
  }

  private remainingMs(): number {
    return this.running ? Math.max(0, this.endAt - Date.now()) : this.remainMs;
  }

  private build(): TimerState {
    return {
      kind: this.kind,
      running: this.running,
      totalSec: this.totalSec,
      remainingSec: Math.max(0, Math.ceil(this.remainingMs() / 1000)),
      completedFocus: this.completedFocus,
    };
  }

  private emit() {
    this.snap = this.build();
    this.listeners.forEach((l) => l());
  }

  private startTicking() {
    if (this.tickHandle) return;
    this.tickHandle = setInterval(() => {
      this.emit();
      if (this.running && this.remainingMs() <= 0) this.complete();
    }, 250);
  }

  private stopTicking() {
    if (this.tickHandle) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
  }

  /** Switch mode while stopped (resets the clock to that mode's length). */
  setKind(kind: SessionKind) {
    this.pause();
    this.kind = kind;
    this.totalSec = durationFor(prefs.getSnapshot(), kind);
    this.remainMs = this.totalSec * 1000;
    this.emit();
  }

  start() {
    if (this.running) return;
    if (this.remainMs <= 0) this.remainMs = this.totalSec * 1000;
    this.running = true;
    this.endAt = Date.now() + this.remainMs;
    if (!this.startedAtIso) this.startedAtIso = nowIso();
    this.startTicking();
    void this.scheduleBell();
    this.emit();
  }

  pause() {
    if (!this.running) return;
    this.remainMs = this.remainingMs();
    this.running = false;
    this.stopTicking();
    void cancelAlarm(this.alarmId);
    this.alarmId = null;
    this.emit();
  }

  toggle() {
    this.running ? this.pause() : this.start();
  }

  /** Reset the current interval back to full. */
  reset() {
    this.pause();
    this.remainMs = this.totalSec * 1000;
    this.startedAtIso = '';
    this.emit();
  }

  /** Skip to the end of the current interval (counts as completed). */
  skip() {
    this.complete();
  }

  private async scheduleBell() {
    if (!prefs.getSnapshot().soundEnabled) return;
    await cancelAlarm(this.alarmId);
    const secs = Math.round(this.remainingMs() / 1000);
    const msg = NEXT_MSG[this.kind];
    this.alarmId = await scheduleAlarm(secs, msg.title, msg.body);
  }

  private complete() {
    const finished = this.kind;
    this.running = false;
    this.stopTicking();
    void cancelAlarm(this.alarmId);
    this.alarmId = null;
    tapSuccess();

    if (finished === 'focus') {
      void this.recordFocus();
      this.completedFocus += 1;
      const p = prefs.getSnapshot();
      const goLong = p.longEvery > 0 && this.completedFocus % p.longEvery === 0;
      this.switchTo(goLong ? 'long' : 'short', p.autoStartBreaks);
    } else {
      const p = prefs.getSnapshot();
      this.switchTo('focus', p.autoStartFocus);
    }
  }

  private switchTo(kind: SessionKind, autoStart: boolean) {
    this.kind = kind;
    this.totalSec = durationFor(prefs.getSnapshot(), kind);
    this.remainMs = this.totalSec * 1000;
    this.startedAtIso = '';
    this.emit();
    if (autoStart) this.start();
  }

  private async recordFocus() {
    const completedAt = nowIso();
    await sessions.upsert({
      kind: 'focus',
      date: todayKey(),
      minutes: Math.round(this.totalSec / 60),
      startedAt: this.startedAtIso || completedAt,
      completedAt,
      note: '',
    });
  }
}

export const timer = new Timer();

export function useTimer(): TimerState {
  return useSyncExternalStore(timer.subscribe, timer.getSnapshot, timer.getSnapshot);
}

export function mmss(totalSec: number): string {
  const s = Math.max(0, totalSec);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}
