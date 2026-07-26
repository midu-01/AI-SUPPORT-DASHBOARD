"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { ApiError } from "@/lib/api-client";

/**
 * React Query provider — the app's only global state container.
 *
 * Engineering Decision #3: almost every piece of state here is *server* state
 * (conversations, documents, the current user). React Query already solves
 * caching, revalidation, and request deduplication for that; Redux or Zustand
 * would add a store whose entire job is re-implementing them by hand. What is
 * left is genuinely local — an open dialog, a search input — and that is
 * `useState`.
 */
export function Providers({ children }: { children: ReactNode }) {
  // Held in state, never at module scope. A module-level client is created once
  // per server *process*, so on the server it would be shared across concurrent
  // requests from different users — one person's cached conversations could be
  // served to another. `useState` gives each render its own.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data here changes only when this user changes it, so refetching
            // every time the window regains focus is mostly wasted requests.
            refetchOnWindowFocus: false,
            staleTime: 30_000,
            // Retrying a 4xx is pointless — the request was rejected on its
            // merits, and repeating it verbatim gets the same answer. Worse, a
            // retried 401 delays the redirect to /login by however long the
            // backoff takes, so an expired session looks like a hung page.
            // Only 5xx and network failures are worth a second attempt.
            retry: (failureCount, error) => {
              if (error instanceof ApiError && error.status < 500) return false;
              return failureCount < 1;
            },
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
