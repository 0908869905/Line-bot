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
  index?: number;
  category?: Category;
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

export type ParsedReceive = {
  type: "receive";
};

export type ParsedEdit = {
  type: "edit";
  amount: number;
  index?: number;
  category?: Category;
};

export type ParsedStats = {
  type: "stats";
  category?: Category;
};

export type ParsedAmountOnly = {
  type: "amount_only";
  amount: number;
};

export type ParsedUnknown = {
  type: "unknown";
};

export type ParseResult =
  | ParsedExpense
  | ParsedAmountOnly
  | ParsedQuery
  | ParsedDelete
  | ParsedBind
  | ParsedSettle
  | ParsedConfirm
  | ParsedReceive
  | ParsedEdit
  | ParsedStats
  | ParsedUnknown;
