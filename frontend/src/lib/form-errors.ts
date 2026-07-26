import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import { ApiError } from "./api-client";

/**
 * Route a failed request into a form.
 *
 * The backend flattens 422s into `errors: [{ field, message }]` precisely so a
 * client can do this — attach each problem to the input that caused it instead
 * of dumping one sentence above the form. Anything that cannot be attributed to
 * a field is returned as a form-level message for the caller to display.
 *
 * Returns `null` when every problem was attached to a field.
 */
export function applyApiErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  knownFields: ReadonlyArray<Path<T>>,
): string | null {
  if (!(error instanceof ApiError)) {
    // A network failure or a thrown non-Error. The real cause is not something
    // the user can act on, so say what they can do instead.
    return "Could not reach the server. Check your connection and try again.";
  }

  if (error.code === "VALIDATION_ERROR" && error.fieldErrors.length > 0) {
    const unattributed: string[] = [];

    for (const { field, message } of error.fieldErrors) {
      // Only set errors for fields this form actually renders. A stray field
      // name would otherwise be swallowed — react-hook-form holds the error,
      // no input displays it, and the form refuses to submit with no visible
      // reason why.
      if ((knownFields as ReadonlyArray<string>).includes(field)) {
        setError(field as Path<T>, { type: "server", message });
      } else {
        unattributed.push(message);
      }
    }

    return unattributed.length > 0 ? unattributed.join(" ") : null;
  }

  // 401, 409, 500 — a whole-form condition, not a field-level one.
  return error.message;
}
