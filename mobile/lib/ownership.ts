// オーナーシップ（4分類・ボール管理）。matrix.ts と同じく tasks の派生ロジック層。
//   タスクを受けたら「自分で決める / 誰かに聞く / 誰かに任せる / 今はやらない」の
//   どれかに分け、渡した相手（ballHolder）と次回確認日で「いま誰が持っているか」を
//   見えるようにする。責任を持つことと、自分ですべて実行することは違う——が前提。
// Web版 owner-os/（bridge-lp）の store.js / ai.js から移植・簡約。

import { formatDateJa, todayKey } from './date';
import type { Ownership, Task } from './types';

export const OWNERSHIPS: {
  key: Ownership;
  label: string;
  hint: string; // 選択を促す補助質問（1行）
  tone: 'primary' | 'accent' | 'warn';
}[] = [
  { key: 'decide', label: '自分で決める', hint: 'この判断は、自分にしかできませんか', tone: 'primary' },
  { key: 'ask', label: '誰かに聞く', hint: '誰が最も早く正確に答えられますか', tone: 'accent' },
  { key: 'delegate', label: '誰かに任せる', hint: '実行に最も適した人は誰ですか', tone: 'warn' },
];

// 「今はやらない」は既存ステータスの保留（status: 'hold'）で表す。
// 再確認日（nextCheckDate）が決まっていて初めて意図的な保留になる。
export const HOLD_HINT = '再確認する日を決めれば、放置ではなく意図的な保留になります';

export const OWNERSHIP_LABEL: Record<Ownership, string> = {
  decide: '自分で決める',
  ask: '誰かに聞く',
  delegate: '誰かに任せる',
};

const isOpen = (t: Task) => t.status !== 'done';

/** ボールが相手にある（聞く・任せる相手に渡し済み）か */
export function ballWithOther(t: Task): boolean {
  return isOpen(t) && !!t.ballHolder;
}

/** 催促のタイミングが来ているか（相手ボール × 次回確認日が今日以前） */
export function needsReminder(t: Task): boolean {
  return ballWithOther(t) && !!t.nextCheckDate && t.nextCheckDate <= todayKey();
}

/** 期限超過（未完了 × 期限が昨日以前） */
export function isOverdue(t: Task): boolean {
  return isOpen(t) && t.status !== 'hold' && !!t.dueDate && t.dueDate < todayKey();
}

export interface OwnerBuckets {
  decide: Task[]; // 今日、自分で決めること
  hand: Task[]; // 今日、誰かに渡すこと（聞く/任せるなのに手元にある）
  remind: Task[]; // 今日、催促すること
  blocked: Task[]; // いま、止まっているところ（期限超過・保留の見直し日到来）
}

/** 朝の4区分。作業量ではなく、止まっているものから見るための分け方 */
export function ownerBuckets(all: Task[]): OwnerBuckets {
  const today = todayKey();
  const open = all.filter(isOpen);
  return {
    decide: open.filter((t) => t.ownership === 'decide' && t.status !== 'hold'),
    hand: open.filter(
      (t) => (t.ownership === 'ask' || t.ownership === 'delegate') && !t.ballHolder && t.status !== 'hold',
    ),
    remind: open.filter(needsReminder),
    blocked: open.filter(
      (t) => isOverdue(t) || (t.status === 'hold' && !!t.nextCheckDate && t.nextCheckDate <= today),
    ),
  };
}

/** オーナーシップ機能を使い始めているか（ホームのカード表示条件。既存ユーザーの画面を黙って変えない） */
export function ownershipInUse(all: Task[]): boolean {
  return all.some((t) => t.ownership || t.ballHolder || t.nextCheckDate);
}

/** ボール表示用のグループ。相手の名前ごとにまとめる */
export function ballGroups(all: Task[]): { holder: string; items: Task[] }[] {
  const map = new Map<string, Task[]>();
  for (const t of all) {
    if (!ballWithOther(t)) continue;
    const key = t.ballHolder!.trim() || '相手';
    const arr = map.get(key) ?? [];
    arr.push(t);
    map.set(key, arr);
  }
  return [...map.entries()]
    .map(([holder, items]) => ({ holder, items: items.sort(byDueThenCheck) }))
    .sort((a, b) => b.items.length - a.items.length);
}

const byDueThenCheck = (a: Task, b: Task) => {
  const ad = a.dueDate ?? '9999';
  const bd = b.dueDate ?? '9999';
  if (ad !== bd) return ad < bd ? -1 : 1;
  const ac = a.nextCheckDate ?? '9999';
  const bc = b.nextCheckDate ?? '9999';
  return ac < bc ? -1 : ac > bc ? 1 : 0;
};

// ---- 文章の下書き（端末内テンプレート） -------------------------------------
// 依頼文・催促文。事実だけを機械が書き、相手との関係に合わせて直してから送る前提。

export type DraftTone = 'polite' | 'chat';

export const DRAFT_TONES: { key: DraftTone; label: string }[] = [
  { key: 'polite', label: '丁寧' },
  { key: 'chat', label: 'チャット向け' },
];

function dueJa(key: string | null | undefined): string | null {
  return key ? formatDateJa(key) : null;
}

/** 依頼文（ask のときは質問文）の下書き */
export function composeRequest(t: Task, tone: DraftTone): string {
  const name = t.ballHolder?.trim() ? `${t.ballHolder.trim()}さん` : 'ご担当者さま';
  const ask = t.ownership === 'ask';
  const due = dueJa(t.dueDate);
  const verb = ask ? 'ご確認' : 'ご対応';
  if (tone === 'chat') {
    return [
      `${name}、お疲れさまです。`,
      `「${t.title}」について、${verb}をお願いしたいです。`,
      t.memo ? `背景としては、${t.memo}` : null,
      t.completionCriteria ? `ゴールは「${t.completionCriteria}」の状態です。` : null,
      due ? `${due}までにお願いできると助かります。難しければ一言ください。` : '目安の時期だけでも先に教えてもらえると助かります。',
    ]
      .filter(Boolean)
      .join('\n');
  }
  return [
    name,
    'お世話になっております。',
    `「${t.title}」について、${verb}をお願いいたします。`,
    t.memo ? `背景: ${t.memo}` : null,
    t.completionCriteria ? `完了条件: ${t.completionCriteria}` : null,
    due ? `${due}までにご回答をお願いいたします。難しい場合は、いつ頃になりそうかだけでもお知らせください。` : null,
    'ご不明点があれば、お気軽にお知らせください。',
  ]
    .filter(Boolean)
    .join('\n');
}

/** 催促文の下書き */
export function composeReminder(t: Task, tone: DraftTone): string {
  const name = t.ballHolder?.trim() ? `${t.ballHolder.trim()}さん` : 'ご担当者さま';
  const due = dueJa(t.dueDate);
  if (tone === 'chat') {
    return [
      `${name}、お疲れさまです。`,
      `先日お願いした「${t.title}」、現時点での状況を教えてもらえますか。`,
      due ? `${due}までに必要なため、途中経過でも大丈夫です。` : '途中経過でも大丈夫です。',
      '難しくなっていれば、その旨だけでもお知らせいただけると助かります。',
    ].join('\n');
  }
  return [
    name,
    'お世話になっております。',
    `先日お願いした「${t.title}」について、いまの状況をお聞かせいただけますでしょうか。`,
    due ? `${due}までに必要なため、現時点での状況をご共有いただけますと助かります。` : '現時点での状況をご共有いただけますと助かります。',
    '進めるうえで困りごとがあれば、あわせてお知らせください。',
    'よろしくお願いいたします。',
  ].join('\n');
}
