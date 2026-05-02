import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

const connectionString =
	env.POSTGRES_URL_NON_POOLING ||
	env.POSTGRES_URL ||
	env.DATABASE_URL ||
	env.theourban_com_DATABASE_URL;

if (!connectionString) throw new Error('A database connection string is not set');

// Transaction-mode poolers (Neon, Vercel Postgres, Supabase pooler, etc.) do not
// support named prepared statements across pooled connections — queries can fail or no-op.
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
