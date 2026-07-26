import { FileText, LayoutDashboard, MessagesSquare } from "lucide-react";

/**
 * The one list of navigation targets, shared by the sidebar and the mobile bar.
 * Duplicating it is how the two quietly drift apart.
 */
export const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/conversations", label: "Conversations", icon: MessagesSquare },
  { href: "/documents", label: "Documents", icon: FileText },
] as const;

/**
 * Whether a nav link should render as the current page.
 *
 * `/` needs an exact match — a `startsWith` test would light up Dashboard on
 * every route, since every path starts with a slash.
 */
export function isActive(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
