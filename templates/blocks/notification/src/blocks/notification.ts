import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { notifications, userAgentBindings } from "@/db/schema";

export async function bindAgentEmail(agentId: string, email: string) {
  const existing = await db.select().from(userAgentBindings).where(eq(userAgentBindings.agentId, agentId)).limit(1);
  if (existing[0]) {
    const [updated] = await db.update(userAgentBindings).set({ email }).where(eq(userAgentBindings.agentId, agentId)).returning();
    return updated;
  }
  const [created] = await db.insert(userAgentBindings).values({ agentId, email }).returning();
  return created;
}

export async function queueNotification(opts: { agentId: string; subject: string; body: string; email?: string | null; }) {
  const email = opts.email ?? (await db.select().from(userAgentBindings).where(eq(userAgentBindings.agentId, opts.agentId)).limit(1))[0]?.email ?? null;
  const [notification] = await db.insert(notifications).values({ agentId: opts.agentId, email, subject: opts.subject, body: opts.body }).returning();
  return notification;
}

export async function sendNotification(id: string) {
  const notification = (await db.select().from(notifications).where(eq(notifications.id, id)).limit(1))[0];
  if (!notification || !notification.email) return null;
  await sendEmail({ to: notification.email, subject: notification.subject, body: notification.body });
  const [sent] = await db.update(notifications).set({ status: "sent", sentAt: new Date() }).where(eq(notifications.id, id)).returning();
  return sent;
}

async function sendEmail(opts: { to: string; subject: string; body: string }) {
  if (process.env.RESEND_API_KEY) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "ClawLake <notify@clawlake.local>", to: opts.to, subject: opts.subject, text: opts.body }),
    });
    return;
  }
  console.log(`[notification:mock] ${opts.to} ${opts.subject}\n${opts.body}`);
}
