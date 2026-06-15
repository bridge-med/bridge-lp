// Data model for BRIDGE Worklog.
// Records are flat objects with a user_id so they map ~1:1 onto Supabase tables
// (the storage layer can be swapped from AsyncStorage to Supabase in one place).

import type { CareerOutputType, TaskStatus, TaskRepeat } from './constants';

export type ID = string;
export type { TaskStatus, TaskRepeat, CareerOutputType };

export interface BaseRecord {
  id: ID;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

// users — stored as a single local profile (see lib/prefs.ts) until Supabase auth.
export interface Profile {
  profession: string;
  role: string;
  purpose: string;
}

// work_logs
export interface WorkLog extends BaseRecord {
  date: string; // yyyy-mm-dd
  title: string;
  did: string; // 今日やったこと
  problem: string; // 困ったこと
  devised: string; // 工夫したこと
  decision: string; // 自分の判断
  people: string; // 誰と関わったか
  result: string; // 結果
  learning: string; // 学び
  nextAction: string; // 次にやること
  memo: string; // 自由メモ
  tags: string[];
}

// quick_memos
export interface QuickMemo extends BaseRecord {
  content: string;
  tags: string[];
  convertedToLogId: ID | null; // set when promoted to a work log
}

// tasks
export interface Task extends BaseRecord {
  title: string;
  relatedLogId: ID | null;
  dueDate: string | null; // yyyy-mm-dd
  status: TaskStatus;
  memo: string;
  doneAt: string | null;
  repeat?: TaskRepeat; // undefined treated as 'none' (back-compat)
}

export type ReflectionPeriod = 'week' | 'month';

export interface ReflectionContent {
  did: string; // 今週やったこと
  impressive: string; // 印象に残った出来事
  issues: string; // 課題
  improved: string; // 改善したこと
  next: string; // 次にやること
  strengths: string; // 強みとして見えてきたこと
  achievements: string; // 職務経歴書に使えそうな実績候補
}

// reflections
export interface Reflection extends BaseRecord {
  periodType: ReflectionPeriod;
  startDate: string; // yyyy-mm-dd
  endDate: string; // yyyy-mm-dd
  content: ReflectionContent;
  aiGenerated: boolean;
}

// career_outputs
export interface CareerOutput extends BaseRecord {
  outputType: CareerOutputType;
  sourceLogIds: ID[];
  content: string; // markdown-ish text
  aiGenerated: boolean;
}

// Generic record for the config-driven modules (strengths, skills, goals, …).
export interface GenericRecord extends BaseRecord {
  [k: string]: unknown;
}

export type LangCode = 'en' | 'ko';

export interface VocabItem {
  term: string; // original (Japanese)
  translation: string; // target language
  reading?: string; // pronunciation hint
}

// lang_cards — a work log/memo turned into a language-study card.
export interface LangCard extends BaseRecord {
  lang: LangCode;
  sourceText: string; // original Japanese
  translation: string; // full translation
  vocab: VocabItem[];
  sourceLogId: ID | null;
}

export interface ExportBundle {
  app: 'bridge-worklog';
  version: 1;
  exportedAt: string;
  workLogs: WorkLog[];
  quickMemos: QuickMemo[];
  tasks: Task[];
  reflections: Reflection[];
  careerOutputs: CareerOutput[];
  langCards?: LangCard[];
  modules?: Record<string, GenericRecord[]>;
}
