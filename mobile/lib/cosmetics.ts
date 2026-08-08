// Companion cosmetics — buy with coins, equip per category. The single coin
// currency now has a real sink ("育てよう＝コインを使おう"). Persisted & reactive.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { credits } from './credits';

export type CosmeticCat = 'species' | 'hat' | 'pot' | 'bg' | 'acc';

export interface Cosmetic {
  id: string;
  cat: CosmeticCat;
  name: string;
  price: number;
}

export interface Outfit {
  species: string;
  hat: string;
  pot: string;
  bg: string;
  acc: string;
}

export const CAT_LABEL: Record<CosmeticCat, string> = { species: 'しゅるい', hat: 'ぼうし', pot: 'はち', bg: 'はいけい', acc: 'アクセ' };

export const COSMETICS: Cosmetic[] = [
  // species — the evolution branch (what flower the buddy becomes)
  { id: 'species_sprout', cat: 'species', name: 'ふつうの芽', price: 0 },
  { id: 'species_sunflower', cat: 'species', name: '向日葵', price: 120 },
  { id: 'species_tulip', cat: 'species', name: 'チューリップ', price: 120 },
  { id: 'species_cosmos', cat: 'species', name: 'コスモス', price: 130 },
  { id: 'species_hydrangea', cat: 'species', name: '紫陽花', price: 140 },
  { id: 'species_lavender', cat: 'species', name: 'ラベンダー', price: 150 },
  { id: 'species_sakura', cat: 'species', name: '桜', price: 180 },
  { id: 'species_rose', cat: 'species', name: '薔薇', price: 200 },
  // hats
  { id: 'hat_none', cat: 'hat', name: 'なし', price: 0 },
  { id: 'hat_ribbon', cat: 'hat', name: 'リボン', price: 25 },
  { id: 'hat_straw', cat: 'hat', name: 'むぎわら帽子', price: 40 },
  { id: 'hat_beanie', cat: 'hat', name: 'ニット帽', price: 40 },
  { id: 'hat_flower', cat: 'hat', name: 'お花かざり', price: 55 },
  { id: 'hat_crown', cat: 'hat', name: '王冠', price: 150 },
  // pots
  { id: 'pot_coral', cat: 'pot', name: 'テラコッタ', price: 0 },
  { id: 'pot_sky', cat: 'pot', name: 'そらいろ鉢', price: 30 },
  { id: 'pot_wood', cat: 'pot', name: 'きの鉢', price: 30 },
  { id: 'pot_mint', cat: 'pot', name: 'ミント鉢', price: 45 },
  { id: 'pot_gold', cat: 'pot', name: 'こがねの鉢', price: 160 },
  // backgrounds
  { id: 'bg_none', cat: 'bg', name: 'なし', price: 0 },
  { id: 'bg_dawn', cat: 'bg', name: 'あさやけ', price: 50 },
  { id: 'bg_meadow', cat: 'bg', name: 'くさはら', price: 50 },
  { id: 'bg_night', cat: 'bg', name: 'よぞら', price: 65 },
  { id: 'bg_bloom', cat: 'bg', name: 'はなばたけ', price: 80 },
  // accessories
  { id: 'acc_none', cat: 'acc', name: 'なし', price: 0 },
  { id: 'acc_glasses', cat: 'acc', name: 'メガネ', price: 30 },
  { id: 'acc_scarf', cat: 'acc', name: 'マフラー', price: 40 },
];

export const DEFAULT_OUTFIT: Outfit = { species: 'species_sprout', hat: 'hat_none', pot: 'pot_coral', bg: 'bg_none', acc: 'acc_none' };
const FREE_ITEMS = ['species_sprout', 'hat_none', 'pot_coral', 'bg_none', 'acc_none'];

const KEY = 'bridge-daily:cosmetics';

interface CosmeticsData {
  owned: string[];
  equipped: Outfit;
}

const DEFAULT: CosmeticsData = { owned: [...FREE_ITEMS], equipped: { ...DEFAULT_OUTFIT } };

type Listener = () => void;

class CosmeticsStore {
  private data: CosmeticsData = { owned: [...FREE_ITEMS], equipped: { ...DEFAULT_OUTFIT } };
  private loaded = false;
  private loadPromise: Promise<void> | null = null;
  private listeners = new Set<Listener>();

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    if (!this.loaded && !this.loadPromise) void this.load();
    return () => this.listeners.delete(fn);
  };
  getSnapshot = (): CosmeticsData => this.data;

  private emit() {
    this.listeners.forEach((l) => l());
  }

  async load(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = AsyncStorage.getItem(KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as Partial<CosmeticsData>;
          this.data = {
            owned: Array.from(new Set([...FREE_ITEMS, ...(parsed.owned ?? [])])),
            equipped: { ...DEFAULT_OUTFIT, ...(parsed.equipped ?? {}) },
          };
        } catch {
          this.data = { ...DEFAULT, owned: [...FREE_ITEMS] };
        }
      }
      this.loaded = true;
      this.emit();
    });
    return this.loadPromise;
  }

  private async persist() {
    await AsyncStorage.setItem(KEY, JSON.stringify(this.data));
    this.emit();
  }

  owns(id: string): boolean {
    return this.data.owned.includes(id);
  }

  /** Buy an item with coins. Returns true on success. Auto-equips. */
  async buy(id: string): Promise<boolean> {
    const item = COSMETICS.find((c) => c.id === id);
    if (!item || this.owns(id)) return false;
    if (!(await credits.spend(item.price))) return false;
    this.data.owned = [...this.data.owned, id];
    this.data.equipped = { ...this.data.equipped, [item.cat]: id };
    await this.persist();
    return true;
  }

  async equip(id: string): Promise<void> {
    const item = COSMETICS.find((c) => c.id === id);
    if (!item || !this.owns(id)) return;
    this.data.equipped = { ...this.data.equipped, [item.cat]: id };
    await this.persist();
  }
}

export const cosmetics = new CosmeticsStore();

export function useCosmetics(): CosmeticsData {
  return useSyncExternalStore(cosmetics.subscribe, cosmetics.getSnapshot, cosmetics.getSnapshot);
}
