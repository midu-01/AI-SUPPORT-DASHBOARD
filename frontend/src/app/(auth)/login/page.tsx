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
import { loginSchema, type LoginValues } from "@/lib/validation";
import type { LoginResponse } from "@/types/api";

const FIELDS = ["email", "password"] as const;

export default function LoginPage() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const login = useMutation({
    mutationFn: (values: LoginValues) =>
      apiFetch<LoginResponse>("/auth/login", { method: "POST", body: values }),
    onSuccess: () => {
      // `replace`, not `push`: the back button should not return to a login
      // form the user has already come through.
      router.replace("/");
      // The dashboard is server-rendered. Without this, Next serves it from the
      // client-side route cache — populated before the cookie existed — and the
      // proxy bounces the user straight back to /login.
      router.refresh();
    },
    onError: (error) => setFormError(applyApiErrors(error, setError, FIELDS)),
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    login.mutate(values);
  });

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        Sign in
      </h1>
      <p className="mt-1.5 text-sm text-slate-600">
        Welcome back. Enter your details to continue.
      </p>

      {/* noValidate hands validation to zod. Without it the browser's own
          bubbles fire first, in their own wording, and the accessible messages
          below never get a chance to show. */}
      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
        <FormError message={formError} />

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
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password")}
        />

        <Button type="submit" loading={login.isPending} className="w-full">
          {login.isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        No account?{" "}
        <Link
          href="/register"
          className="font-medium text-brand hover:text-brand-hover"
        >
          Create one
        </Link>
      </p>
    </>
  );
}
