import { cn } from "@/lib/utils";

/**
 * Loading placeholder.
 *
 * `aria-hidden` because a screen reader should not read out a row of grey
 * boxes; the surrounding region announces the loading state once instead. The
 * pulse is the one animation in the app — the brief says no advanced animation
 * is expected, and a static grey block reads as a broken layout rather than as
 * something in flight.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-slate-200", className)}
    />
  );
}
