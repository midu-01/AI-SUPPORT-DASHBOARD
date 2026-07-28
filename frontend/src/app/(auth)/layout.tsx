import type { ReactNode } from "react";

import { Logo } from "@/components/ui/logo";

/**
 * Shell for the signed-out pages.
 *
 * A route group — the `(auth)` folder shapes the layout tree without appearing
 * in the URL, so these render at `/login` and `/register` rather than
 * `/auth/login`. That is the whole reason to use one: shared chrome without a
 * path segment nobody asked for.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo size="md" />
        </div>
        {children}
      </div>
    </main>
  );
}
