// Config-driven feature modules. Each module is a small CRUD collection
// rendered by a single generic screen (components/ModuleScreen). Adding a
// section = adding one config entry here. Designed to be trimmed freely.

import type { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Collection } from './store';
import type { GenericRecord } from './types';

export type FieldType = 'text' | 'multiline' | 'date' | 'tags' | 'rating' | 'number' | 'select';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: string[];
}

export interface ModuleConfig {
  key: string;
  title: string; // JP title shown as hero
  hub: string; // short label in the hub list
  icon: ComponentProps<typeof Feather>['name'];
  desc: string;
  fields: FieldDef[];
  primary: string; // field shown as the row title
  subtitle?: string; // field shown as the row subtitle
  dateField?: string; // field used for the gutter date + sort
  singleton?: boolean; // single editable record (e.g. self-analysis)
  group: 'career' | 'self' | 'growth';
}

export const MODULES: ModuleConfig[] = [
  {
    key: 'strengths', title: '強み', hub: '強み', icon: 'award', desc: '自分の強みと、その根拠',
    group: 'self', primary: 'title', subtitle: 'evidence',
    fields: [
      { key: 'title', label: '強み', type: 'text', placeholder: '例: 多職種を巻き込む調整力' },
      { key: 'evidence', label: '根拠・エピソード', type: 'multiline' },
      { key: 'tags', label: 'タグ', type: 'tags' },
    ],
  },
  {
    key: 'weaknesses', title: '弱み・課題', hub: '弱み・課題', icon: 'target', desc: '伸びしろと向き合い方',
    group: 'self', primary: 'title', subtitle: 'plan',
    fields: [
      { key: 'title', label: '弱み・課題', type: 'text' },
      { key: 'plan', label: '向き合い方・改善', type: 'multiline' },
    ],
  },
  {
    key: 'self', title: '自己分析', hub: '自己分析 (Will/Can/Must・SWOT)', icon: 'user', desc: 'Will/Can/Must と SWOT',
    group: 'self', singleton: true, primary: 'will',
    fields: [
      { key: 'will', label: 'Will（やりたいこと）', type: 'multiline' },
      { key: 'can', label: 'Can（できること）', type: 'multiline' },
      { key: 'must', label: 'Must（求められること）', type: 'multiline' },
      { key: 's', label: '強み Strength', type: 'multiline' },
      { key: 'w', label: '弱み Weakness', type: 'multiline' },
      { key: 'o', label: '機会 Opportunity', type: 'multiline' },
      { key: 't', label: '脅威 Threat', type: 'multiline' },
    ],
  },
  {
    key: 'values', title: '価値観', hub: '価値観', icon: 'compass', desc: '大事にしたいこと',
    group: 'self', primary: 'title', subtitle: 'note',
    fields: [
      { key: 'title', label: '大事にしたい価値観', type: 'text' },
      { key: 'note', label: 'なぜ大事か', type: 'multiline' },
    ],
  },
  {
    key: 'motivation', title: 'モチベーション', hub: 'モチベーション曲線', icon: 'activity', desc: '時期ごとの浮き沈み',
    group: 'self', primary: 'label', subtitle: 'note',
    fields: [
      { key: 'label', label: '時期・出来事', type: 'text' },
      { key: 'score', label: '気持ち', type: 'select', options: ['+2', '+1', '0', '-1', '-2'] },
      { key: 'note', label: 'メモ', type: 'text' },
    ],
  },
  {
    key: 'achievements', title: '成果', hub: '成果・実績', icon: 'trending-up', desc: '数字で語れる実績',
    group: 'career', primary: 'title', subtitle: 'metric', dateField: 'date',
    fields: [
      { key: 'title', label: '成果', type: 'text' },
      { key: 'metric', label: '指標', type: 'text', placeholder: '例: 平均単位数 / 残業時間' },
      { key: 'before', label: 'Before', type: 'text' },
      { key: 'after', label: 'After', type: 'text' },
      { key: 'date', label: '時期', type: 'date' },
      { key: 'note', label: '補足（経営的な意味など）', type: 'multiline' },
      { key: 'tags', label: 'タグ', type: 'tags' },
    ],
  },
  {
    key: 'skills', title: 'スキル', hub: 'スキル', icon: 'layers', desc: '保有スキルとレベル',
    group: 'career', primary: 'name', subtitle: 'category',
    fields: [
      { key: 'name', label: 'スキル', type: 'text' },
      { key: 'level', label: 'レベル', type: 'rating' },
      { key: 'category', label: '分類', type: 'select', options: ['専門', '対人', 'マネジメント', '業務', 'その他'] },
      { key: 'note', label: 'メモ', type: 'text' },
    ],
  },
  {
    key: 'goals', title: '目標', hub: '目標・キャリアプラン', icon: 'flag', desc: 'これから取りに行く経験',
    group: 'career', primary: 'title', subtitle: 'status', dateField: 'due',
    fields: [
      { key: 'title', label: '目標', type: 'text' },
      { key: 'due', label: '期限', type: 'date' },
      { key: 'status', label: '状態', type: 'select', options: ['進行中', '達成', '保留'] },
      { key: 'progress', label: '手応え', type: 'rating' },
      { key: 'note', label: 'メモ', type: 'multiline' },
    ],
  },
  {
    key: 'learning', title: '学習・資格', hub: '学習・資格', icon: 'book-open', desc: '学んだこと・取った資格',
    group: 'growth', primary: 'title', subtitle: 'kind', dateField: 'date',
    fields: [
      { key: 'title', label: '学んだこと・資格', type: 'text' },
      { key: 'kind', label: '種別', type: 'select', options: ['資格', '研修', '読書', 'オンライン', 'その他'] },
      { key: 'date', label: '日付', type: 'date' },
      { key: 'note', label: 'メモ', type: 'multiline' },
    ],
  },
  {
    key: 'kudos', title: 'もらった言葉', hub: 'もらった言葉・称賛', icon: 'message-circle', desc: '感謝・フィードバック',
    group: 'growth', primary: 'content', subtitle: 'who', dateField: 'date',
    fields: [
      { key: 'content', label: '言われたこと', type: 'multiline' },
      { key: 'who', label: '誰から', type: 'text' },
      { key: 'date', label: '日付', type: 'date' },
    ],
  },
  {
    key: 'oneonone', title: '1on1メモ', hub: '1on1・面談メモ', icon: 'users', desc: '上司・面談の準備と記録',
    group: 'growth', primary: 'topics', subtitle: 'result', dateField: 'date',
    fields: [
      { key: 'date', label: '日付', type: 'date' },
      { key: 'topics', label: '話したいこと', type: 'multiline' },
      { key: 'result', label: 'メモ・決定事項', type: 'multiline' },
    ],
  },
];

export function moduleByKey(key: string): ModuleConfig | undefined {
  return MODULES.find((m) => m.key === key);
}

const cols = new Map<string, Collection<GenericRecord>>();
export function moduleCollection(key: string): Collection<GenericRecord> {
  if (!cols.has(key)) cols.set(key, new Collection<GenericRecord>('mod_' + key));
  return cols.get(key)!;
}

export async function loadModules(): Promise<void> {
  await Promise.all(MODULES.map((m) => moduleCollection(m.key).load()));
}

export function exportModules(): Record<string, GenericRecord[]> {
  return Object.fromEntries(MODULES.map((m) => [m.key, moduleCollection(m.key).getSnapshot()]));
}

export async function importModules(data: Record<string, GenericRecord[]> | undefined): Promise<void> {
  if (!data) return;
  await Promise.all(MODULES.map((m) => moduleCollection(m.key).replaceAll(Array.isArray(data[m.key]) ? data[m.key] : [])));
}

export async function clearModules(): Promise<void> {
  await Promise.all(MODULES.map((m) => moduleCollection(m.key).clear()));
}
