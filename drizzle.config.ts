// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./ui/src/lib/server/db/schema.ts",
  out: "./ui/drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
