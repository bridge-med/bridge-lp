// Data model for BRIDGE Focus.
// Designed so focus time attaches to a *work item* that can later come from — or
// be returned to — an external memo / task / worklog app. Records are flat with
// id/createdAt/updatedAt so the storage layer can swap to a backend in one place.

export type ID = string;

export interface BaseRecord {
  id: ID;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

// Where a work item originated. 'manual' = typed in this app; the rest are for
// future integration with the sibling apps.
export type WorkSource = 'manual' | 'memo_app' | 'task_app' | 'worklog_app';

// The thing you focus on. Kept deliberately thin — this is NOT a task manager.
export interface WorkItem extends BaseRecord {
  title: string;
  source: WorkSource;
  sourceId: string | null; // id in the originating app, when linked
  category: string; // free label, optional
}

export type SessionKind = 'focus' | 'short' | 'long';

// How a finished focus interval was wrapped up.
export type SessionStatus = 'completed' | 'continued' | 'aborted';

// One focus interval, attached to a work item (or null when none was chosen).
export interface FocusSession extends BaseRecord {
  workItemId: ID | null;
  kind: SessionKind; // 'focus' for logged sessions
  date: string; // yyyy-mm-dd (local) — derived from endTime, for fast grouping
  startTime: string; // ISO
  endTime: string; // ISO
  duration: number; // seconds actually focused
  status: SessionStatus;
  note: string; // optional one-liner
}

export interface ExportBundle {
  app: 'bridge-focus';
  version: 1;
  exportedAt: string;
  workItems: WorkItem[];
  focusSessions: FocusSession[];
}
