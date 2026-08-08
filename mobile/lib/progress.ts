// Growth progress: XP, streaks, and badges for the companion.
//
// Activity (writing logs/memos, completing tasks, generating reflections) earns
// XP. Doing something *today* also advances a daily streak and grants a bonus.
// Crossing a level, hitting a streak milestone, or unlocking a badge pushes a
// reward onto a queue that the RewardModal celebrates. Some rewards also grant
// coins (the single in-app currency).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { credits } from './credits';
import { todayKey } from './date';
import { levelInfo, stageForLevel } from './leveling';

const KEY = 'bridge-daily:progress';

// XP per activity.
export const XP = {
  log: 25,
  memo: 4,
  task: 4,
  reflection: 30,
  career: 18,
  workstyle: 18,
  module: 8,
  study: 10, // completing a vocabulary study session
  dailyBonus: 15, // first activity of a real "today"
} as const;

export type Activity = keyof typeof XP;

// Per-day XP-earning caps (anti-farming) for the cheap, repeatable actions.
const DAY_CAP: Partial<Record<Activity, number>> = { memo: 3, task: 4, module: 3, study: 4 };

export type Reward =
  | { kind: 'levelup'; level: number; stageName: string; stageChanged: boolean; coins: number }
  | { kind: 'streak'; days: number; coins: number }
  | { kind: 'badge'; id: string; label: string; coins: number };

interface Badge {
  id: string;
  label: string;
  coins: number;
  test: (s: ProgressData) => boolean;
}

// Badge catalogue. `test` reads the *updated* progress snapshot.
export const BADGES: Badge[] = [
  { id: 'first_log', label: '初めの一歩', coins: 1, test: (s) => s.logsCount >= 1 },
  { id: 'logs_10', label: '記録10回', coins: 1, test: (s) => s.logsCount >= 10 },
  { id: 'logs_30', label: '記録30回', coins: 2, test: (s) => s.logsCount >= 30 },
  { id: 'logs_100', label: '記録100回', coins: 5, test: (s) => s.logsCount >= 100 },
  { id: 'streak_3', label: '3日連続', coins: 1, test: (s) => s.bestStreak >= 3 },
  { id: 'streak_7', label: '7日連続', coins: 1, test: (s) => s.bestStreak >= 7 },
  { id: 'streak_30', label: '30日連続', coins: 2, test: (s) => s.bestStreak >= 30 },
  { id: 'streak_100', label: '100日連続', coins: 5, test: (s) => s.bestStreak >= 100 },
  { id: 'first_reflection', label: '初ふりかえり', coins: 1, test: (s) => s.reflectionsCount >= 1 },
  { id: 'level_10', label: 'Lv.10到達', coins: 1, test: (s) => levelInfo(s.xp).level >= 10 },
  { id: 'level_25', label: 'Lv.25到達', coins: 2, test: (s) => levelInfo(s.xp).level >= 25 },
  { id: 'level_50', label: 'Lv.50到達', coins: 5, test: (s) => levelInfo(s.xp).level >= 50 },
];

// Streak milestones that get their own celebration (+ coin).
const STREAK_MILESTONES: Record<number, number> = { 3: 1, 7: 1, 14: 1, 30: 2, 50: 3, 100: 5 };

interface ProgressData {
  xp: number;
  streak: number;
  bestStreak: number;
  lastDay: string | null; // last day that advanced the streak
  lastBonusDay: string | null; // last day the daily bonus was granted
  logsCount: number;
  reflectionsCount: number;
  badges: string[];
  // today-only counters for per-day caps
  capDay: string | null;
  capCounts: Record<string, number>;
}

const DEFAULT: ProgressData = {
  xp: 0,
  streak: 0,
  bestStreak: 0,
  lastDay: null,
  lastBonusDay: null,
  logsCount: 0,
  reflectionsCount: 0,
  badges: [],
  capDay: null,
  capCounts: {},
};

function yesterdayKey(today: string): string {
  const d = new Date(today + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  return todayKey(d);
}

type Listener = () => void;

class Progress {
  private data: ProgressData = { ...DEFAULT };
  private loaded = false;
  private loadPromise: Promise<void> | null = null;
  private listeners = new Set<Listener>();
  private queue: Reward[] = [];
  private queueListeners = new Set<Listener>();

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    if (!this.loaded && !this.loadPromise) void this.load();
    return () => this.listeners.delete(fn);
  };
  getSnapshot = (): ProgressData => this.data;

  subscribeQueue = (fn: Listener): (() => void) => {
    this.queueListeners.add(fn);
    return () => this.queueListeners.delete(fn);
  };
  getQueueHead = (): Reward | null => this.queue[0] ?? null;

  private emit() {
    this.listeners.forEach((l) => l());
  }
  private emitQueue() {
    this.queueListeners.forEach((l) => l());
  }

  async load(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = AsyncStorage.getItem(KEY).then((raw) => {
      if (raw) {
        try {
          this.data = { ...DEFAULT, ...(JSON.parse(raw) as Partial<ProgressData>) };
        } catch {
          this.data = { ...DEFAULT };
        }
      }
      this.loaded = true;
      this.emit();
    });
    return this.loadPromise;
  }

  private async persist() {
    await AsyncStorage.setItem(KEY, JSON.stringify(this.data));
    this.emit();
  }

  private push(r: Reward) {
    this.queue.push(r);
    this.emitQueue();
  }

  dismissReward = (): void => {
    this.queue.shift();
    this.emitQueue();
  };

  /** Record an activity. `dateKey` is the activity's calendar date (logs can be
   *  back-dated). Returns nothing; celebrations flow through the reward queue. */
  async recordActivity(kind: Activity, dateKey: string = todayKey()): Promise<void> {
    if (!this.loaded) await this.load();
    const today = todayKey();
    const d = this.data;
    const beforeLevel = levelInfo(d.xp).level;

    // counters
    if (kind === 'log') d.logsCount += 1;
    if (kind === 'reflection') d.reflectionsCount += 1;

    // per-day cap for cheap repeatable actions
    let gain: number = XP[kind];
    const cap = DAY_CAP[kind];
    if (cap != null) {
      if (d.capDay !== today) {
        d.capDay = today;
        d.capCounts = {};
      }
      const used = d.capCounts[kind] ?? 0;
      if (used >= cap) gain = 0;
      else d.capCounts[kind] = used + 1;
    }
    d.xp += gain;

    // streak + daily bonus only for *today's* real activity
    if (dateKey === today && d.lastBonusDay !== today) {
      d.lastBonusDay = today;
      if (d.lastDay === today) {
        // already counted today (shouldn't happen given lastBonusDay guard)
      } else if (d.lastDay === yesterdayKey(today)) {
        d.streak += 1;
      } else {
        d.streak = 1;
      }
      d.lastDay = today;
      d.bestStreak = Math.max(d.bestStreak, d.streak);
      d.xp += XP.dailyBonus + Math.min(d.streak, 20);

      const milestoneCoins = STREAK_MILESTONES[d.streak];
      if (milestoneCoins != null) {
        this.push({ kind: 'streak', days: d.streak, coins: milestoneCoins });
        await credits.add(milestoneCoins);
      }
    }

    // level-ups
    const afterLevel = levelInfo(d.xp).level;
    if (afterLevel > beforeLevel) {
      for (let lv = beforeLevel + 1; lv <= afterLevel; lv++) {
        const stage = stageForLevel(lv);
        const stageChanged = stage.minLevel === lv;
        const coins = stageChanged ? 1 : 0;
        if (coins) await credits.add(coins);
        this.push({ kind: 'levelup', level: lv, stageName: stage.name, stageChanged, coins });
      }
    }

    // badges
    for (const b of BADGES) {
      if (!d.badges.includes(b.id) && b.test(d)) {
        d.badges.push(b.id);
        if (b.coins) await credits.add(b.coins);
        this.push({ kind: 'badge', id: b.id, label: b.label, coins: b.coins });
      }
    }

    await this.persist();
  }
}

export const progress = new Progress();

export function useProgress(): ProgressData {
  return useSyncExternalStore(progress.subscribe, progress.getSnapshot, progress.getSnapshot);
}

export function useRewardHead(): Reward | null {
  return useSyncExternalStore(progress.subscribeQueue, progress.getQueueHead, progress.getQueueHead);
}

export type { ProgressData };
