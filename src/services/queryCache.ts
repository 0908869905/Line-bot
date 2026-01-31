import { Expense } from "@prisma/client";

const TTL_MS = 10 * 60 * 1000; // 10 分鐘

interface CacheEntry {
  expenses: Expense[];
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

export function setQueryCache(userId: string, expenses: Expense[]): void {
  cache.set(userId, { expenses, timestamp: Date.now() });
}

export function getFromCache(userId: string, index: number): Expense | null {
  const entry = cache.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > TTL_MS) {
    cache.delete(userId);
    return null;
  }
  if (index < 1 || index > entry.expenses.length) return null;
  return entry.expenses[index - 1];
}
