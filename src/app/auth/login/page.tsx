"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

function LoginContent() {
  const searchParams = useSearchParams();
  const registered = searchParams?.get("registered") === "1";
  return <LoginForm registered={registered} />;
}

export default function LoginPage() {
  return (
    <main className="mx-auto w-full max-w-md p-6">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Use your email and password, or Google.
      </p>

      <Suspense fallback={<div className="mt-6 text-sm text-neutral-500">Loading…</div>}>
        <LoginContent />
      </Suspense>
    </main>
  );
}
