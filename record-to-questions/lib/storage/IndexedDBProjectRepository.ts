import type { Project, ProjectSummary } from "@/types/project";
import type { ProjectRepository } from "./ProjectRepository";

const DB_NAME = "record-to-questions";
const DB_VERSION = 1;
const STORE = "projects";

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB の操作に失敗しました"));
  });
}

/** 端末のブラウザ内だけに保存する。サーバーや他の利用者には送らない */
export class IndexedDBProjectRepository implements ProjectRepository {
  private db: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("このブラウザでは保存できません(IndexedDB が使えません)"));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("保存領域を開けませんでした"));
    });
    return this.db;
  }

  private async store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    return (await this.open()).transaction(STORE, mode).objectStore(STORE);
  }

  async list(): Promise<ProjectSummary[]> {
    const all = await request((await this.store("readonly")).getAll() as IDBRequest<Project[]>);
    return all
      .map((p) => ({
        id: p.id,
        title: p.title,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        questionCount: p.questions.length,
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string): Promise<Project | null> {
    return (await request((await this.store("readonly")).get(id) as IDBRequest<Project | undefined>)) ?? null;
  }

  async save(project: Project): Promise<void> {
    await request((await this.store("readwrite")).put(project));
  }

  async delete(id: string): Promise<void> {
    await request((await this.store("readwrite")).delete(id));
  }
}
