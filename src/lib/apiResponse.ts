import { NextResponse } from "next/server";

type JsonInit = {
  status?: number;
  headers?: HeadersInit;
};

export function jsonOk<T>(data: T, init?: JsonInit) {
  return NextResponse.json(data, { status: init?.status ?? 200, headers: init?.headers });
}

export function jsonError(
  message: string,
  init?: {
    status?: number;
    code?: string;
    headers?: HeadersInit;
  }
) {
  return NextResponse.json(
    { ok: false as const, error: { message, code: init?.code } },
    { status: init?.status ?? 400, headers: init?.headers }
  );
}
