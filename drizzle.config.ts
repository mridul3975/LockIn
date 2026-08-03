import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env using absolute path relative to this config file
dotenv.config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'turso',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'local.db',
    authToken: process.env.DB_AUTH_TOKEN,
  },
});
