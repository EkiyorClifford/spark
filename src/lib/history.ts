import type { StackPreference } from "@/lib/prompt";

export type HistoryItem = {
  id: string;
  createdAt: number;
  idea: string;
  stack: StackPreference;
  output: string;
};

const KEY = "spark.history.v1";
const MAX = 8;

export function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHistoryItem(item: Omit<HistoryItem, "id" | "createdAt">): HistoryItem[] {
  const next: HistoryItem = {
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };
  const list = [next, ...loadHistory().filter((h) => h.idea !== item.idea)].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(list));
  return list;
}

export function clearHistory(): void {
  localStorage.removeItem(KEY);
}
