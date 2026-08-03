import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/options';
import { db } from '@/db/db';
import { habits } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

export async function POST(req: Request) {
  try {
    const session: any = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const { habits: orderedHabits } = await req.json();

    if (!Array.isArray(orderedHabits)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    for (const h of orderedHabits) {
      await db.update(habits)
        .set({ order: h.order })
        .where(and(eq(habits.id, h.id), eq(habits.userId, userId)));
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
