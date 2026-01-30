import { WebhookEvent, MessageEvent, TextEventMessage } from "@line/bot-sdk";
import { messagingApi } from "@line/bot-sdk";
import { parseMessage } from "../utils/parser";
import { getTodayRange, getWeekRange, getMonthRange } from "../utils/date";
import {
  createExpense,
  queryExpenses,
  deleteLastExpense,
  bindRole,
  isParent,
  getUnconfirmedExpenses,
  confirmExpenses,
  markReceived,
} from "../services/expenseService";
import {
  expenseCreatedReply,
  querySummaryReply,
  deleteReply,
  helpReply,
  PERIOD_LABELS,
  bindReply,
  settleReply,
  confirmReply,
  notParentReply,
  groupOnlyReply,
  receiveReply,
} from "../services/replyService";

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
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [
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
      ],
    });
    return;
  }

  // follow 事件：歡迎訊息
  if (event.type === "follow") {
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [
        {
          type: "text",
          text: `歡迎使用記帳小幫手！\n\n${helpReply()}`,
        },
      ],
    });
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
  let replyText: string;

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
      replyText = expenseCreatedReply(
        parsed.amount,
        parsed.category,
        parsed.note
      );
      break;
    }
    case "query": {
      const { start, end } = PERIOD_RANGE_MAP[parsed.period]();
      const expenses = await queryExpenses(userId, start, end);
      replyText = querySummaryReply(PERIOD_LABELS[parsed.period], expenses);
      break;
    }
    case "delete": {
      const deleted = await deleteLastExpense(userId);
      replyText = deleteReply(deleted);
      break;
    }
    case "bind": {
      if (!isGroup || !groupId) {
        replyText = groupOnlyReply();
        break;
      }
      const displayName = await getDisplayName(client, userId, groupId);
      await bindRole(userId, groupId, parsed.role, displayName);
      replyText = bindReply(parsed.role, displayName || "你");
      break;
    }
    case "settle": {
      if (!isGroup || !groupId) {
        replyText = groupOnlyReply();
        break;
      }
      const expenses = await getUnconfirmedExpenses(groupId);
      replyText = settleReply(expenses);
      break;
    }
    case "confirm": {
      if (!isGroup || !groupId) {
        replyText = groupOnlyReply();
        break;
      }
      const parentCheck = await isParent(userId, groupId);
      if (!parentCheck) {
        replyText = notParentReply();
        break;
      }
      const count = await confirmExpenses(groupId, parsed.targetName);
      replyText = confirmReply(count, parsed.targetName);
      break;
    }
    case "receive": {
      if (!isGroup || !groupId) {
        replyText = groupOnlyReply();
        break;
      }
      const count = await markReceived(userId, groupId);
      replyText = receiveReply(count);
      break;
    }
    default: {
      replyText = helpReply();
    }
  }

  await client.replyMessage({
    replyToken,
    messages: [
      {
        type: "text",
        text: replyText,
        quickReply: {
          items: getQuickReplyItems(isGroup),
        },
      },
    ],
  });
}
