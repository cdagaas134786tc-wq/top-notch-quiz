import { LoginForm } from "./LoginForm";

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { registered?: string; callbackUrl?: string };
}) {
  const registered = searchParams?.registered === "1";
  return (
    <main className="mx-auto w-full max-w-md p-6">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Use your email and password, or Google.
      </p>

      <LoginForm registered={registered} />
    </main>
  );
}
