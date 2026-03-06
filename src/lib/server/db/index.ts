import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

const connectionString = env.POSTGRES_URL_NON_POOLING || env.POSTGRES_URL || env.theourban_com_DATABASE_URL;

if (!connectionString) throw new Error('A database connection string is not set');

const client = postgres(connectionString);

export const db = drizzle(client, { schema });
