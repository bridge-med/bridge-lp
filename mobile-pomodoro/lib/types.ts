// Data model for BRIDGE Pomodoro.
// Records are flat objects with id/createdAt/updatedAt so the storage layer can
// later be swapped from AsyncStorage to a backend in one place (see lib/store).

export type ID = string;

export interface BaseRecord {
  id: ID;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

export type SessionKind = 'focus' | 'short' | 'long';

// One completed focus interval (breaks are not recorded).
export interface Session extends BaseRecord {
  kind: SessionKind; // always 'focus' for now — kept for future flexibility
  date: string; // yyyy-mm-dd (local) the session completed on
  minutes: number; // planned length of the interval
  startedAt: string; // ISO
  completedAt: string; // ISO
  note: string; // optional label of what you focused on
}

export interface ExportBundle {
  app: 'bridge-pomodoro';
  version: 1;
  exportedAt: string;
  sessions: Session[];
}
