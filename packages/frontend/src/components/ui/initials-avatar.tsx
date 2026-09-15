import { Building2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Legal-form markers only - deliberately not descriptive words like
 * "Holdings" or "Trading", which also occur in personal names in other
 * scripts. Anything matching here is definitely an incorporated entity.
 */
const CORPORATE_MARKERS = new Set([
  "sdn",
  "bhd",
  "berhad",
  "ltd",
  "limited",
  "plc",
  "inc",
  "incorporated",
  "corp",
  "corporation",
  "llp",
  "llc",
  "pte",
  "pty",
  "gmbh",
  "nv",
  "bv",
]);

const normalizePart = (part: string) => part.toLowerCase().replace(/[.'`,]/g, "");

/**
 * True when a name carries a company legal form. SSM shareholder rows hold
 * corporate shareholders alongside individuals, so callers need to tell the
 * two apart before labelling something as a person.
 */
export function isCorporateName(name: string): boolean {
  return name
    .trim()
    .split(/[\s.]+/)
    .some((part) => CORPORATE_MARKERS.has(normalizePart(part)));
}

/**
 * Derives up to two initials from a person's name.
 *
 * Malaysian names in SSM filings routinely carry honorifics and particles
 * ("Dato' Sri", "bin", "a/l") that would otherwise dominate the initials, so
 * those are skipped. Company names drop their legal form and any parenthetical
 * qualifier instead, so "Puncak Semangat Technology Sdn. Bhd." reads as "PT"
 * rather than the useless "PB" that every Sdn Bhd would otherwise share.
 * Falls back to the first two characters of a single token, and to "?" for an
 * unusable name, so this never renders empty.
 */
const SKIPPED_NAME_PARTS = new Set([
  "bin",
  "binti",
  "bt",
  "bte",
  "al",
  "a/l",
  "a/p",
  "ap",
  "dato",
  "dato'",
  "datuk",
  "datin",
  "dr",
  "en",
  "haji",
  "hajjah",
  "ir",
  "mr",
  "mrs",
  "ms",
  "puan",
  "sri",
  "tan",
  "tun",
  "tuan",
]);

export function getInitials(name: string): string {
  const corporate = isCorporateName(name);
  // Parenthetical qualifiers ("(Tempatan)", "(M)") carry no identity.
  const cleaned = corporate ? name.replace(/\([^)]*\)/g, " ") : name;

  const parts = cleaned
    .trim()
    .split(/[\s.]+/)
    .filter(Boolean);

  const skip = corporate ? CORPORATE_MARKERS : SKIPPED_NAME_PARTS;
  const meaningful = parts.filter((p) => !skip.has(normalizePart(p)));
  // If stripping removed everything (e.g. the name IS "Tan"), fall back to
  // the raw parts rather than rendering a placeholder.
  const usable = meaningful.length > 0 ? meaningful : parts;

  if (usable.length === 0) return "?";
  if (usable.length === 1) return usable[0].slice(0, 2).toUpperCase();
  return (usable[0][0] + usable[usable.length - 1][0]).toUpperCase();
}

const TONE_CLASSES = {
  brand: "bg-brand/[0.12] text-brand ring-brand/20",
  warning: "bg-warning/[0.15] text-warning ring-warning/25",
  success: "bg-success/[0.12] text-success ring-success/25",
  neutral: "bg-muted text-muted-foreground ring-border",
} as const;

const SIZE_CLASSES = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
} as const;

export function InitialsAvatar({
  name,
  tone = "neutral",
  size = "sm",
  className,
}: {
  name: string;
  tone?: keyof typeof TONE_CLASSES;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}) {
  // A corporate shareholder is not a person, so it gets a squared-off badge
  // with a building glyph rather than a round portrait-style avatar - the
  // shape alone tells the reviewer which rows are companies.
  const corporate = isCorporateName(name);

  return (
    <span
      aria-hidden="true"
      title={name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-bold uppercase leading-none ring-1",
        corporate ? "rounded-md" : "rounded-full",
        TONE_CLASSES[tone],
        SIZE_CLASSES[size],
        className
      )}
    >
      {corporate ? (
        <Building2 size={size === "md" ? 15 : 12} strokeWidth={2.25} />
      ) : (
        getInitials(name)
      )}
    </span>
  );
}
