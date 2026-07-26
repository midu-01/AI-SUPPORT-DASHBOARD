/**
 * Placeholder landing page.
 *
 * Replaced in Step 8, when the `(auth)` and `(dashboard)` route groups land and
 * `/` becomes a redirect to one or the other depending on the auth cookie.
 */
export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          AI Support Dashboard
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Frontend scaffold is running. Routes and UI arrive in the next step.
        </p>
        <a
          href="http://localhost:8000/docs"
          className="mt-6 inline-flex items-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
        >
          Open the API docs
        </a>
      </div>
    </main>
  );
}
