import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

declare global {
  var prisma: PrismaClient | undefined;

  var prismaPgPool: Pool | undefined;
}

function getPool(): Pool {
  if (global.prismaPgPool) return global.prismaPgPool;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Missing DATABASE_URL. Set it in your environment (Vercel Env Vars or local .env).");
  }

  const pool = new Pool({
    connectionString: url,
    ...(process.env.NODE_ENV === "production" ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  if (process.env.NODE_ENV !== "production") {
    global.prismaPgPool = pool;
  }

  return pool;
}

function getPrisma(): PrismaClient {
  if (global.prisma) return global.prisma;

  const adapter = new PrismaPg(getPool());
  const client = new PrismaClient({ adapter });

  if (process.env.NODE_ENV !== "production") {
    global.prisma = client;
  }

  return client;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return getPrisma()[prop as keyof PrismaClient];
  },
});
