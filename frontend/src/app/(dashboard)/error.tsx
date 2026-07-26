"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

/**
 * Error boundary for the signed-in area.
 *
 * Must be a Client Component — App Router error boundaries rely on React's
 * class-based `componentDidCatch`, which cannot run on the server.
 *
 * This catches the case the auth flow does *not*: a 401 is already handled by
 * the layout redirecting to /login, so what lands here is a backend that is
 * down, unreachable, or returning a 500. Those need a retry, not a sign-out.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // In production Next replaces the message with a digest before it reaches
    // the browser, so the real cause is only visible server-side. Logging it
    // here is what makes the client-side occurrence traceable at all.
    console.error("Dashboard render failed:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md pt-10">
      <Card>
        <CardBody className="flex flex-col items-center gap-4 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-red-100 text-danger">
            <AlertTriangle className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-base font-semibold text-slate-900">
              Something went wrong
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              We couldn&apos;t load this page. The API may be unavailable — check
              that the backend is running, then try again.
            </p>
          </div>
          {/* `reset()` re-runs the failed server render rather than reloading
              the whole document, so a transient failure recovers in place. */}
          <Button onClick={reset}>
            <RotateCw className="size-3.5" aria-hidden="true" />
            Try again
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
