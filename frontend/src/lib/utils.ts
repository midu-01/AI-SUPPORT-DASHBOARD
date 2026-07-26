/**
 * Join class names, dropping falsey ones.
 *
 * Deliberately not `clsx` + `tailwind-merge`: those exist to resolve conflicting
 * Tailwind utilities (`p-2` beating `p-4`), and the components here avoid the
 * problem instead by keeping variant classes in lookup tables rather than
 * layering overrides. Ten lines beats two dependencies for that.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/** `1536` → `1.5 KB`. Used for document sizes. */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / Math.pow(1024, exponent);
  // Whole bytes read oddly as "512.0 B", so only fractional units get a decimal.
  return `${exponent === 0 ? value : value.toFixed(1)} ${units[exponent]}`;
}

/**
 * Render a UTC timestamp from the API in the user's locale.
 *
 * Timestamps are stored UTC-only (ASSUMPTIONS.md); this is the single place
 * they become local, so there is one thing to change if per-user timezones are
 * ever added.
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
