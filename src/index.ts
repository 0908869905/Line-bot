import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import rateLimit from "express-rate-limit";
import { middleware, MiddlewareConfig, WebhookEvent } from "@line/bot-sdk";
import { messagingApi } from "@line/bot-sdk";
import { handleEvent } from "./handlers/messageHandler";
import prisma from "./lib/prisma";

const PORT = process.env.PORT || 3000;
const startTime = Date.now();

const middlewareConfig: MiddlewareConfig = {
  channelSecret: process.env.LINE_CHANNEL_SECRET!,
};

const client = new messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
});

const app = express();

// Rate limiting for webhook
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: "rate_limited" },
});

// LINE Webhook
app.post("/webhook", webhookLimiter, middleware(middlewareConfig), async (req, res) => {
  const events: WebhookEvent[] = (req.body as { events: WebhookEvent[] }).events;

  const results = await Promise.allSettled(
    events.map((event) => handleEvent(event, client))
  );

  for (const result of results) {
    if (result.status === "rejected") {
      console.error("Event handling failed:", result.reason);
    }
  }

  res.json({ status: "ok" });
});

// Health check (basic)
app.get("/", (_req, res) => {
  res.send("LINE Expense Bot is running");
});

// Health check (detailed)
app.get("/health", async (_req, res) => {
  let dbStatus = "ok";
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
  } catch {
    dbStatus = "error";
  }

  const uptimeMs = Date.now() - startTime;
  const uptimeSec = Math.floor(uptimeMs / 1000);

  res.json({
    status: dbStatus === "ok" ? "healthy" : "degraded",
    uptime: `${uptimeSec}s`,
    database: dbStatus,
    timestamp: new Date().toISOString(),
  });
});

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
function shutdown() {
  console.log("Shutting down gracefully...");
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
