import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  image: text('image'),
  createdAt: text('created_at').notNull(),
});

export const habits = sqliteTable('habits', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  frequency: text('frequency').notNull(), // 'daily', 'weekly', 'specific_days'
  frequencyDays: text('frequency_days'), // Comma-separated index numbers like '1,2,3,4,5' for weekdays
  order: integer('order').notNull(),
  createdAt: text('created_at').notNull(), // ISO String
});

export const habitLogs = sqliteTable('habit_logs', {
  id: text('id').primaryKey(),
  habitId: text('habit_id').notNull().references(() => habits.id, { onDelete: 'cascade' }),
  date: text('date').notNull(), // YYYY-MM-DD
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  completedAt: text('completed_at'), // ISO String
});

export const sleepLogs = sqliteTable('sleep_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(), // YYYY-MM-DD
  hours: real('hours').notNull(), // decimal hours
}, (t) => ({
  userDateIdx: uniqueIndex('user_date_idx').on(t.userId, t.date),
}));
