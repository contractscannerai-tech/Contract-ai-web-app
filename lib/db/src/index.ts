import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

function buildConnectionString(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    if (!url.searchParams.has("sslmode")) {
      url.searchParams.set("sslmode", "verify-full");
    }
    return url.toString();
  } catch {
    const sep = rawUrl.includes("?") ? "&" : "?";
    return `${rawUrl}${sep}sslmode=verify-full`;
  }
}

const connectionString = buildConnectionString(process.env.DATABASE_URL);

export const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });

export * from "./schema";
