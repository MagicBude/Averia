import { loadDatabaseEnvironment } from "./load-env";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { createDatabase } from "./client";

loadDatabaseEnvironment();

const connection = createDatabase();

try {
  await migrate(connection.db, { migrationsFolder: "drizzle" });
  console.log("数据库迁移完成。");
} finally {
  await connection.close();
}
