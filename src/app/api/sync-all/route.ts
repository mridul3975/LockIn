import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/options';
import { db } from '@/db/db';
import { habits, habitLogs, sleepLogs } from '@/db/schema';
import { eq, and, inArray, notInArray } from 'drizzle-orm';

export async function POST(req: Request) {
  try {
    const session: any = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const { habits: localHabits, logs: localLogs, sleepLogs: localSleep } = await req.json();

    // 1. Sync habits (only allowed to create/modify habits belonging to this user)
    if (Array.isArray(localHabits)) {
      const localHabitIds = localHabits.map((h) => h.id);
      if (localHabitIds.length > 0) {
        await db.delete(habits).where(
          and(
            eq(habits.userId, userId),
            notInArray(habits.id, localHabitIds)
          )
        );
      } else {
        await db.delete(habits).where(eq(habits.userId, userId));
      }

      for (const h of localHabits) {
        const existing = await db
          .select()
          .from(habits)
          .where(and(eq(habits.id, h.id), eq(habits.userId, userId)));
        
        const freqDaysStr = Array.isArray(h.frequencyDays) ? h.frequencyDays.join(',') : String(h.frequencyDays || '');
        if (existing.length > 0) {
          await db.update(habits)
            .set({ name: h.name, frequency: h.frequency, frequencyDays: freqDaysStr, order: h.order })
            .where(and(eq(habits.id, h.id), eq(habits.userId, userId)));
        } else {
          await db.insert(habits).values({
            id: h.id,
            userId,
            name: h.name,
            frequency: h.frequency,
            frequencyDays: freqDaysStr,
            order: h.order,
            createdAt: h.createdAt || new Date().toISOString(),
          });
        }
      }
    }

    // Load active habit IDs for owner checks
    const userHabits = await db.select().from(habits).where(eq(habits.userId, userId));
    const userHabitIds = userHabits.map((uh) => uh.id);

    // 2. Sync habit logs (only allowed for habits belonging to this user)
    if (Array.isArray(localLogs) && userHabitIds.length > 0) {
      for (const l of localLogs) {
        if (!userHabitIds.includes(l.habitId)) continue; // skip unauthorized habit logs

        const existing = await db
          .select()
          .from(habitLogs)
          .where(and(eq(habitLogs.habitId, l.habitId), eq(habitLogs.date, l.date)));
        
        if (existing.length > 0) {
          await db.update(habitLogs)
            .set({ completed: l.completed, completedAt: l.completedAt })
            .where(and(eq(habitLogs.habitId, l.habitId), eq(habitLogs.date, l.date)));
        } else {
          await db.insert(habitLogs).values({
            id: l.id,
            habitId: l.habitId,
            date: l.date,
            completed: l.completed,
            completedAt: l.completedAt || new Date().toISOString(),
          });
        }
      }
    }

    // 3. Sync sleep logs (only for this user)
    if (Array.isArray(localSleep)) {
      for (const s of localSleep) {
        const existing = await db
          .select()
          .from(sleepLogs)
          .where(and(eq(sleepLogs.date, s.date), eq(sleepLogs.userId, userId)));
        
        if (existing.length > 0) {
          await db.update(sleepLogs)
            .set({ hours: s.hours })
            .where(and(eq(sleepLogs.date, s.date), eq(sleepLogs.userId, userId)));
        } else {
          await db.insert(sleepLogs).values({
            id: s.id,
            userId,
            date: s.date,
            hours: s.hours,
          });
        }
      }
    }

    // 4. Fetch and return user-scoped state
    const allHabits = await db.select().from(habits).where(eq(habits.userId, userId));
    const allSleep = await db.select().from(sleepLogs).where(eq(sleepLogs.userId, userId));
    
    // Fetch logs only for this user's habits
    let allLogs: any[] = [];
    if (userHabitIds.length > 0) {
      allLogs = await db
        .select()
        .from(habitLogs)
        .where(inArray(habitLogs.habitId, userHabitIds));
    }

    const formattedHabits = allHabits.map((h) => ({
      ...h,
      frequencyDays: h.frequencyDays ? h.frequencyDays.split(',').map(Number) : [],
    })).sort((a, b) => a.order - b.order);

    return NextResponse.json({
      habits: formattedHabits,
      logs: allLogs,
      sleepLogs: allSleep,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
