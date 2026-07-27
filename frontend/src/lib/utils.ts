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
 * Render a UTC timestamp from the API as a short date.
 *
 * Timestamps are stored UTC-only (ASSUMPTIONS.md); this is the single place
 * they become local, so there is one thing to change if per-user timezones are
 * ever added.
 *
 * The locale is pinned rather than left as `undefined`. "Runtime default" means
 * Node's locale on the server and the browser's on the client, and when those
 * disagree the same timestamp server-renders as "Jul 27, 2026" and hydrates as
 * "27 Jul 2026" — which React reports as a hydration mismatch (error #418) and
 * repairs by re-rendering the subtree on the client. Deterministic output
 * matters more here than honouring a per-user locale the API has no notion of.
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
