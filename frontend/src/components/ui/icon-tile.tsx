import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/*
  The rounded icon square. Domain-hue aware, so a conversations tile and a
  documents tile are tellable apart before either label is read — the same job
  the `Card accent` does at panel scale.

  `-subtle` background + `-on` foreground, never the raw fill as a text colour:
  `documents` measures 3.68:1 on white, which is fine for a glyph but fails 4.5:1,
  and a 16px icon inside a tile is close enough to text-weight that the darker
  step is the honest choice. `conversations-on` and `brand` are the same value, so
  the brand tile is unchanged from what the app already had.
*/
const TONES = {
  brand: "bg-brand-subtle text-brand",
  conversations: "bg-conversations-subtle text-conversations-on",
  documents: "bg-documents-subtle text-documents-on",
  members: "bg-members-subtle text-members-on",
} as const;

/*
  Radius scales with the tile. A 4px radius on a 48px square reads as a
  near-square with clipped corners rather than as a rounded tile, which is why
  this is not one shared value.
*/
const SIZES = {
  sm: "size-8 rounded-control [&>svg]:size-4",
  md: "size-10 rounded-control [&>svg]:size-5",
  lg: "size-12 rounded-card [&>svg]:size-6",
} as const;

interface IconTileProps {
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  size?: keyof typeof SIZES;
  className?: string;
}

export function IconTile({
  icon: Icon,
  tone = "brand",
  size = "md",
  className,
}: IconTileProps) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center",
        TONES[tone],
        SIZES[size],
        className,
      )}
    >
      {/* Always decorative. The tile sits beside a label that carries the
          meaning, so announcing the icon would duplicate it. */}
      <Icon aria-hidden="true" />
    </span>
  );
}
