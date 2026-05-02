import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
dotenv.config();

const connectionString =
	process.env.POSTGRES_URL_NON_POOLING ||
	process.env.POSTGRES_URL ||
	process.env.DATABASE_URL ||
	process.env.theourban_com_DATABASE_URL;

if (!connectionString) throw new Error('A database connection string is not set');

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: { url: connectionString },
	verbose: true,
	strict: false
});
