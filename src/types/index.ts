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

export type ParsedBind = {
  type: "bind";
  role: "parent" | "child";
};

export type ParsedSettle = {
  type: "settle";
};

export type ParsedConfirm = {
  type: "confirm";
  targetName?: string;
};

export type ParsedUnknown = {
  type: "unknown";
};

export type ParseResult =
  | ParsedExpense
  | ParsedQuery
  | ParsedDelete
  | ParsedBind
  | ParsedSettle
  | ParsedConfirm
  | ParsedUnknown;
