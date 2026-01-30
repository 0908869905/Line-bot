# Line報帳

## 專案概述
- **類型**：LINE Messaging API 報帳機器人
- **技術棧**：TypeScript + Express 5 + Prisma 7 + SQLite + @line/bot-sdk v10
- **部署**：Render (https://line-bot-4hdz.onrender.com)
- **Node 環境**：ES2020 target, CommonJS module

## 目錄結構
```
Line報帳/
├── src/
│   ├── index.ts              # Express 伺服器入口，Webhook 路由
│   ├── handlers/
│   │   └── messageHandler.ts # LINE 訊息事件分派
│   ├── services/
│   │   ├── expenseService.ts # 記帳 CRUD（Prisma 操作）
│   │   └── replyService.ts   # LINE 回覆訊息格式化
│   ├── utils/
│   │   ├── parser.ts         # 使用者輸入解析（記帳/查詢/刪除）
│   │   └── date.ts           # 日期區間計算工具
│   ├── types/
│   │   └── index.ts          # 型別定義（Category, ParseResult）
│   └── lib/
│       └── prisma.ts         # Prisma Client 初始化
├── prisma/
│   ├── schema.prisma         # 資料模型（User, Expense）
│   └── migrations/           # 資料庫 migration 紀錄
├── dist/                     # TypeScript 編譯輸出
├── package.json
├── tsconfig.json
├── .env.example
└── .gitignore
```

## 資料模型
- **User**：lineUserId (unique), displayName；關聯 Expense[], Membership[]
- **Group**：lineGroupId (unique)；關聯 Membership[], Expense[]
- **Membership**：userId + groupId (unique), role ("parent"/"child")
- **Expense**：amount, category, note, confirmed, confirmedAt?, groupId?, createdAt；關聯 User, Group?；索引 (userId, createdAt)
- 預設分類：早餐、午餐、晚餐、飲料、點心、交通、其他

## 常用指令
```bash
# 開發（即時重載）
npm run dev

# 建置（prisma generate + db push + tsc）
npm run build

# 啟動
npm run start
```

## 環境變數（.env）
- `LINE_CHANNEL_SECRET` - LINE Bot 頻道密鑰
- `LINE_CHANNEL_ACCESS_TOKEN` - LINE Bot 存取令牌
- `PORT` - 伺服器端口（預設 3000）
- `DATABASE_URL` - SQLite 資料庫路徑（預設 file:./dev.db）

## 開發規範
- LINE middleware 必須在 Express JSON parser 之前執行（SDK 自行解析 body）
- replyToken 有時效性，需盡快回覆
- Prisma schema 修改後執行 `npx prisma db push`（使用 driver adapter 模式，不使用 migrate）
- 部署前必須 `npm run build` 確認編譯通過

## 群組功能
- 綁定角色：群組內輸入「綁定 家長/孩子」設定角色
- 群組記帳：群組內記帳預設 confirmed=false，個人聊天 confirmed=true
- 結算：查看群組內所有未確認支出（按人分組）
- 確認：家長角色才能確認，支援「確認」（全部）或「確認 小明」（指定人）
- Bot 加入群組時自動發送歡迎訊息引導綁定角色

## 注意事項
- Webhook URL: https://line-bot-4hdz.onrender.com/webhook
- Render 免費方案會自動休眠，首次請求可能延遲
- SQLite 資料庫檔案在 Render 重新部署時會重置（未來可遷移 PostgreSQL）
