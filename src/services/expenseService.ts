import prisma from "../lib/prisma";
import { Category } from "../types";

async function getOrCreateUser(lineUserId: string, displayName?: string) {
  return prisma.user.upsert({
    where: { lineUserId },
    update: { displayName },
    create: { lineUserId, displayName },
  });
}

export async function createExpense(
  lineUserId: string,
  amount: number,
  category: Category,
  note: string,
  displayName?: string
) {
  const user = await getOrCreateUser(lineUserId, displayName);
  return prisma.expense.create({
    data: { amount, category, note, userId: user.id },
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
  const last = await prisma.expense.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!last) return null;
  await prisma.expense.delete({ where: { id: last.id } });
  return last;
}
