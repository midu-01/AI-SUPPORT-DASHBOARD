import { cn } from "@/lib/utils";

/*
  Shape decides the radius, so no call site passes its own. That is not tidiness:
  `cn()` is a plain join (a documented ground rule — no `tailwind-merge`), so a
  base `rounded-md` plus a call-site `rounded-lg` puts both classes on the element
  and lets stylesheet order pick the winner. The old `Skeleton` had exactly that
  collision at ~15 call sites. A lookup table cannot collide with itself.
*/
/*
  `control` is a fourth variant the plan did not list, added because 11 of the
  ~15 radius overrides at call sites were `rounded-lg` — placeholders standing in
  for buttons and inputs. Without it, migrating them to `rect` would resize every
  one from 8px to 12px, so the skeleton would stop matching the control it
  represents. A variant that mirrors `rounded-control` keeps the geometry honest.
*/
const VARIANTS = {
  text: "rounded-chip",
  control: "rounded-control",
  rect: "rounded-card",
  circle: "rounded-full",
} as const;

interface SkeletonProps {
  variant?: keyof typeof VARIANTS;
  className?: string;
}

/**
 * Loading placeholder.
 *
 * `aria-hidden` because a screen reader should not read out a row of grey boxes;
 * the surrounding region announces the loading state once instead.
 *
 * The sweep is a `translateX` on an overlay, not `animate-pulse`. Two reasons:
 * a pulse animates `opacity` on the whole box, which makes a page of skeletons
 * throb in unison and reads as a rendering fault rather than as progress; and a
 * transform is compositor-only, where the alternative implementation of a sweep
 * (`background-position`) forces a paint on every frame for every skeleton on
 * screen — a dashboard shows more than twenty.
 *
 * Under `prefers-reduced-motion` the overlay is hidden by a rule in globals.css
 * and the flat tint remains. This is the Step 1.5 regression closing: the blanket
 * reduced-motion rule there disabled `animate-pulse` and left a static grey box
 * with no replacement. A moving sweep is a genuine vestibular concern where an
 * opacity fade is not, so the fallback is the right outcome rather than a
 * compromise — but it needed a deliberate static state, which is this.
 */
export function Skeleton({ variant = "text", className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative overflow-hidden bg-slate-200",
        VARIANTS[variant],
        className,
      )}
    >
      <span
        data-shimmer
        /*
          `via-white/60`, not a solid white band: the sweep should read as light
          passing over the surface, and a hard-edged block reads as a second
          element sliding across. Starts fully off the left edge so the first
          frame shows nothing.
        */
        className="skeleton-shimmer absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/60 to-transparent"
      />
    </div>
  );
}
