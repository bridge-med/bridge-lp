import type { Project, ProjectSummary } from "@/types/project";

/**
 * 保存先の差し替え口。v0.1 はブラウザの IndexedDB。
 * Supabase / PostgreSQL に移すときは、これを実装したクラスを足して lib/storage/index.ts で切り替える。
 */
export interface ProjectRepository {
  list(): Promise<ProjectSummary[]>;
  get(id: string): Promise<Project | null>;
  save(project: Project): Promise<void>;
  delete(id: string): Promise<void>;
}
