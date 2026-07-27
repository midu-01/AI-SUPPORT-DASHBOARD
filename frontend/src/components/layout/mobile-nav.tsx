"use client";

import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { NavLinks } from "./sidebar";

/**
 * Hamburger button and the drawer it opens. Rendered only below `md`, where the
 * sidebar is hidden.
 *
 * Built on the native `<dialog>` for the same reason as `ConfirmDialog`:
 * `showModal()` supplies focus trapping, Escape-to-close, `aria-modal`, and
 * inertness of the page behind it from the platform. A hand-rolled drawer that
 * leaves the page behind it tabbable is the usual outcome of not doing this.
 *
 * The UA stylesheet centres a modal dialog with `margin: auto`; `m-0` with a
 * full height is what turns it into a left-edge drawer.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // `showModal()` throws if already open, and `close()` on a closed dialog
    // fires a spurious `close` event — hence the guards rather than bare calls.
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Escape fires the native `cancel` event and closes the dialog without
    // telling React. Left unhandled, state would still say "open" and the
    // drawer would refuse to reopen.
    const handleCancel = (event: Event) => {
      event.preventDefault();
      setOpen(false);
    };
    el.addEventListener("cancel", handleCancel);
    return () => el.removeEventListener("cancel", handleCancel);
  }, []);

  // Navigating with the browser's back button changes the route without a click
  // on any of our links, so the close has to hang off the pathname too, not only
  // off `onNavigate`.
  //
  // Adjusted during render rather than in an effect: React re-runs this render
  // before committing, so the drawer never paints open over the new route the
  // way an effect's extra pass would let it.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={open}
        className="-ml-2 rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 md:hidden"
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>

      <dialog
        ref={ref}
        // Clicks on the ::backdrop are dispatched to the dialog element itself,
        // so this identity check distinguishes "clicked outside" from "clicked
        // a link inside".
        onClick={(event) => {
          if (event.target === ref.current) setOpen(false);
        }}
        className="m-0 h-full max-h-none w-64 max-w-[80vw] border-r border-border bg-surface p-0 backdrop:bg-slate-900/40 md:hidden"
      >
        <div className="flex h-14 items-center justify-between border-b border-border pl-5 pr-3">
          <span className="text-sm font-semibold tracking-tight text-slate-900">
            AI Support
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close navigation menu"
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="Main" className="space-y-1 p-3">
          <NavLinks onNavigate={() => setOpen(false)} />
        </nav>
      </dialog>
    </>
  );
}
