"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

export default function DocumentsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("Documents error:", error);

  return (
    <div className="mx-auto max-w-5xl">
      <Card>
        <CardBody className="flex flex-col items-center gap-4 py-12 text-center">
          <AlertTriangle
            className="size-10 text-amber-500"
            aria-hidden="true"
          />
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Something went wrong
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              We couldn&apos;t load your documents. Please try again.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={reset}>
            Try again
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
