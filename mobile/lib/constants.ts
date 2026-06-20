// Master data for onboarding choices, tags, and task statuses.
// Kept generic so the app can expand beyond medical roles later.

// Comprehensive list of medical / clinic roles (Japanese licenses + common
// positions). Selected via a searchable picker. Generic enough to extend later.
export const PROFESSIONS = [
  '医師',
  '歯科医師',
  '薬剤師',
  '看護師',
  '准看護師',
  '保健師',
  '助産師',
  '理学療法士 (PT)',
  '作業療法士 (OT)',
  '言語聴覚士 (ST)',
  '視能訓練士 (ORT)',
  '義肢装具士',
  '臨床検査技師',
  '診療放射線技師',
  '臨床工学技士',
  '管理栄養士',
  '栄養士',
  '歯科衛生士',
  '歯科技工士',
  '救急救命士',
  '公認心理師',
  '臨床心理士',
  '柔道整復師',
  'あん摩マッサージ指圧師',
  'はり師・きゅう師',
  '社会福祉士',
  '介護福祉士',
  '精神保健福祉士',
  '介護支援専門員 (ケアマネ)',
  '医療ソーシャルワーカー (MSW)',
  '医療事務',
  '医療クラーク',
  '診療情報管理士',
  '登録販売者',
  '看護助手',
  '歯科助手',
  '病院事務・事務長',
  'クリニック運営',
  '医療経営・PMI',
  '治験コーディネーター (CRC)',
  '医薬情報担当者 (MR)',
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

// Recurring tasks: completing one spawns the next occurrence.
export type TaskRepeat = 'none' | 'daily' | 'weekly' | 'monthly';

export const TASK_REPEATS: { key: TaskRepeat; label: string }[] = [
  { key: 'none', label: 'なし' },
  { key: 'daily', label: '毎日' },
  { key: 'weekly', label: '毎週' },
  { key: 'monthly', label: '毎月' },
];

// Task categories (work "kinds") — used for the category × quadrant breakdown.
// Users can add their own; these are just the starting suggestions.
export const DEFAULT_TASK_CATEGORIES: string[] = [
  '連絡・調整',
  '書類・記録',
  '会議・打合せ',
  '対応・ケア',
  '学習・準備',
  '改善・企画',
  '事務',
  'その他',
];

// AI providers — bring-your-own-key. Each calls its provider directly.
export type AiProvider = 'gemini' | 'openai' | 'anthropic';

export const AI_PROVIDERS: {
  key: AiProvider;
  label: string;
  model: string;
  keyHint: string;
  keyUrl: string;
}[] = [
  { key: 'gemini', label: 'Google Gemini', model: 'gemini-2.5-flash', keyHint: 'AIza…', keyUrl: 'https://aistudio.google.com/apikey' },
  { key: 'openai', label: 'OpenAI', model: 'gpt-4o-mini', keyHint: 'sk-…', keyUrl: 'https://platform.openai.com/api-keys' },
  { key: 'anthropic', label: 'Anthropic Claude', model: 'claude-haiku-4-5', keyHint: 'sk-ant-…', keyUrl: 'https://console.anthropic.com/settings/keys' },
];

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
