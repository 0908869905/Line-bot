import { describe, it, expect } from "vitest";
import {
  expenseCreatedReply,
  querySummaryReply,
  deleteReply,
  editReply,
  statsReply,
  helpReply,
  bindReply,
  confirmReply,
  receiveReply,
  notParentReply,
  groupOnlyReply,
} from "../replyService";
import { Expense } from "@prisma/client";

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 1,
    amount: 50,
    category: "午餐",
    note: "",
    confirmed: false,
    confirmedAt: null,
    received: false,
    receivedAt: null,
    createdAt: new Date(2026, 0, 15, 12, 0, 0),
    updatedAt: new Date(2026, 0, 15, 12, 0, 0),
    userId: 1,
    groupId: null,
    ...overrides,
  };
}

describe("expenseCreatedReply", () => {
  it("包含金額和分類", () => {
    const reply = expenseCreatedReply(50, "午餐", "");
    expect(reply).toContain("$50");
    expect(reply).toContain("午餐");
    expect(reply).toContain("記帳成功");
  });

  it("有備註時顯示備註", () => {
    const reply = expenseCreatedReply(120, "晚餐", "牛排");
    expect(reply).toContain("牛排");
  });
});

describe("querySummaryReply", () => {
  it("沒有資料時顯示空訊息", () => {
    const reply = querySummaryReply("今日", []);
    expect(reply).toContain("還沒有任何花費");
  });

  it("有資料時顯示統計", () => {
    const expenses = [
      makeExpense({ amount: 50, category: "午餐" }),
      makeExpense({ id: 2, amount: 30, category: "飲料" }),
    ];
    const reply = querySummaryReply("今日", expenses);
    expect(reply).toContain("$80");
    expect(reply).toContain("2 筆");
  });
});

describe("deleteReply", () => {
  it("沒有紀錄時顯示提示", () => {
    expect(deleteReply(null)).toContain("沒有可刪除");
  });

  it("有紀錄時顯示已刪除內容", () => {
    const reply = deleteReply(makeExpense());
    expect(reply).toContain("已刪除");
    expect(reply).toContain("$50");
  });
});

describe("editReply", () => {
  it("沒有紀錄時顯示提示", () => {
    expect(editReply(null, 80)).toContain("沒有可修改");
  });

  it("有紀錄時顯示修改結果", () => {
    const reply = editReply(makeExpense(), 80);
    expect(reply).toContain("已修改");
    expect(reply).toContain("$80");
  });
});

describe("statsReply", () => {
  it("沒有資料時顯示空訊息", () => {
    const reply = statsReply({}, 0, 0);
    expect(reply).toContain("還沒有任何花費");
  });

  it("有資料時顯示分類佔比", () => {
    const byCategory = {
      午餐: { amount: 200, count: 4 },
      飲料: { amount: 100, count: 2 },
    };
    const reply = statsReply(byCategory, 300, 6);
    expect(reply).toContain("午餐");
    expect(reply).toContain("67%");
    expect(reply).toContain("飲料");
    expect(reply).toContain("33%");
  });

  it("指定分類時顯示該分類統計", () => {
    const byCategory = {
      午餐: { amount: 200, count: 4 },
    };
    const reply = statsReply(byCategory, 200, 4, "午餐");
    expect(reply).toContain("午餐");
    expect(reply).toContain("$200");
    expect(reply).toContain("4 筆");
  });
});

describe("其他回覆函式", () => {
  it("bindReply", () => {
    expect(bindReply("parent", "小明")).toContain("家長");
    expect(bindReply("child", "小花")).toContain("孩子");
  });

  it("confirmReply count=0", () => {
    expect(confirmReply(0)).toContain("沒有未確認");
  });

  it("confirmReply count>0", () => {
    expect(confirmReply(3)).toContain("3 筆");
  });

  it("receiveReply", () => {
    expect(receiveReply(0)).toContain("沒有待確認");
    expect(receiveReply(2)).toContain("2 筆");
  });

  it("notParentReply", () => {
    expect(notParentReply()).toContain("家長");
  });

  it("groupOnlyReply", () => {
    expect(groupOnlyReply()).toContain("群組");
  });

  it("helpReply 包含所有功能說明", () => {
    const help = helpReply();
    expect(help).toContain("記帳");
    expect(help).toContain("查詢");
    expect(help).toContain("修改");
    expect(help).toContain("統計");
    expect(help).toContain("刪除");
  });
});
