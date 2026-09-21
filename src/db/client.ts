import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export function createDatabase(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error("缺少 DATABASE_URL。请复制 .env.example 为 .env.local 并配置 PostgreSQL。 ");
  }

  const client = postgres(databaseUrl, { max: 5 });
  return { db: drizzle(client, { schema }), close: () => client.end() };
}
