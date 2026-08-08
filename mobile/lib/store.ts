// Reactive in-memory store backed by AsyncStorage.
// Each collection exposes a stable snapshot for `useSyncExternalStore`, so any
// screen subscribed to it re-renders when the data changes — keeping tabs in sync.

import { useSyncExternalStore } from 'react';
import { newId, nowIso } from './id';
import { readCollection, writeCollection, clearCollection } from './storage';
import type { BaseRecord } from './types';

type Listener = () => void;

export class Collection<T extends BaseRecord> {
  private items: T[] = [];
  private loaded = false;
  private listeners = new Set<Listener>();
  private loadPromise: Promise<void> | null = null;

  constructor(public readonly name: string) {}

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    // Lazily hydrate the first time someone subscribes.
    if (!this.loaded && !this.loadPromise) void this.load();
    return () => {
      this.listeners.delete(fn);
    };
  };

  getSnapshot = (): T[] => this.items;

  isLoaded(): boolean {
    return this.loaded;
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  async load(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = readCollection<T>(this.name).then((items) => {
      this.items = items;
      this.loaded = true;
      this.emit();
    });
    return this.loadPromise;
  }

  private async persist() {
    await writeCollection(this.name, this.items);
    this.emit();
  }

  /** Insert (when no id) or update an existing record by id. Returns the saved record. */
  async upsert(input: Partial<T>): Promise<T> {
    const ts = nowIso();
    if (input.id) {
      const idx = this.items.findIndex((it) => it.id === input.id);
      if (idx >= 0) {
        const updated = { ...this.items[idx], ...input, updatedAt: ts } as T;
        this.items = [...this.items.slice(0, idx), updated, ...this.items.slice(idx + 1)];
        await this.persist();
        return updated;
      }
    }
    const created = {
      ...input,
      id: input.id ?? newId(),
      createdAt: ts,
      updatedAt: ts,
    } as T;
    this.items = [created, ...this.items];
    await this.persist();
    return created;
  }

  async remove(id: string): Promise<void> {
    this.items = this.items.filter((it) => it.id !== id);
    await this.persist();
  }

  /** Replace the whole collection (used by import). */
  async replaceAll(items: T[]): Promise<void> {
    this.items = items;
    await this.persist();
  }

  async clear(): Promise<void> {
    this.items = [];
    this.loaded = true;
    await clearCollection(this.name);
    this.emit();
  }
}

// Hook: subscribe a component to a collection's records.
export function useCollection<T extends BaseRecord>(collection: Collection<T>): T[] {
  return useSyncExternalStore(collection.subscribe, collection.getSnapshot, collection.getSnapshot);
}
