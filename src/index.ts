import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { middleware, MiddlewareConfig, WebhookEvent } from "@line/bot-sdk";
import { messagingApi } from "@line/bot-sdk";
import { handleEvent } from "./handlers/messageHandler";

const PORT = process.env.PORT || 3000;

const middlewareConfig: MiddlewareConfig = {
  channelSecret: process.env.LINE_CHANNEL_SECRET!,
};

const client = new messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
});

const app = express();

// LINE Webhook
app.post("/webhook", middleware(middlewareConfig), async (req, res) => {
  const events: WebhookEvent[] = (req.body as { events: WebhookEvent[] }).events;

  await Promise.all(events.map((event) => handleEvent(event, client)));

  res.json({ status: "ok" });
});

// Health check
app.get("/", (_req, res) => {
  res.send("LINE Expense Bot is running");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
