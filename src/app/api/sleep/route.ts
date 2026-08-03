import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/options';
import { db } from '@/db/db';
import { sleepLogs } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

export async function GET() {
  try {
    const session: any = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const logs = await db.select().from(sleepLogs).where(eq(sleepLogs.userId, userId));
    return NextResponse.json(logs);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session: any = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const { id, date, hours } = await req.json();

    const existing = await db
      .select()
      .from(sleepLogs)
      .where(and(eq(sleepLogs.date, date), eq(sleepLogs.userId, userId)));

    if (existing.length > 0) {
      await db
        .update(sleepLogs)
        .set({ hours })
        .where(and(eq(sleepLogs.date, date), eq(sleepLogs.userId, userId)));
    } else {
      await db.insert(sleepLogs).values({
        id,
        userId,
        date,
        hours,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
