"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { TextField } from "@/components/ui/text-field";
import { apiFetch } from "@/lib/api-client";
import { applyApiErrors } from "@/lib/form-errors";
import { registerSchema, type RegisterValues } from "@/lib/validation";
import type { LoginResponse, User } from "@/types/api";

const FIELDS = ["email", "password", "full_name"] as const;

export default function RegisterPage() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });

  const signUp = useMutation({
    mutationFn: async (values: RegisterValues) => {
      await apiFetch<User>("/auth/register", { method: "POST", body: values });
      // Registering does not sign you in — it returns the user, not a cookie.
      // Logging in immediately afterwards saves making someone type the
      // credentials they just chose. If this second call fails the account
      // still exists, so the error routes them to the login form rather than
      // implying the sign-up failed.
      return apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: { email: values.email, password: values.password },
      });
    },
    onSuccess: () => {
      router.replace("/");
      router.refresh();
    },
    onError: (error) => setFormError(applyApiErrors(error, setError, FIELDS)),
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    signUp.mutate(values);
  });

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        Create an account
      </h1>
      <p className="mt-1.5 text-sm text-slate-600">
        Start organising your support conversations.
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
        <FormError message={formError} />

        <TextField
          label="Full name"
          autoComplete="name"
          placeholder="Ada Lovelace"
          error={errors.full_name?.message}
          {...register("full_name")}
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          {...register("email")}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          error={errors.password?.message}
          {...register("password")}
        />

        <Button type="submit" loading={signUp.isPending} className="w-full">
          {signUp.isPending ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-brand hover:text-brand-hover"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}
