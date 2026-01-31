import { describe, it, expect } from "vitest";
import { parseMessage } from "../parser";

describe("parseMessage", () => {
  // 記帳 - 基本格式
  it("解析「50 午餐」", () => {
    const result = parseMessage("50 午餐");
    expect(result).toEqual({
      type: "expense",
      amount: 50,
      category: "午餐",
      note: "",
    });
  });

  it("解析「記帳 120 晚餐 牛排」", () => {
    const result = parseMessage("記帳 120 晚餐 牛排");
    expect(result).toEqual({
      type: "expense",
      amount: 120,
      category: "晚餐",
      note: "牛排",
    });
  });

  it("解析純數字「100」", () => {
    const result = parseMessage("100");
    expect(result).toEqual({
      type: "amount_only",
      amount: 100,
    });
  });

  it("解析「35 飲料 珍奶」", () => {
    const result = parseMessage("35 飲料 珍奶");
    expect(result).toEqual({
      type: "expense",
      amount: 35,
      category: "飲料",
      note: "珍奶",
    });
  });

  // 金額驗證
  it("金額 0 回傳 unknown", () => {
    expect(parseMessage("0 午餐")).toEqual({ type: "unknown" });
  });

  it("金額超過 100000 回傳 unknown", () => {
    expect(parseMessage("100001 午餐")).toEqual({ type: "unknown" });
  });

  it("金額 999999 純數字回傳 unknown", () => {
    expect(parseMessage("999999")).toEqual({ type: "unknown" });
  });

  it("金額 100000 是允許的最大值", () => {
    const result = parseMessage("100000 午餐");
    expect(result).toEqual({
      type: "expense",
      amount: 100000,
      category: "午餐",
      note: "",
    });
  });

  it("金額 1 是允許的最小值", () => {
    const result = parseMessage("1");
    expect(result).toEqual({
      type: "amount_only",
      amount: 1,
    });
  });

  // 查詢
  it("解析「今日」為 query today", () => {
    expect(parseMessage("今日")).toEqual({ type: "query", period: "today" });
  });

  it("解析「本週」為 query week", () => {
    expect(parseMessage("本週")).toEqual({ type: "query", period: "week" });
  });

  it("解析「本月」為 query month", () => {
    expect(parseMessage("本月")).toEqual({ type: "query", period: "month" });
  });

  // 刪除
  it("解析「刪除」", () => {
    expect(parseMessage("刪除")).toEqual({ type: "delete" });
  });

  it("解析「刪除 #3」", () => {
    expect(parseMessage("刪除 #3")).toEqual({ type: "delete", index: 3 });
  });

  it("解析「刪除 午餐」", () => {
    expect(parseMessage("刪除 午餐")).toEqual({ type: "delete", category: "午餐" });
  });

  it("解析「刪除 飲料」", () => {
    expect(parseMessage("刪除 飲料")).toEqual({ type: "delete", category: "飲料" });
  });

  it("刪除不存在的分類回傳普通刪除", () => {
    expect(parseMessage("刪除 不存在")).toEqual({ type: "delete" });
  });

  // 綁定
  it("解析「綁定 家長」", () => {
    expect(parseMessage("綁定 家長")).toEqual({ type: "bind", role: "parent" });
  });

  it("解析「綁定 孩子」", () => {
    expect(parseMessage("綁定 孩子")).toEqual({ type: "bind", role: "child" });
  });

  // 結算、確認、收到
  it("解析「結算」", () => {
    expect(parseMessage("結算")).toEqual({ type: "settle" });
  });

  it("解析「確認」", () => {
    expect(parseMessage("確認")).toEqual({ type: "confirm", targetName: undefined });
  });

  it("解析「確認 小明」", () => {
    expect(parseMessage("確認 小明")).toEqual({ type: "confirm", targetName: "小明" });
  });

  it("解析「收到」", () => {
    expect(parseMessage("收到")).toEqual({ type: "receive" });
  });

  // 修改/編輯
  it("解析「修改 80」", () => {
    expect(parseMessage("修改 80")).toEqual({ type: "edit", amount: 80 });
  });

  it("解析「編輯 150」", () => {
    expect(parseMessage("編輯 150")).toEqual({ type: "edit", amount: 150 });
  });

  it("解析「修改 #3 80」", () => {
    expect(parseMessage("修改 #3 80")).toEqual({ type: "edit", amount: 80, index: 3 });
  });

  it("解析「修改 午餐 80」", () => {
    expect(parseMessage("修改 午餐 80")).toEqual({ type: "edit", amount: 80, category: "午餐" });
  });

  it("解析「編輯 #1 200」", () => {
    expect(parseMessage("編輯 #1 200")).toEqual({ type: "edit", amount: 200, index: 1 });
  });

  it("解析「修改 飲料 50」", () => {
    expect(parseMessage("修改 飲料 50")).toEqual({ type: "edit", amount: 50, category: "飲料" });
  });

  it("修改金額超過上限回傳 unknown", () => {
    expect(parseMessage("修改 999999")).toEqual({ type: "unknown" });
  });

  // 統計
  it("解析「統計」", () => {
    expect(parseMessage("統計")).toEqual({ type: "stats" });
  });

  it("解析「統計 午餐」", () => {
    expect(parseMessage("統計 午餐")).toEqual({ type: "stats", category: "午餐" });
  });

  it("統計不存在的分類回傳無 category 的 stats", () => {
    expect(parseMessage("統計 不存在")).toEqual({ type: "stats" });
  });

  // Unknown
  it("無法辨識的文字回傳 unknown", () => {
    expect(parseMessage("你好")).toEqual({ type: "unknown" });
  });

  it("空白文字回傳 unknown", () => {
    expect(parseMessage("  ")).toEqual({ type: "unknown" });
  });
});
