import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7 moved the datasource connection URL out of schema.prisma into this
// config. The Prisma CLI does NOT auto-load .env, so we import "dotenv/config"
// (it reads DATABASE_URL from the root .env file). env() throws if the variable
// is missing — we fail loudly rather than silently connecting to a dummy database.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
