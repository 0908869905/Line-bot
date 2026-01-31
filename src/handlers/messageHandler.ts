import { WebhookEvent, MessageEvent, TextEventMessage } from "@line/bot-sdk";
import { messagingApi } from "@line/bot-sdk";
import { parseMessage } from "../utils/parser";
import { getTodayRange, getWeekRange, getMonthRange } from "../utils/date";
import {
  createExpense,
  queryExpenses,
  deleteLastExpense,
  editLastExpense,
  deleteExpenseById,
  editExpenseById,
  deleteLastExpenseByCategory,
  editLastExpenseByCategory,
  getCategoryStats,
  bindRole,
  isParent,
  getUnconfirmedExpenses,
  confirmExpenses,
  markReceived,
} from "../services/expenseService";
import { setQueryCache, getFromCache } from "../services/queryCache";
import {
  expenseCreatedReply,
  querySummaryReply,
  deleteReply,
  editReply,
  statsReply,
  helpReply,
  PERIOD_LABELS,
  bindReply,
  settleReply,
  confirmReply,
  notParentReply,
  groupOnlyReply,
  receiveReply,
} from "../services/replyService";
import { buildQueryFlex } from "../services/flexService";

const PERIOD_RANGE_MAP = {
  today: getTodayRange,
  week: getWeekRange,
  month: getMonthRange,
};

type QuickReplyItem = messagingApi.QuickReplyItem;

function getQuickReplyItems(isGroup: boolean): QuickReplyItem[] {
  const items: QuickReplyItem[] = [
    { type: "action", action: { type: "message", label: "今日", text: "今日" } },
    { type: "action", action: { type: "message", label: "本週", text: "本週" } },
    { type: "action", action: { type: "message", label: "本月", text: "本月" } },
    { type: "action", action: { type: "message", label: "統計", text: "統計" } },
    { type: "action", action: { type: "message", label: "刪除", text: "刪除" } },
  ];

  if (isGroup) {
    items.push(
      { type: "action", action: { type: "message", label: "結算", text: "結算" } },
      { type: "action", action: { type: "message", label: "確認", text: "確認" } },
      { type: "action", action: { type: "message", label: "收到", text: "收到" } },
    );
  }

  items.push(
    { type: "action", action: { type: "message", label: "說明", text: "說明" } },
  );

  return items;
}

async function safeReply(
  client: messagingApi.MessagingApiClient,
  replyToken: string,
  messages: messagingApi.Message[]
): Promise<void> {
  try {
    await client.replyMessage({ replyToken, messages });
  } catch (err) {
    console.error("replyMessage failed:", err);
  }
}

async function getDisplayName(
  client: messagingApi.MessagingApiClient,
  userId: string,
  groupId?: string
): Promise<string | undefined> {
  try {
    if (groupId) {
      const profile = await client.getGroupMemberProfile(groupId, userId);
      return profile.displayName;
    }
    const profile = await client.getProfile(userId);
    return profile.displayName;
  } catch {
    return undefined;
  }
}

export async function handleEvent(
  event: WebhookEvent,
  client: messagingApi.MessagingApiClient
): Promise<void> {
  // join 事件：Bot 被加入群組
  if (event.type === "join") {
    await safeReply(client, event.replyToken, [
      {
        type: "text",
        text: [
          "大家好！我是記帳小幫手",
          "",
          "請先設定角色：",
          "  輸入「綁定 家長」或「綁定 孩子」",
          "",
          "設定完成後即可開始記帳！",
          "輸入「說明」查看完整功能",
        ].join("\n"),
      },
    ]);
    return;
  }

  // follow 事件：歡迎訊息
  if (event.type === "follow") {
    await safeReply(client, event.replyToken, [
      {
        type: "text",
        text: `歡迎使用記帳小幫手！\n\n${helpReply()}`,
      },
    ]);
    return;
  }

  if (event.type !== "message" || event.message.type !== "text") {
    return;
  }

  const msg = event as MessageEvent;
  const textMessage = msg.message as TextEventMessage;
  const userId = msg.source.userId;
  if (!userId) return;

  const replyToken = msg.replyToken;
  const isGroup =
    msg.source.type === "group" || msg.source.type === "room";
  const groupId =
    msg.source.type === "group"
      ? msg.source.groupId
      : msg.source.type === "room"
        ? msg.source.roomId
        : undefined;

  const parsed = parseMessage(textMessage.text);
  const replyMessages: messagingApi.Message[] = [];

  switch (parsed.type) {
    case "expense": {
      const displayName = await getDisplayName(client, userId, groupId);
      await createExpense(
        userId,
        parsed.amount,
        parsed.category,
        parsed.note,
        displayName,
        groupId
      );
      replyMessages.push({
        type: "text",
        text: expenseCreatedReply(parsed.amount, parsed.category, parsed.note),
      });
      break;
    }
    case "query": {
      const { start, end } = PERIOD_RANGE_MAP[parsed.period]();
      const expenses = await queryExpenses(userId, start, end);
      setQueryCache(userId, expenses);
      const flexMsg = buildQueryFlex(PERIOD_LABELS[parsed.period], expenses);
      if (flexMsg) {
        replyMessages.push(flexMsg);
      } else {
        replyMessages.push({
          type: "text",
          text: querySummaryReply(PERIOD_LABELS[parsed.period], expenses),
        });
      }
      break;
    }
    case "delete": {
      if (parsed.index) {
        const cached = getFromCache(userId, parsed.index);
        if (!cached) {
          replyMessages.push({
            type: "text",
            text: "查無此筆紀錄，請先查詢（今日/本週/本月）再用 #編號 操作",
          });
          break;
        }
        const deleted = await deleteExpenseById(cached.id, userId);
        replyMessages.push({
          type: "text",
          text: deleteReply(deleted, `#${parsed.index}`),
        });
      } else if (parsed.category) {
        const deleted = await deleteLastExpenseByCategory(userId, parsed.category);
        replyMessages.push({
          type: "text",
          text: deleteReply(deleted, `最近一筆${parsed.category}`),
        });
      } else {
        const deleted = await deleteLastExpense(userId);
        replyMessages.push({ type: "text", text: deleteReply(deleted) });
      }
      break;
    }
    case "edit": {
      if (parsed.index) {
        const cached = getFromCache(userId, parsed.index);
        if (!cached) {
          replyMessages.push({
            type: "text",
            text: "查無此筆紀錄，請先查詢（今日/本週/本月）再用 #編號 操作",
          });
          break;
        }
        const updated = await editExpenseById(cached.id, userId, parsed.amount);
        replyMessages.push({
          type: "text",
          text: editReply(cached, updated ? parsed.amount : 0, `#${parsed.index}`),
        });
      } else if (parsed.category) {
        const oldExpenses = await queryExpenses(userId, new Date(0), new Date());
        const catExpense = [...oldExpenses].reverse().find((e) => e.category === parsed.category);
        const updated = await editLastExpenseByCategory(userId, parsed.category, parsed.amount);
        replyMessages.push({
          type: "text",
          text: editReply(
            catExpense || null,
            updated ? parsed.amount : 0,
            `最近一筆${parsed.category}`
          ),
        });
      } else {
        const oldExpenses = await queryExpenses(userId, new Date(0), new Date());
        const lastExpense = oldExpenses.length > 0 ? oldExpenses[oldExpenses.length - 1] : null;
        const updated = await editLastExpense(userId, parsed.amount);
        replyMessages.push({
          type: "text",
          text: editReply(lastExpense, updated ? parsed.amount : 0),
        });
      }
      break;
    }
    case "stats": {
      const { start, end } = getMonthRange();
      const { byCategory, total, count } = await getCategoryStats(
        userId,
        start,
        end,
        parsed.category
      );
      replyMessages.push({
        type: "text",
        text: statsReply(byCategory, total, count, parsed.category),
      });
      break;
    }
    case "bind": {
      if (!isGroup || !groupId) {
        replyMessages.push({ type: "text", text: groupOnlyReply() });
        break;
      }
      const displayName = await getDisplayName(client, userId, groupId);
      await bindRole(userId, groupId, parsed.role, displayName);
      replyMessages.push({
        type: "text",
        text: bindReply(parsed.role, displayName || "你"),
      });
      break;
    }
    case "settle": {
      if (!isGroup || !groupId) {
        replyMessages.push({ type: "text", text: groupOnlyReply() });
        break;
      }
      const expenses = await getUnconfirmedExpenses(groupId);
      replyMessages.push({ type: "text", text: settleReply(expenses) });
      break;
    }
    case "confirm": {
      if (!isGroup || !groupId) {
        replyMessages.push({ type: "text", text: groupOnlyReply() });
        break;
      }
      const parentCheck = await isParent(userId, groupId);
      if (!parentCheck) {
        replyMessages.push({ type: "text", text: notParentReply() });
        break;
      }
      const count = await confirmExpenses(groupId, parsed.targetName);
      replyMessages.push({
        type: "text",
        text: confirmReply(count, parsed.targetName),
      });
      break;
    }
    case "receive": {
      if (!isGroup || !groupId) {
        replyMessages.push({ type: "text", text: groupOnlyReply() });
        break;
      }
      const count = await markReceived(userId, groupId);
      replyMessages.push({ type: "text", text: receiveReply(count) });
      break;
    }
    default: {
      replyMessages.push({ type: "text", text: helpReply() });
    }
  }

  // 為最後一則文字訊息加上 quickReply
  const lastTextIdx = replyMessages.map((m) => m.type).lastIndexOf("text");
  if (lastTextIdx >= 0) {
    const lastMsg = replyMessages[lastTextIdx] as messagingApi.TextMessage;
    lastMsg.quickReply = { items: getQuickReplyItems(isGroup) };
  }

  await safeReply(client, replyToken, replyMessages);
}
