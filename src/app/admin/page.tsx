import Link from "next/link";

export default function AdminHomePage() {
  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <h1 className="text-xl font-semibold">Admin Dashboard</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Manage categories, quizzes, and questions.
      </p>

      <div className="mt-6 grid gap-3">
        <Link className="rounded-md border border-neutral-200 bg-white p-4" href="/admin/categories">
          <div className="font-medium">Categories</div>
          <div className="mt-1 text-sm text-neutral-600">Create and manage quiz categories.</div>
        </Link>

        <Link className="rounded-md border border-neutral-200 bg-white p-4" href="/admin/quizzes">
          <div className="font-medium">Quizzes</div>
          <div className="mt-1 text-sm text-neutral-600">Create quizzes and edit questions.</div>
        </Link>
      </div>
    </main>
  );
}
