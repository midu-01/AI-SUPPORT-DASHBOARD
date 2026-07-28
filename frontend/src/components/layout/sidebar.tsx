"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { NAV_ITEMS, isActive } from "./nav-items";
import { Logo } from "@/components/ui/logo";

/**
 * The navigation links themselves, shared by the desktop sidebar and the mobile
 * drawer so the two cannot drift apart in styling the way `NAV_ITEMS` stops them
 * drifting apart in content.
 *
 * `onNavigate` exists for the drawer: an App Router `<Link>` does not unmount
 * the drawer, so without a click handler the menu would stay open over the page
 * it just navigated to.
 */
export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(href, pathname);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
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
    </>
  );
}

/**
 * Desktop sidebar. Hidden below `md`, where `MobileNav`'s drawer takes over.
 *
 * `hidden md:flex` is `display: none`, which removes this from the accessibility
 * tree as well as the layout — so the drawer's identically-labelled `<nav>` is
 * never a second "Main" landmark competing with it.
 */
export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-surface md:flex md:flex-col">
      <div className="flex h-14 items-center border-b border-border px-5">
        <Logo size="sm" />
      </div>

      <nav aria-label="Main" className="flex-1 space-y-1 p-3">
        <NavLinks />
      </nav>
    </aside>
  );
}
