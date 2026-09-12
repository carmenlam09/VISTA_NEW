import { prisma } from "../lib/prisma";

// Section 2: no real auth yet - every write is attributed to a single
// hardcoded "logged in as reviewer" user (seeded in prisma/seed.ts).
const REVIEWER_EMAIL = "reviewer@vista.local";

let cachedUserId: string | null = null;

export async function getCurrentUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;
  const user = await prisma.user.findUniqueOrThrow({ where: { email: REVIEWER_EMAIL } });
  cachedUserId = user.id;
  return cachedUserId;
}
