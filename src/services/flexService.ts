import { messagingApi } from "@line/bot-sdk";
import { Expense } from "@prisma/client";
import { formatDate } from "../utils/date";

type FlexMessage = messagingApi.FlexMessage;
type FlexBubble = messagingApi.FlexBubble;

export function buildQueryFlex(
  periodLabel: string,
  expenses: Expense[]
): FlexMessage | null {
  if (expenses.length === 0) return null;

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  const byCategory: Record<string, number> = {};
  for (const e of expenses) {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
  }

  const categoryRows: messagingApi.FlexComponent[] = Object.entries(byCategory).map(
    ([cat, amt]) => ({
      type: "box" as const,
      layout: "horizontal" as const,
      contents: [
        {
          type: "text" as const,
          text: cat,
          size: "sm" as const,
          color: "#555555",
          flex: 0,
        },
        {
          type: "text" as const,
          text: `$${amt}`,
          size: "sm" as const,
          color: "#111111",
          align: "end" as const,
        },
      ],
    })
  );

  const detailRows: messagingApi.FlexComponent[] = expenses.slice(0, 10).map((e, i) => {
    const notePart = e.note ? ` ${e.note}` : "";
    return {
      type: "box" as const,
      layout: "horizontal" as const,
      contents: [
        {
          type: "text" as const,
          text: `#${i + 1} ${formatDate(e.createdAt)} ${e.category}${notePart}`,
          size: "xs" as const,
          color: "#aaaaaa",
          flex: 4,
        },
        {
          type: "text" as const,
          text: `$${e.amount}`,
          size: "xs" as const,
          color: "#aaaaaa",
          align: "end" as const,
          flex: 1,
        },
      ],
    };
  });

  if (expenses.length > 10) {
    detailRows.push({
      type: "text" as const,
      text: `...還有 ${expenses.length - 10} 筆`,
      size: "xs" as const,
      color: "#aaaaaa",
    });
  }

  const bubble: FlexBubble = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: `${periodLabel}花費統計`,
          weight: "bold",
          size: "lg",
          color: "#1DB446",
        },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: `$${total}`,
          weight: "bold",
          size: "xxl",
          margin: "md",
        },
        {
          type: "text",
          text: `共 ${expenses.length} 筆`,
          size: "xs",
          color: "#aaaaaa",
          margin: "sm",
        },
        {
          type: "separator",
          margin: "lg",
        },
        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          spacing: "sm",
          contents: categoryRows,
        },
        {
          type: "separator",
          margin: "lg",
        },
        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          spacing: "sm",
          contents: detailRows,
        },
      ],
    },
  };

  return {
    type: "flex",
    altText: `${periodLabel}花費 $${total}（${expenses.length} 筆）`,
    contents: bubble,
  };
}
