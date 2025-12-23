import type { NextRequest } from "next/server";

export function isSecureCookies(req: NextRequest): boolean {
  const url = process.env.NEXTAUTH_URL;
  if (url?.startsWith("https://")) return true;

  // Fallback: infer from request headers (may be present behind proxies)
  const forwardedProto = req.headers.get("x-forwarded-proto");
  return forwardedProto === "https";
}

export function sessionCookieName(req: NextRequest): string {
  return isSecureCookies(req) ? "__Secure-next-auth.session-token" : "next-auth.session-token";
}
