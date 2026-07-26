import { z } from "zod";

/**
 * Client-side mirrors of the backend's Pydantic rules
 * (`backend/app/schemas/user.py`).
 *
 * These exist for feedback speed, not for safety — the server re-validates
 * everything and is the only check that counts. Where the two disagree, the
 * backend wins and its 422 is mapped onto the offending field.
 */

export const registerSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    // 72 bytes is bcrypt's hard limit. The backend rejects longer input rather
    // than truncating it, because silent truncation means a 100-character
    // password is validated on its first 72 — so we reject it here too.
    .max(72, "Password must be at most 72 characters"),
  full_name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(255, "Name must be at most 255 characters"),
});

/**
 * Login checks only that the fields are filled in.
 *
 * No length rules on purpose, matching the backend: applying the registration
 * policy here would lock out anyone whose password predates it, and it would
 * advertise the exact policy to someone probing the login form.
 */
export const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type RegisterValues = z.infer<typeof registerSchema>;
export type LoginValues = z.infer<typeof loginSchema>;
