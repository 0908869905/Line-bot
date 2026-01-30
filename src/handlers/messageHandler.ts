import { WebhookEvent, MessageEvent, TextEventMessage } from "@line/bot-sdk";
import { messagingApi } from "@line/bot-sdk";
import { parseMessage } from "../utils/parser";
import { getTodayRange, getWeekRange, getMonthRange } from "../utils/date";
import {
  createExpense,
  queryExpenses,
  deleteLastExpense,
} from "../services/expenseService";
import {
  expenseCreatedReply,
  querySummaryReply,
  deleteReply,
  helpReply,
  PERIOD_LABELS,
} from "../services/replyService";

const PERIOD_RANGE_MAP = {
  today: getTodayRange,
  week: getWeekRange,
  month: getMonthRange,
};

export async function handleEvent(
  event: WebhookEvent,
  client: messagingApi.MessagingApiClient
): Promise<void> {
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
  const parsed = parseMessage(textMessage.text);

  let replyText: string;

  switch (parsed.type) {
    case "expense": {
      await createExpense(
        userId,
        parsed.amount,
        parsed.category,
        parsed.note
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
          items: [
            {
              type: "action",
              action: { type: "message", label: "今日", text: "今日" },
            },
            {
              type: "action",
              action: { type: "message", label: "本週", text: "本週" },
            },
            {
              type: "action",
              action: { type: "message", label: "本月", text: "本月" },
            },
            {
              type: "action",
              action: { type: "message", label: "刪除", text: "刪除" },
            },
            {
              type: "action",
              action: { type: "message", label: "說明", text: "說明" },
            },
          ],
        },
      },
    ],
  });
}
