import { CATEGORIES, Category, ParseResult } from "../types";

const QUERY_MAP: Record<string, "today" | "week" | "month"> = {
  今日: "today",
  今天: "today",
  本週: "week",
  這週: "week",
  本月: "month",
  這個月: "month",
};

const DELETE_KEYWORDS = ["刪除"];

function matchCategory(text: string): Category {
  for (const cat of CATEGORIES) {
    if (text.includes(cat)) return cat;
  }
  return "其他";
}

export function parseMessage(text: string): ParseResult {
  const trimmed = text.trim();

  // 查詢指令
  for (const [keyword, period] of Object.entries(QUERY_MAP)) {
    if (trimmed === keyword) {
      return { type: "query", period };
    }
  }

  // 刪除指令
  if (DELETE_KEYWORDS.includes(trimmed)) {
    return { type: "delete" };
  }

  // 記帳格式: "50 午餐" 或 "記帳 120 晚餐 牛排"
  // 模式 1: "記帳 金額 [分類] [備註]"
  const withPrefix = trimmed.match(/^記帳\s+(\d+)\s*(.*)/);
  if (withPrefix) {
    const amount = parseInt(withPrefix[1], 10);
    const rest = withPrefix[2].trim();
    const category = matchCategory(rest);
    const note = rest
      .replace(category !== "其他" ? category : "", "")
      .trim();
    return { type: "expense", amount, category, note };
  }

  // 模式 2: "金額 [分類] [備註]"
  const direct = trimmed.match(/^(\d+)\s+(.*)/);
  if (direct) {
    const amount = parseInt(direct[1], 10);
    const rest = direct[2].trim();
    const category = matchCategory(rest);
    const note = rest
      .replace(category !== "其他" ? category : "", "")
      .trim();
    return { type: "expense", amount, category, note };
  }

  // 純數字也視為記帳
  if (/^\d+$/.test(trimmed)) {
    return {
      type: "expense",
      amount: parseInt(trimmed, 10),
      category: "其他",
      note: "",
    };
  }

  return { type: "unknown" };
}
