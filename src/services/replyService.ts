import { Expense, User } from "@prisma/client";
import { formatDate } from "../utils/date";

export function expenseCreatedReply(
  amount: number,
  category: string,
  note: string
): string {
  const parts = [`記帳成功！`, `金額：$${amount}`, `分類：${category}`];
  if (note) parts.push(`備註：${note}`);
  return parts.join("\n");
}

export function querySummaryReply(
  periodLabel: string,
  expenses: Expense[]
): string {
  if (expenses.length === 0) {
    return `${periodLabel}還沒有任何花費紀錄 📭`;
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  // 依分類統計
  const byCategory: Record<string, number> = {};
  for (const e of expenses) {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
  }

  const lines = [`${periodLabel}花費統計`, `────────────`];
  for (const [cat, amt] of Object.entries(byCategory)) {
    lines.push(`${cat}：$${amt}`);
  }
  lines.push(`────────────`);
  lines.push(`總計：$${total}（${expenses.length} 筆）`);

  // 明細
  lines.push("", "明細：");
  for (const e of expenses) {
    const date = formatDate(e.createdAt);
    const notePart = e.note ? ` (${e.note})` : "";
    lines.push(`  ${date} ${e.category} $${e.amount}${notePart}`);
  }

  return lines.join("\n");
}

export function deleteReply(expense: Expense | null): string {
  if (!expense) {
    return "沒有可刪除的紀錄";
  }
  const notePart = expense.note ? ` (${expense.note})` : "";
  return `已刪除最後一筆：${expense.category} $${expense.amount}${notePart}`;
}

export function bindReply(role: "parent" | "child", displayName: string): string {
  const roleLabel = role === "parent" ? "家長" : "孩子";
  return `${displayName} 已綁定為「${roleLabel}」`;
}

export function settleReply(
  expenses: (Expense & { user: User })[]
): string {
  if (expenses.length === 0) {
    return "目前沒有未確認的支出";
  }

  // 按使用者分組
  const byUser: Record<string, { name: string; items: (Expense & { user: User })[] }> = {};
  for (const e of expenses) {
    const key = e.userId.toString();
    if (!byUser[key]) {
      byUser[key] = { name: e.user.displayName || "未知", items: [] };
    }
    byUser[key].items.push(e);
  }

  const lines = ["未確認支出結算", "════════════", ""];

  let grandTotal = 0;
  for (const { name, items } of Object.values(byUser)) {
    const userTotal = items.reduce((sum, e) => sum + e.amount, 0);
    grandTotal += userTotal;
    lines.push(`${name}（共 $${userTotal}）`);
    lines.push("────────────");
    for (const e of items) {
      const date = formatDate(e.createdAt);
      const notePart = e.note ? ` (${e.note})` : "";
      lines.push(`  ${date} ${e.category} $${e.amount}${notePart}`);
    }
    lines.push("");
  }

  lines.push("════════════");
  lines.push(`總計：$${grandTotal}（${expenses.length} 筆）`);
  lines.push("");
  lines.push(`家長輸入「確認」即可確認全部已付款`);

  return lines.join("\n");
}

export function confirmReply(count: number, targetName?: string): string {
  if (count === 0) {
    return targetName
      ? `${targetName} 沒有未確認的支出`
      : "目前沒有未確認的支出";
  }
  const target = targetName ? ` ${targetName} 的` : "";
  return `已確認${target} ${count} 筆支出`;
}

export function notParentReply(): string {
  return "只有「家長」角色才能確認付款\n請先輸入「綁定 家長」設定角色";
}

export function groupOnlyReply(): string {
  return "此指令僅限群組使用";
}

export function helpReply(): string {
  return [
    "使用說明",
    "────────────",
    "記帳：直接輸入金額和說明",
    "  例：50 午餐",
    "  例：記帳 120 晚餐 牛排",
    "",
    "查詢：",
    "  今日 / 今天 → 今日統計",
    "  本週 / 這週 → 本週統計",
    "  本月 / 這個月 → 本月統計",
    "",
    "刪除：輸入「刪除」移除最後一筆",
    "",
    "群組功能：",
    "  綁定 家長 → 設定為家長角色",
    "  綁定 孩子 → 設定為孩子角色",
    "  結算 → 查看未確認支出",
    "  確認 → 家長確認全部已付款",
    "  確認 小明 → 確認指定人的款項",
  ].join("\n");
}

export const PERIOD_LABELS: Record<string, string> = {
  today: "今日",
  week: "本週",
  month: "本月",
};
