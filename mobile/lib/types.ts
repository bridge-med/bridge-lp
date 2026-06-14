// Data model for BRIDGE Daily.
// Records are flat objects so they map ~1:1 onto a future backend table
// (e.g. Supabase) — the same migration path the web worklog app documents.

export type ID = string;

export interface BaseRecord {
  id: ID;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

export type TaskStatus = 'todo' | 'done';
export type Priority = 'low' | 'normal' | 'high';

export interface Task extends BaseRecord {
  title: string;
  notes: string;
  status: TaskStatus;
  priority: Priority;
  due: string | null; // yyyy-mm-dd or null
  doneAt: string | null; // ISO timestamp when completed
  tags: string[];
}

export interface Memo extends BaseRecord {
  title: string;
  body: string;
  pinned: boolean;
  tags: string[];
}

export type Mood = 1 | 2 | 3 | 4 | 5;

export interface JournalEntry extends BaseRecord {
  date: string; // yyyy-mm-dd
  mood: Mood | null;
  body: string;
}

export type CollectionName = 'tasks' | 'memos' | 'journal';

export interface ExportBundle {
  app: 'bridge-daily';
  version: 1;
  exportedAt: string;
  tasks: Task[];
  memos: Memo[];
  journal: JournalEntry[];
}
