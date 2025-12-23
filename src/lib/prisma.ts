import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

declare global {
  var prisma: PrismaClient | undefined;

  var prismaPgPool: Pool | undefined;
}

const pool =
  global.prismaPgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL ?? "",
    ...(process.env.NODE_ENV === "production" ? { ssl: { rejectUnauthorized: false } } : {}),
  });

if (process.env.NODE_ENV !== "production") {
  global.prismaPgPool = pool;
}

const adapter = new PrismaPg(pool);

export const prisma = global.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
