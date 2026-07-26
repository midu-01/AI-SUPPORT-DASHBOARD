"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import type { User } from "@/types/api";

/**
 * Top bar: who is signed in, and how to stop being signed in.
 *
 * `user` arrives as a prop from the layout's Server Component rather than being
 * fetched here, so the name is present in the first HTML response instead of
 * popping in after a client round-trip.
 */
export function Topbar({ user }: { user: User }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const logout = useMutation({
    mutationFn: () => apiFetch<{ message: string }>("/auth/logout", { method: "POST" }),
    // `onSettled`, not `onSuccess`: if the request fails the cookie may still be
    // gone, and leaving someone on a dashboard they can no longer load is worse
    // than sending them to a login form they can use.
    onSettled: () => {
      // Wipe the cache before navigating. React Query's store outlives the
      // route change, so without this the next person to sign in on this
      // browser briefly sees the previous user's conversations rendered from
      // cache before the refetch replaces them.
      queryClient.clear();
      router.replace("/login");
      router.refresh();
    },
  });

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-4 md:px-6">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-900">
          {user.full_name}
        </p>
        <p className="truncate text-xs text-slate-500">{user.email}</p>
      </div>

      <Button
        variant="secondary"
        size="sm"
        onClick={() => logout.mutate()}
        loading={logout.isPending}
      >
        <LogOut className="size-3.5" aria-hidden="true" />
        {logout.isPending ? "Signing out…" : "Sign out"}
      </Button>
    </header>
  );
}
