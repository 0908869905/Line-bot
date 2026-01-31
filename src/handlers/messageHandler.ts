import { WebhookEvent, MessageEvent, TextEventMessage, PostbackEvent } from "@line/bot-sdk";
import { messagingApi } from "@line/bot-sdk";
import { parseMessage } from "../utils/parser";
import { CATEGORIES } from "../types";
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
  confirmExpensesByUser,
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
  confirmReply,
  notParentReply,
  groupOnlyReply,
  receiveReply,
} from "../services/replyService";
import { buildQueryFlex, buildExpenseCreatedFlex, buildSettleFlex } from "../services/flexService";

const PERIOD_RANGE_MAP = {
  today: getTodayRange,
  week: getWeekRange,
  month: getMonthRange,
};

type QuickReplyItem = messagingApi.QuickReplyItem;

function getQuickReplyItems(isGroup: boolean): QuickReplyItem[] {
  const items: QuickReplyItem[] = [
    { type: "action", action: { type: "postback", label: "今日", data: "action=query&period=today", displayText: "今日" } },
    { type: "action", action: { type: "postback", label: "本週", data: "action=query&period=week", displayText: "本週" } },
    { type: "action", action: { type: "postback", label: "本月", data: "action=query&period=month", displayText: "本月" } },
    { type: "action", action: { type: "postback", label: "統計", data: "action=stats", displayText: "統計" } },
    { type: "action", action: { type: "message", label: "刪除", text: "刪除" } },
  ];

  if (isGroup) {
    items.push(
      { type: "action", action: { type: "postback", label: "結算", data: "action=settle", displayText: "結算" } },
      { type: "action", action: { type: "message", label: "確認", text: "確認" } },
      { type: "action", action: { type: "message", label: "收到", text: "收到" } },
    );
  }

  items.push(
    { type: "action", action: { type: "postback", label: "說明", data: "action=help", displayText: "說明" } },
  );

  return items;
}

function attachQuickReply(messages: messagingApi.Message[], isGroup: boolean) {
  const lastTextIdx = messages.map((m) => m.type).lastIndexOf("text");
  if (lastTextIdx >= 0) {
    const lastMsg = messages[lastTextIdx] as messagingApi.TextMessage;
    lastMsg.quickReply = { items: getQuickReplyItems(isGroup) };
  }
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

function getSourceInfo(event: { source: WebhookEvent["source"] }) {
  const userId = event.source?.userId;
  const isGroup = event.source?.type === "group" || event.source?.type === "room";
  const groupId =
    event.source?.type === "group"
      ? event.source.groupId
      : event.source?.type === "room"
        ? event.source.roomId
        : undefined;
  return { userId, isGroup, groupId };
}

// ─── Postback Event Handler ───

async function handlePostback(
  event: PostbackEvent,
  client: messagingApi.MessagingApiClient
): Promise<void> {
  const replyToken = event.replyToken;
  if (!replyToken) return;

  const { userId, isGroup, groupId } = getSourceInfo(event);
  if (!userId) return;

  const params = new URLSearchParams(event.postback.data);
  const action = params.get("action");
  const replyMessages: messagingApi.Message[] = [];

  try {
    switch (action) {
      case "query": {
        const period = params.get("period") as "today" | "week" | "month";
        if (!period || !PERIOD_RANGE_MAP[period]) break;
        const { start, end } = PERIOD_RANGE_MAP[period]();
        const expenses = await queryExpenses(userId, start, end);
        setQueryCache(userId, expenses);
        const flexMsg = buildQueryFlex(PERIOD_LABELS[period], expenses);
        if (flexMsg) {
          replyMessages.push(flexMsg);
        } else {
          replyMessages.push({
            type: "text",
            text: querySummaryReply(PERIOD_LABELS[period], expenses),
          });
        }
        break;
      }
      case "stats": {
        const { start, end } = getMonthRange();
        const { byCategory, total, count } = await getCategoryStats(userId, start, end);
        replyMessages.push({
          type: "text",
          text: statsReply(byCategory, total, count),
        });
        break;
      }
      case "help": {
        replyMessages.push({ type: "text", text: helpReply() });
        break;
      }
      case "settle": {
        if (!isGroup || !groupId) {
          replyMessages.push({ type: "text", text: groupOnlyReply() });
          break;
        }
        const expenses = await getUnconfirmedExpenses(groupId);
        const flexMsg = buildSettleFlex(expenses, groupId);
        if (flexMsg) {
          replyMessages.push(flexMsg);
        } else {
          replyMessages.push({ type: "text", text: "目前沒有未確認的支出" });
        }
        break;
      }
      case "select_category": {
        const amount = parseInt(params.get("amount") || "0", 10);
        const category = params.get("category") || "其他";
        if (amount < 1 || amount > 100000) break;
        const displayName = await getDisplayName(client, userId, groupId);
        const expense = await createExpense(userId, amount, category as any, "", displayName, groupId);
        replyMessages.push(buildExpenseCreatedFlex(expense));
        break;
      }
      case "undo":
      case "delete": {
        const id = parseInt(params.get("id") || "0", 10);
        if (!id) break;
        const deleted = await deleteExpenseById(id, userId);
        replyMessages.push({
          type: "text",
          text: deleted
            ? `已${action === "undo" ? "撤銷" : "刪除"}：${deleted.category} $${deleted.amount}`
            : "此筆紀錄已不存在",
        });
        break;
      }
      case "edit_confirm": {
        const id = parseInt(params.get("id") || "0", 10);
        const newAmount = parseInt(params.get("amount") || "0", 10);
        if (!id || !newAmount) break;
        const updated = await editExpenseById(id, userId, newAmount);
        replyMessages.push({
          type: "text",
          text: updated ? `已修改為 $${newAmount}` : "此筆紀錄已不存在",
        });
        break;
      }
      case "confirm_user": {
        if (!isGroup || !groupId) break;
        const parentCheck = await isParent(userId, groupId);
        if (!parentCheck) {
          replyMessages.push({ type: "text", text: notParentReply() });
          break;
        }
        const targetUserId = params.get("userId") || "";
        const cnt = await confirmExpensesByUser(targetUserId, groupId);
        replyMessages.push({
          type: "text",
          text: cnt > 0
            ? `已確認 ${cnt} 筆支出\n孩子請輸入「收到」確認收款`
            : "沒有需要確認的支出",
        });
        break;
      }
      case "confirm_all": {
        if (!isGroup || !groupId) break;
        const parentCheck = await isParent(userId, groupId);
        if (!parentCheck) {
          replyMessages.push({ type: "text", text: notParentReply() });
          break;
        }
        const cnt = await confirmExpenses(groupId);
        replyMessages.push({ type: "text", text: confirmReply(cnt) });
        break;
      }
      default:
        return;
    }
  } catch (err) {
    console.error("handlePostback error:", action, err);
    replyMessages.length = 0;
    replyMessages.push({
      type: "text",
      text: `處理失敗，請稍後再試\n(${err instanceof Error ? err.message : String(err)})`,
    });
  }

  if (replyMessages.length === 0) return;
  attachQuickReply(replyMessages, isGroup);
  await safeReply(client, replyToken, replyMessages);
}

// ─── Main Event Handler ───

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

  // postback 事件
  if (event.type === "postback") {
    await handlePostback(event, client);
    return;
  }

  if (event.type !== "message" || event.message.type !== "text") {
    return;
  }

  const msg = event as MessageEvent;
  const textMessage = msg.message as TextEventMessage;
  const { userId, isGroup, groupId } = getSourceInfo(msg);
  if (!userId) return;

  const replyToken = msg.replyToken;
  const parsed = parseMessage(textMessage.text);
  const replyMessages: messagingApi.Message[] = [];

  switch (parsed.type) {
    case "expense": {
      const displayName = await getDisplayName(client, userId, groupId);
      const expense = await createExpense(
        userId,
        parsed.amount,
        parsed.category,
        parsed.note,
        displayName,
        groupId
      );
      replyMessages.push(buildExpenseCreatedFlex(expense));
      break;
    }
    case "amount_only": {
      const categoryButtons: QuickReplyItem[] = CATEGORIES.map((cat) => ({
        type: "action" as const,
        action: {
          type: "postback" as const,
          label: cat,
          data: `action=select_category&amount=${parsed.amount}&category=${encodeURIComponent(cat)}`,
          displayText: `${parsed.amount} ${cat}`,
        },
      }));
      replyMessages.push({
        type: "text",
        text: `金額 $${parsed.amount}，請選擇分類：`,
        quickReply: { items: categoryButtons },
      });
      await safeReply(client, replyToken, replyMessages);
      return; // 提前 return，使用自訂 quickReply
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
      const flexMsg = buildSettleFlex(expenses, groupId);
      if (flexMsg) {
        replyMessages.push(flexMsg);
      } else {
        replyMessages.push({ type: "text", text: "目前沒有未確認的支出" });
      }
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

  attachQuickReply(replyMessages, isGroup);
  await safeReply(client, replyToken, replyMessages);
}
