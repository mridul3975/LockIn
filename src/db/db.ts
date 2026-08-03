import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

const client = createClient({
  url: process.env.DATABASE_URL || 'file:local.db',
  authToken: process.env.DB_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
export type DbType = typeof db;
