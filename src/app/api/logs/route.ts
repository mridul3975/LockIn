import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/options';
import { db } from '@/db/db';
import { habits, habitLogs } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

export async function POST(req: Request) {
  try {
    const session: any = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const { id, habitId, date, completed, completedAt } = await req.json();

    // Verify habit ownership
    const [habitRecord] = await db
      .select()
      .from(habits)
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId)));

    if (!habitRecord) {
      return NextResponse.json({ error: 'Unauthorized habit access' }, { status: 401 });
    }

    const existing = await db
      .select()
      .from(habitLogs)
      .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.date, date)));

    if (existing.length > 0) {
      await db
        .update(habitLogs)
        .set({ completed, completedAt })
        .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.date, date)));
    } else {
      await db.insert(habitLogs).values({
        id,
        habitId,
        date,
        completed,
        completedAt: completedAt || new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
