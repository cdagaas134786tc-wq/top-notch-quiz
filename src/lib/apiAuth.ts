import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export type AuthContext = {
  userId: string;
  role: "USER" | "ADMIN";
};

export async function requireAuth(req: NextRequest): Promise<AuthContext | null> {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.sub) return null;
  return { userId: token.sub, role: token.role ?? "USER" };
}

export async function requireAdmin(req: NextRequest): Promise<AuthContext | null> {
  const auth = await requireAuth(req);
  if (!auth) return null;
  if (auth.role !== "ADMIN") return null;
  return auth;
}
