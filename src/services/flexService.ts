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

  const detailRows: messagingApi.FlexComponent[] = expenses.slice(0, 10).map((e) => {
    const notePart = e.note ? ` ${e.note}` : "";
    return {
      type: "box" as const,
      layout: "horizontal" as const,
      contents: [
        {
          type: "text" as const,
          text: `${formatDate(e.createdAt)} ${e.category}${notePart}`,
          size: "xs" as const,
          color: "#aaaaaa",
          flex: 5,
          gravity: "center" as const,
        },
        {
          type: "text" as const,
          text: `$${e.amount}`,
          size: "xs" as const,
          color: "#111111",
          align: "end" as const,
          flex: 2,
          gravity: "center" as const,
        },
        {
          type: "button" as const,
          action: {
            type: "postback" as const,
            label: "✕",
            data: `action=delete&id=${e.id}`,
            displayText: `刪除 ${e.category} $${e.amount}`,
          },
          style: "link" as const,
          color: "#FF6B6B",
          height: "sm" as const,
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

export function buildExpenseCreatedFlex(
  expense: { id: number; amount: number; category: string; note: string }
): FlexMessage {
  const bubble: FlexBubble = {
    type: "bubble",
    size: "kilo",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "✓ 記帳成功",
          weight: "bold",
          color: "#1DB446",
          size: "md",
        },
        {
          type: "box",
          layout: "horizontal",
          margin: "lg",
          contents: [
            { type: "text", text: expense.category, size: "sm", color: "#555555", flex: 0 },
            { type: "text", text: `$${expense.amount}`, size: "xl", weight: "bold", align: "end" },
          ],
        },
        ...(expense.note
          ? [
              {
                type: "text" as const,
                text: expense.note,
                size: "xs" as const,
                color: "#aaaaaa",
                margin: "sm" as const,
              },
            ]
          : []),
      ],
    },
    footer: {
      type: "box",
      layout: "horizontal",
      contents: [
        {
          type: "button",
          action: {
            type: "postback",
            label: "撤銷",
            data: `action=undo&id=${expense.id}`,
            displayText: "撤銷記帳",
          },
          style: "link",
          color: "#FF6B6B",
          height: "sm",
        },
      ],
    },
  };

  return {
    type: "flex",
    altText: `記帳成功：${expense.category} $${expense.amount}`,
    contents: bubble,
  };
}

export function buildSettleFlex(
  expenses: (Expense & { user: { displayName: string | null; lineUserId: string } })[],
  lineGroupId: string
): FlexMessage | null {
  if (expenses.length === 0) return null;

  const byUser: Record<
    string,
    { name: string; lineUserId: string; items: typeof expenses; total: number }
  > = {};

  for (const e of expenses) {
    const key = e.userId.toString();
    if (!byUser[key]) {
      byUser[key] = {
        name: e.user.displayName || "未知",
        lineUserId: e.user.lineUserId,
        items: [],
        total: 0,
      };
    }
    byUser[key].items.push(e);
    byUser[key].total += e.amount;
  }

  const grandTotal = expenses.reduce((sum, e) => sum + e.amount, 0);

  const sections: messagingApi.FlexComponent[] = [];

  for (const { name, lineUserId, items, total } of Object.values(byUser)) {
    sections.push(
      { type: "separator", margin: "lg" },
      {
        type: "box",
        layout: "horizontal",
        margin: "lg",
        contents: [
          { type: "text", text: name, weight: "bold", size: "sm", flex: 3, gravity: "center" },
          { type: "text", text: `$${total}`, size: "sm", align: "end", flex: 2, gravity: "center" },
          {
            type: "button",
            action: {
              type: "postback",
              label: "確認",
              data: `action=confirm_user&userId=${lineUserId}&groupId=${lineGroupId}`,
              displayText: `確認 ${name}`,
            },
            style: "link",
            color: "#1DB446",
            height: "sm",
            flex: 1,
          },
        ],
      }
    );

    for (const e of items.slice(0, 5)) {
      const notePart = e.note ? ` ${e.note}` : "";
      sections.push({
        type: "box",
        layout: "horizontal",
        margin: "sm",
        paddingStart: "md",
        contents: [
          {
            type: "text",
            text: `${formatDate(e.createdAt)} ${e.category}${notePart}`,
            size: "xs",
            color: "#aaaaaa",
            flex: 4,
          },
          {
            type: "text",
            text: `$${e.amount}`,
            size: "xs",
            color: "#aaaaaa",
            align: "end",
            flex: 1,
          },
        ],
      });
    }
    if (items.length > 5) {
      sections.push({
        type: "text",
        text: `  ...還有 ${items.length - 5} 筆`,
        size: "xs",
        color: "#aaaaaa",
        margin: "sm",
      });
    }
  }

  const bubble: FlexBubble = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: "未確認支出結算", weight: "bold", size: "lg", color: "#1DB446" },
        {
          type: "text",
          text: `共 ${expenses.length} 筆，合計 $${grandTotal}`,
          size: "xs",
          color: "#aaaaaa",
          margin: "sm",
        },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: sections,
    },
    footer: {
      type: "box",
      layout: "horizontal",
      contents: [
        {
          type: "button",
          action: {
            type: "postback",
            label: "全部確認",
            data: `action=confirm_all&groupId=${lineGroupId}`,
            displayText: "確認全部",
          },
          style: "primary",
          color: "#1DB446",
        },
      ],
    },
  };

  return {
    type: "flex",
    altText: `未確認支出 $${grandTotal}（${expenses.length} 筆）`,
    contents: bubble,
  };
}
