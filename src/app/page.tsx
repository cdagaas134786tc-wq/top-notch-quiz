import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-neutral-50 to-neutral-100 px-4">
      <main className="flex flex-col items-center text-center">
        <h1 className="text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl">
          Top Notch Quiz
        </h1>
        <p className="mt-4 max-w-md text-lg text-neutral-600">
          Test your knowledge with our interactive quizzes. Track your progress and challenge yourself!
        </p>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row">
          <Link
            href="/quiz"
            className="inline-flex items-center justify-center rounded-lg bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-700"
          >
            Browse Quizzes
          </Link>
          <Link
            href="/auth/login"
            className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-6 py-3 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50"
          >
            Sign In
          </Link>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          <div className="rounded-lg border border-neutral-200 bg-white p-6 text-left">
            <h3 className="font-semibold text-neutral-900">📝 Take Quizzes</h3>
            <p className="mt-2 text-sm text-neutral-600">
              Multiple choice questions with instant feedback.
            </p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-6 text-left">
            <h3 className="font-semibold text-neutral-900">📊 Track Progress</h3>
            <p className="mt-2 text-sm text-neutral-600">
              Save your answers and review your attempts.
            </p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-6 text-left">
            <h3 className="font-semibold text-neutral-900">🏆 Get Scored</h3>
            <p className="mt-2 text-sm text-neutral-600">
              See your results and explanations after submission.
            </p>
          </div>
        </div>
      </main>

      <footer className="mt-16 text-sm text-neutral-500">
        <p>© 2025 Top Notch Quiz. All rights reserved.</p>
      </footer>
    </div>
  );
}
