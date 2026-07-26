"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { NAV_ITEMS, isActive } from "./nav-items";

/**
 * Desktop sidebar.
 *
 * A Client Component only because it needs `usePathname` to mark the current
 * route. Hidden below `md`, where `MobileNav` takes over — Step 12 replaces
 * that with a proper drawer.
 */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-surface md:flex md:flex-col">
      <div className="flex h-14 items-center border-b border-border px-5">
        <span className="text-sm font-semibold tracking-tight text-slate-900">
          AI Support
        </span>
      </div>

      <nav aria-label="Main" className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href, pathname);
          return (
            <Link
              key={href}
              href={href}
              // Marks the current page for assistive tech. Colour alone conveys
              // it to sighted users only.
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-brand/10 text-brand"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

/** Horizontal nav shown below `md`, where the sidebar is hidden. */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="flex gap-1 border-b border-border bg-surface px-2 py-2 md:hidden"
    >
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(href, pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-medium transition-colors",
              active
                ? "bg-brand/10 text-brand"
                : "text-slate-600 hover:bg-slate-100",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
