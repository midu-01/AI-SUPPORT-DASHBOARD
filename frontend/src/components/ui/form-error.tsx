/**
 * Form-level error banner, for failures that belong to no single field —
 * "Invalid email or password", "Email already registered".
 *
 * `role="alert"` so it is announced when it appears; a message that is only
 * visible is invisible to anyone using a screen reader.
 */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="rounded-lg border border-danger/30 bg-red-50 px-3 py-2 text-sm text-danger"
    >
      {message}
    </div>
  );
}
