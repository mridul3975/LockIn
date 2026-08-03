import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/options';
import { db } from '@/db/db';
import { habits } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

export async function GET() {
  try {
    const session: any = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const allHabits = await db.select().from(habits).where(eq(habits.userId, userId));
    const sorted = allHabits.sort((a, b) => a.order - b.order);
    return NextResponse.json(sorted);
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

    const body = await req.json();
    const { id, name, frequency, frequencyDays, order, createdAt } = body;

    const existing = await db
      .select()
      .from(habits)
      .where(and(eq(habits.id, id), eq(habits.userId, userId)));
    
    const freqDaysStr = Array.isArray(frequencyDays) ? frequencyDays.join(',') : frequencyDays;

    if (existing.length > 0) {
      await db.update(habits)
        .set({ name, frequency, frequencyDays: freqDaysStr, order })
        .where(and(eq(habits.id, id), eq(habits.userId, userId)));
    } else {
      await db.insert(habits).values({
        id,
        userId,
        name,
        frequency,
        frequencyDays: freqDaysStr,
        order,
        createdAt: createdAt || new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session: any = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing habit id' }, { status: 400 });
    }

    // Verify owner before deleting
    await db.delete(habits).where(and(eq(habits.id, id), eq(habits.userId, userId)));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
