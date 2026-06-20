// The focus engine — a small reactive store driving the timer.
//
// Countdown is timestamp-based (we store the absolute end time, not a decrementing
// counter), so it stays accurate across re-renders, tab switches and the screen
// turning off. A lightweight interval only nudges subscribers to re-render. When a
// focus interval ends it raises a `pending` completion that the Focus screen turns
// into a FocusSession (完了 / 継続 / 中断 + note) attached to the current work item.

import { useSyncExternalStore } from 'react';
import { tapSuccess } from './haptics';
import { nowIso } from './id';
import { cancelAlarm, scheduleAlarm } from './notifications';
import { durationFor, prefs } from './prefs';
import { playSound } from './sound';
import type { ID, SessionKind } from './types';

export interface PendingCompletion {
  workItemId: ID | null;
  startTime: string;
  endTime: string;
  durationSec: number;
}

export interface TimerState {
  kind: SessionKind;
  running: boolean;
  totalSec: number;
  remainingSec: number;
  completedFocus: number;
  pending: PendingCompletion | null;
}

const LABEL: Record<SessionKind, string> = {
  focus: 'FOCUS',
  short: 'SHORT BREAK',
  long: 'LONG BREAK',
};

const BREAK_MSG: Record<'short' | 'long', { title: string; body: string }> = {
  short: { title: '集中おつかれさま', body: 'ひと息つこう。' },
  long: { title: '集中おつかれさま', body: 'しっかり休もう。' },
};

type Listener = () => void;

class Timer {
  private kind: SessionKind = 'focus';
  private running = false;
  private totalSec = durationFor(prefs.getSnapshot(), 'focus');
  private endAt = 0;
  private remainMs = this.totalSec * 1000;
  private completedFocus = 0;
  private startedAtIso = '';
  private pending: PendingCompletion | null = null;
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
      pending: this.pending,
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

  /** Refresh the current (stopped) interval to match the latest duration prefs. */
  syncDuration() {
    if (this.running || this.pending) return;
    this.totalSec = durationFor(prefs.getSnapshot(), this.kind);
    this.remainMs = this.totalSec * 1000;
    this.emit();
  }

  setKind(kind: SessionKind) {
    this.pause();
    this.kind = kind;
    this.totalSec = durationFor(prefs.getSnapshot(), kind);
    this.remainMs = this.totalSec * 1000;
    this.pending = null;
    this.startedAtIso = '';
    this.emit();
  }

  start() {
    if (this.running || this.pending) return;
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

  reset() {
    this.pause();
    this.remainMs = this.totalSec * 1000;
    this.startedAtIso = '';
    this.emit();
  }

  /** Skip to the end (counts as a completion). */
  skip() {
    if (this.pending) return;
    if (!this.startedAtIso) this.startedAtIso = nowIso();
    this.complete();
  }

  private async scheduleBell() {
    if (!prefs.getSnapshot().soundEnabled) return;
    await cancelAlarm(this.alarmId);
    const secs = Math.round(this.remainingMs() / 1000);
    const title = this.kind === 'focus' ? '集中おつかれさま' : 'BREAK おわり';
    const body = this.kind === 'focus' ? '完了 / 継続 / 中断 を選べます。' : 'つぎの集中へ。';
    this.alarmId = await scheduleAlarm(secs, title, body);
  }

  private ringAndBuzz() {
    const p = prefs.getSnapshot();
    if (p.soundEnabled) playSound(p.soundName);
    if (p.vibrationEnabled) tapSuccess();
  }

  private complete() {
    const finished = this.kind;
    this.running = false;
    this.stopTicking();
    void cancelAlarm(this.alarmId);
    this.alarmId = null;
    this.ringAndBuzz();

    if (finished === 'focus') {
      // Hand off to the Focus screen via `pending`; it records the session.
      this.pending = {
        workItemId: prefs.getSnapshot().currentWorkItemId,
        startTime: this.startedAtIso || nowIso(),
        endTime: nowIso(),
        durationSec: this.totalSec,
      };
      this.emit();
    } else {
      // Breaks aren't logged — drop back to a ready focus interval.
      this.kind = 'focus';
      this.totalSec = durationFor(prefs.getSnapshot(), 'focus');
      this.remainMs = this.totalSec * 1000;
      this.startedAtIso = '';
      this.emit();
    }
  }

  /** Which break follows the just-finished focus session. */
  nextBreakKind(): 'short' | 'long' {
    const p = prefs.getSnapshot();
    const n = this.completedFocus + 1;
    return p.longEvery > 0 && n % p.longEvery === 0 ? 'long' : 'short';
  }

  /** Resolve a pending focus completion. The session record is written by the caller. */
  finishToBreak() {
    this.completedFocus += 1;
    this.setKind(this.nextBreakKind());
  }

  continueFocus() {
    this.completedFocus += 1;
    this.setKind('focus');
    this.start();
  }

  abortToFocus() {
    this.setKind('focus');
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
