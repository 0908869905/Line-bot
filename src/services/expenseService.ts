import prisma from "../lib/prisma";
import { Category } from "../types";

async function getOrCreateUser(lineUserId: string, displayName?: string) {
  return prisma.user.upsert({
    where: { lineUserId },
    update: { displayName },
    create: { lineUserId, displayName },
  });
}

export async function getOrCreateGroup(lineGroupId: string) {
  return prisma.group.upsert({
    where: { lineGroupId },
    update: {},
    create: { lineGroupId },
  });
}

export async function createExpense(
  lineUserId: string,
  amount: number,
  category: Category,
  note: string,
  displayName?: string,
  lineGroupId?: string
) {
  const user = await getOrCreateUser(lineUserId, displayName);

  let groupId: number | undefined;
  if (lineGroupId) {
    const group = await getOrCreateGroup(lineGroupId);
    groupId = group.id;
  }

  return prisma.expense.create({
    data: {
      amount,
      category,
      note,
      userId: user.id,
      groupId,
      confirmed: !lineGroupId, // 個人聊天自動確認，群組預設未確認
    },
  });
}

export async function queryExpenses(
  lineUserId: string,
  start: Date,
  end: Date
) {
  const user = await prisma.user.findUnique({ where: { lineUserId } });
  if (!user) return [];
  return prisma.expense.findMany({
    where: {
      userId: user.id,
      createdAt: { gte: start, lt: end },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function deleteLastExpense(lineUserId: string) {
  const user = await prisma.user.findUnique({ where: { lineUserId } });
  if (!user) return null;

  return prisma.$transaction(async (tx) => {
    const last = await tx.expense.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    if (!last) return null;
    await tx.expense.delete({ where: { id: last.id } });
    return last;
  });
}

export async function editLastExpense(lineUserId: string, newAmount: number) {
  const user = await prisma.user.findUnique({ where: { lineUserId } });
  if (!user) return null;

  return prisma.$transaction(async (tx) => {
    const last = await tx.expense.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    if (!last) return null;
    return tx.expense.update({
      where: { id: last.id },
      data: { amount: newAmount },
    });
  });
}

export async function deleteExpenseById(expenseId: number, lineUserId: string) {
  const user = await prisma.user.findUnique({ where: { lineUserId } });
  if (!user) return null;

  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, userId: user.id },
  });
  if (!expense) return null;

  await prisma.expense.delete({ where: { id: expenseId } });
  return expense;
}

export async function editExpenseById(
  expenseId: number,
  lineUserId: string,
  newAmount: number
) {
  const user = await prisma.user.findUnique({ where: { lineUserId } });
  if (!user) return null;

  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, userId: user.id },
  });
  if (!expense) return null;

  return prisma.expense.update({
    where: { id: expenseId },
    data: { amount: newAmount },
  });
}

export async function deleteLastExpenseByCategory(
  lineUserId: string,
  category: string
) {
  const user = await prisma.user.findUnique({ where: { lineUserId } });
  if (!user) return null;

  return prisma.$transaction(async (tx) => {
    const last = await tx.expense.findFirst({
      where: { userId: user.id, category },
      orderBy: { createdAt: "desc" },
    });
    if (!last) return null;
    await tx.expense.delete({ where: { id: last.id } });
    return last;
  });
}

export async function editLastExpenseByCategory(
  lineUserId: string,
  category: string,
  newAmount: number
) {
  const user = await prisma.user.findUnique({ where: { lineUserId } });
  if (!user) return null;

  return prisma.$transaction(async (tx) => {
    const last = await tx.expense.findFirst({
      where: { userId: user.id, category },
      orderBy: { createdAt: "desc" },
    });
    if (!last) return null;
    return tx.expense.update({
      where: { id: last.id },
      data: { amount: newAmount },
    });
  });
}

export async function getCategoryStats(
  lineUserId: string,
  start: Date,
  end: Date,
  category?: string
) {
  const user = await prisma.user.findUnique({ where: { lineUserId } });
  if (!user) return { byCategory: {}, total: 0, count: 0, expenses: [] };

  const where: {
    userId: number;
    createdAt: { gte: Date; lt: Date };
    category?: string;
  } = {
    userId: user.id,
    createdAt: { gte: start, lt: end },
  };

  if (category) {
    where.category = category;
  }

  const expenses = await prisma.expense.findMany({
    where,
    orderBy: { createdAt: "asc" },
  });

  const byCategory: Record<string, { amount: number; count: number }> = {};
  let total = 0;

  for (const e of expenses) {
    if (!byCategory[e.category]) {
      byCategory[e.category] = { amount: 0, count: 0 };
    }
    byCategory[e.category].amount += e.amount;
    byCategory[e.category].count += 1;
    total += e.amount;
  }

  return { byCategory, total, count: expenses.length, expenses };
}

export async function bindRole(
  lineUserId: string,
  lineGroupId: string,
  role: "parent" | "child",
  displayName?: string
) {
  const user = await getOrCreateUser(lineUserId, displayName);
  const group = await getOrCreateGroup(lineGroupId);

  return prisma.membership.upsert({
    where: { userId_groupId: { userId: user.id, groupId: group.id } },
    update: { role },
    create: { userId: user.id, groupId: group.id, role },
  });
}

export async function isParent(
  lineUserId: string,
  lineGroupId: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { lineUserId } });
  if (!user) return false;
  const group = await prisma.group.findUnique({
    where: { lineGroupId },
  });
  if (!group) return false;
  const membership = await prisma.membership.findUnique({
    where: { userId_groupId: { userId: user.id, groupId: group.id } },
  });
  return membership?.role === "parent";
}

export async function getUnconfirmedExpenses(lineGroupId: string) {
  const group = await prisma.group.findUnique({
    where: { lineGroupId },
  });
  if (!group) return [];

  return prisma.expense.findMany({
    where: {
      groupId: group.id,
      confirmed: false,
    },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function confirmExpenses(
  lineGroupId: string,
  targetDisplayName?: string
) {
  const group = await prisma.group.findUnique({
    where: { lineGroupId },
  });
  if (!group) return 0;

  const where: {
    groupId: number;
    confirmed: boolean;
    user?: { displayName: string };
  } = {
    groupId: group.id,
    confirmed: false,
  };

  if (targetDisplayName) {
    where.user = { displayName: targetDisplayName };
  }

  const result = await prisma.expense.updateMany({
    where,
    data: { confirmed: true, confirmedAt: new Date() },
  });

  return result.count;
}

export async function markReceived(lineUserId: string, lineGroupId: string) {
  const user = await prisma.user.findUnique({ where: { lineUserId } });
  if (!user) return 0;
  const group = await prisma.group.findUnique({ where: { lineGroupId } });
  if (!group) return 0;

  const result = await prisma.expense.updateMany({
    where: {
      userId: user.id,
      groupId: group.id,
      confirmed: true,
      received: false,
    },
    data: { received: true, receivedAt: new Date() },
  });

  return result.count;
}
