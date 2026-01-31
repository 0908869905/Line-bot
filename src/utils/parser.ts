import { CATEGORIES, Category, ParseResult } from "../types";

const AMOUNT_MIN = 1;
const AMOUNT_MAX = 100000;

function validateAmount(amount: number): boolean {
  return amount >= AMOUNT_MIN && amount <= AMOUNT_MAX;
}

const QUERY_MAP: Record<string, "today" | "week" | "month"> = {
  今日: "today",
  今天: "today",
  本週: "week",
  這週: "week",
  本月: "month",
  這個月: "month",
};

const BIND_ROLE_MAP: Record<string, "parent" | "child"> = {
  家長: "parent",
  媽媽: "parent",
  爸爸: "parent",
  孩子: "child",
  小孩: "child",
};

function matchCategory(text: string): Category {
  for (const cat of CATEGORIES) {
    if (text.includes(cat)) return cat;
  }
  return "其他";
}

export function parseMessage(text: string): ParseResult {
  const trimmed = text.trim();

  // 綁定指令: "綁定 家長" / "綁定 孩子"
  const bindMatch = trimmed.match(/^綁定\s*(.+)/);
  if (bindMatch) {
    const roleText = bindMatch[1].trim();
    const role = BIND_ROLE_MAP[roleText];
    if (role) {
      return { type: "bind", role };
    }
  }

  // 收到指令
  if (trimmed === "收到") {
    return { type: "receive" };
  }

  // 結算指令
  if (trimmed === "結算") {
    return { type: "settle" };
  }

  // 確認指令: "確認" 或 "確認 小明"
  const confirmMatch = trimmed.match(/^確認(?:\s+(.+))?$/);
  if (confirmMatch) {
    const targetName = confirmMatch[1]?.trim();
    return { type: "confirm", targetName };
  }

  // 查詢指令
  for (const [keyword, period] of Object.entries(QUERY_MAP)) {
    if (trimmed === keyword) {
      return { type: "query", period };
    }
  }

  // 刪除指令: "刪除" / "刪除 #3" / "刪除 午餐"
  const deleteMatch = trimmed.match(/^刪除(?:\s+(.+))?$/);
  if (deleteMatch) {
    const arg = deleteMatch[1]?.trim();
    if (!arg) return { type: "delete" };
    const indexMatch = arg.match(/^#(\d+)$/);
    if (indexMatch) {
      return { type: "delete", index: parseInt(indexMatch[1], 10) };
    }
    const cat = CATEGORIES.find((c) => c === arg);
    if (cat) {
      return { type: "delete", category: cat };
    }
    return { type: "delete" };
  }

  // 修改/編輯指令: "修改 80" / "修改 #3 80" / "修改 午餐 80"
  const editMatch = trimmed.match(/^(?:修改|編輯)\s+(.+)$/);
  if (editMatch) {
    const arg = editMatch[1].trim();
    // "修改 #3 80"
    const indexEditMatch = arg.match(/^#(\d+)\s+(\d+)$/);
    if (indexEditMatch) {
      const amount = parseInt(indexEditMatch[2], 10);
      if (validateAmount(amount)) {
        return { type: "edit", amount, index: parseInt(indexEditMatch[1], 10) };
      }
    }
    // "修改 午餐 80"
    const catEditMatch = arg.match(/^(\S+)\s+(\d+)$/);
    if (catEditMatch) {
      const cat = CATEGORIES.find((c) => c === catEditMatch[1]);
      const amount = parseInt(catEditMatch[2], 10);
      if (cat && validateAmount(amount)) {
        return { type: "edit", amount, category: cat };
      }
    }
    // "修改 80"
    const simpleMatch = arg.match(/^(\d+)$/);
    if (simpleMatch) {
      const amount = parseInt(simpleMatch[1], 10);
      if (validateAmount(amount)) {
        return { type: "edit", amount };
      }
    }
  }

  // 統計指令: "統計" 或 "統計 午餐"
  const statsMatch = trimmed.match(/^統計(?:\s+(.+))?$/);
  if (statsMatch) {
    const catText = statsMatch[1]?.trim();
    if (catText) {
      const category = CATEGORIES.find((c) => c === catText);
      if (category) {
        return { type: "stats", category };
      }
    }
    return { type: "stats" };
  }

  // 記帳格式: "50 午餐" 或 "記帳 120 晚餐 牛排"
  // 模式 1: "記帳 金額 [分類] [備註]"
  const withPrefix = trimmed.match(/^記帳\s+(\d+)\s*(.*)/);
  if (withPrefix) {
    const amount = parseInt(withPrefix[1], 10);
    if (!validateAmount(amount)) return { type: "unknown" };
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
    if (!validateAmount(amount)) return { type: "unknown" };
    const rest = direct[2].trim();
    const category = matchCategory(rest);
    const note = rest
      .replace(category !== "其他" ? category : "", "")
      .trim();
    return { type: "expense", amount, category, note };
  }

  // 純數字也視為記帳
  if (/^\d+$/.test(trimmed)) {
    const amount = parseInt(trimmed, 10);
    if (!validateAmount(amount)) return { type: "unknown" };
    return {
      type: "expense",
      amount,
      category: "其他",
      note: "",
    };
  }

  return { type: "unknown" };
}
