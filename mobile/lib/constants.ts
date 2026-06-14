// Master data for onboarding choices, tags, and task statuses.
// Kept generic so the app can expand beyond medical roles later.

export const PROFESSIONS = [
  '理学療法士',
  '作業療法士',
  '看護師',
  '医療事務',
  '事務長',
  '医療PMI',
  'その他',
] as const;

export const ROLES = ['一般職', 'リーダー', '管理職', '転職検討中', '副業検討中', 'その他'] as const;

export const PURPOSES = [
  '日々の振り返り',
  '職務経歴書の材料づくり',
  '面接対策',
  '昇給・評価面談',
  '1on1',
  '副業プロフィール作成',
  '自分の強みの整理',
] as const;

// Career-oriented tags suggested on logs/memos. Multiple selectable.
export const TAG_PRESETS = [
  '課題発見',
  '業務改善',
  '数字分析',
  '現場調整',
  'チーム連携',
  'リーダーシップ',
  '教育',
  '採用',
  'クレーム対応',
  '失敗',
  '学び',
  '成果',
  '人間関係',
  '意思決定',
  '専門性',
] as const;

export type TaskStatus = 'todo' | 'doing' | 'done' | 'hold';

export const TASK_STATUSES: { key: TaskStatus; label: string; tone: 'neutral' | 'primary' | 'accent' | 'warn' }[] = [
  { key: 'todo', label: '未着手', tone: 'neutral' },
  { key: 'doing', label: '進行中', tone: 'primary' },
  { key: 'done', label: '完了', tone: 'accent' },
  { key: 'hold', label: '保留', tone: 'warn' },
];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: '未着手',
  doing: '進行中',
  done: '完了',
  hold: '保留',
};

export type CareerOutputType =
  | 'resume'
  | 'self_pr'
  | 'interview'
  | 'one_on_one'
  | 'raise'
  | 'side_job';

export const CAREER_OUTPUTS: { key: CareerOutputType; label: string; desc: string }[] = [
  { key: 'resume', label: '職務経歴書風', desc: '実績ベースで経歴をまとめる' },
  { key: 'self_pr', label: '自己PR風', desc: '強み・取り組みをアピール' },
  { key: 'interview', label: '面接回答風', desc: '想定質問に沿った回答例' },
  { key: 'one_on_one', label: '1on1資料風', desc: '上司との面談用の整理' },
  { key: 'raise', label: '昇給交渉資料風', desc: '成果と貢献を交渉向けに' },
  { key: 'side_job', label: '副業プロフィール風', desc: '対外向けのスキル紹介' },
];
