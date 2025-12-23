import type { NextApiRequest, NextApiResponse } from "next";

import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ ok: true, method: req.method ?? "GET", db: "ok" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "db_error";
    res.status(500).json({ ok: false, method: req.method ?? "GET", db: "error", error: msg });
  }
}
