import nextEnvironment from "@next/env";
import { defineConfig } from "drizzle-kit";

const { loadEnvConfig } = nextEnvironment;

loadEnvConfig(process.cwd());

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://averia:averia@127.0.0.1:5432/averia",
  },
  strict: true,
  verbose: true,
});
