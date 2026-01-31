import { describe, it, expect } from "vitest";
import {
  getTodayRange,
  getWeekRange,
  getMonthRange,
  formatDate,
  nowInTaipei,
} from "../date";

describe("nowInTaipei", () => {
  it("回傳有效的 Date 物件", () => {
    const now = nowInTaipei();
    expect(now).toBeInstanceOf(Date);
    expect(now.getTime()).not.toBeNaN();
  });

  it("年份合理", () => {
    const now = nowInTaipei();
    expect(now.getFullYear()).toBeGreaterThanOrEqual(2025);
  });
});

describe("getTodayRange", () => {
  it("start 為今天 00:00，end 為明天 00:00", () => {
    const { start, end } = getTodayRange();
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);

    const diff = end.getTime() - start.getTime();
    expect(diff).toBe(24 * 60 * 60 * 1000);
  });
});

describe("getWeekRange", () => {
  it("start 為週一，end 為明天 00:00", () => {
    const { start, end } = getWeekRange();
    const dayOfWeek = start.getDay();
    expect(dayOfWeek).toBe(1);
    expect(start.getHours()).toBe(0);

    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });
});

describe("getMonthRange", () => {
  it("start 為本月 1 號，end 為明天 00:00", () => {
    const { start, end } = getMonthRange();
    expect(start.getDate()).toBe(1);
    expect(start.getHours()).toBe(0);

    expect(end.getHours()).toBe(0);
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });
});

describe("formatDate", () => {
  it("格式化為 M/D", () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe("1/5");
    expect(formatDate(new Date(2026, 11, 25))).toBe("12/25");
  });
});
