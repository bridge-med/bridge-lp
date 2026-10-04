import { IndexedDBProjectRepository } from "./IndexedDBProjectRepository";
import type { ProjectRepository } from "./ProjectRepository";

let repo: ProjectRepository | null = null;

export function getProjectRepository(): ProjectRepository {
  repo ??= new IndexedDBProjectRepository();
  return repo;
}
