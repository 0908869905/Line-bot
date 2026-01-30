export const CATEGORIES = [
  "早餐",
  "午餐",
  "晚餐",
  "飲料",
  "點心",
  "交通",
  "其他",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type ParsedExpense = {
  type: "expense";
  amount: number;
  category: Category;
  note: string;
};

export type ParsedQuery = {
  type: "query";
  period: "today" | "week" | "month";
};

export type ParsedDelete = {
  type: "delete";
};

export type ParsedUnknown = {
  type: "unknown";
};

export type ParseResult =
  | ParsedExpense
  | ParsedQuery
  | ParsedDelete
  | ParsedUnknown;
