import { cn } from "@/lib/utils";

/**
 * AI Support logo — a chat-bubble with a sparkle inside, representing
 * AI-powered customer support.
 *
 * Two sizes: `sm` for the sidebar/mobile-nav header, `md` for the auth pages.
 * The icon is always paired with the wordmark so the brand reads at any size.
 */

const SIZES = {
  sm: { icon: "size-6", text: "text-sm", gap: "gap-2.5" },
  md: { icon: "size-8", text: "text-lg", gap: "gap-3" },
} as const;

interface LogoProps {
  size?: keyof typeof SIZES;
  className?: string;
}

export function Logo({ size = "sm", className }: LogoProps) {
  const s = SIZES[size];

  return (
    <div className={cn("flex items-center", s.gap, className)}>
      {/* Icon: rounded chat bubble with AI sparkle */}
      <div
        className={cn(
          s.icon,
          "flex shrink-0 items-center justify-center rounded-lg bg-brand text-white",
        )}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="size-[60%]"
          aria-hidden="true"
        >
          {/* Chat bubble */}
          <path
            d="M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 0 1-4.255-.96L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z"
            fill="currentColor"
            opacity="0.25"
          />
          <path
            d="M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 0 1-4.255-.96L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* AI sparkle — a four-pointed star */}
          <path
            d="M12 7.5v2m0 5v2m-3.5-4.5h2m5 0h2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M12 8l.75 2.25L15 11l-2.25.75L12 14l-.75-2.25L9 11l2.25-.75L12 8Z"
            fill="currentColor"
          />
        </svg>
      </div>

      {/* Wordmark */}
      <span
        className={cn(
          s.text,
          "font-semibold tracking-tight text-slate-900",
        )}
      >
        AI Support
      </span>
    </div>
  );
}

/**
 * Standalone icon for the favicon and other icon-only contexts.
 * Exported as a raw SVG string so it can be used in metadata or as a file.
 */
export function LogoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" fill="#6366f1" />
      <path
        d="M26 15c0 4.418-3.806 8-8.5 8a9.36 9.36 0 0 1-3.83-.82L8 24l1.32-3.52C8.484 19.3 8 17.7 8 16c0-4.418 3.806-8 8.5-8S25 7.582 25 12Z"
        fill="white"
        opacity="0.3"
        transform="translate(-0.5, -1)"
      />
      <path
        d="M25.5 15c0 4.418-3.806 8-8.5 8a9.36 9.36 0 0 1-3.83-.82L7.5 23.5l1.32-3.52C7.984 18.8 7.5 17.2 7.5 15.5c0-4.418 3.806-8 8.5-8s8.5 3.582 8.5 8Z"
        stroke="white"
        strokeWidth="1.2"
        fill="none"
        transform="translate(-0.5, 0.5)"
      />
      <path
        d="M16 10l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z"
        fill="white"
        transform="translate(-0.5, 1.5)"
      />
    </svg>
  );
}
