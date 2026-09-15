import { ChevronLeft, Home } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { useVendor } from "@/hooks/useVendor";

import { GlobalSearch } from "./GlobalSearch";
import { NotificationBell } from "./NotificationBell";

// Auth is still stubbed (see CLAUDE.md §2) - this mirrors the hardcoded
// reviewer the backend attributes records to, so the chip is not inventing
// an identity the rest of the app doesn't already assume.
const CURRENT_USER = { name: "Default Reviewer", role: "Reviewer" };

function UserChip() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-transparent py-1 pl-1 pr-2 transition-colors hover:border-border hover:bg-muted/60">
      <InitialsAvatar name={CURRENT_USER.name} tone="brand" size="md" />
      <div className="hidden leading-tight lg:block">
        <div className="text-xs font-semibold">{CURRENT_USER.name}</div>
        <div className="text-[10px] text-muted-foreground">{CURRENT_USER.role}</div>
      </div>
    </div>
  );
}

function VerificationProgress({ verified, total }: { verified: number; total: number }) {
  const complete = verified === total;
  return (
    <Badge dot variant={complete ? "success" : "warning"}>
      {verified} of {total} sections verified
    </Badge>
  );
}

/** Left-hand context block: what the user is currently looking at. */
function HeaderContext() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const { data: vendor } = useVendor(vendorId);
  const { pathname } = useLocation();

  if (!vendorId) {
    return (
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">
          {pathname === "/" ? "Vendor Review Dashboard" : "No vendor selected"}
        </div>
        <div className="text-[11px] text-muted-foreground">Know Your Vendor</div>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-muted-foreground">
          Loading vendor...
        </div>
      </div>
    );
  }

  const corporateInfoVerified = vendor.corporateInfo?.isVerified ?? false;
  const shareCapitalVerified = vendor.shareCapital?.isVerified ?? false;
  // An empty list means "nothing captured yet", not "verified" - only count it
  // once there's at least one row and every row has been confirmed.
  const directorsVerified = vendor.directors.length > 0 && vendor.directors.every((d) => d.isVerified);
  const shareholdersVerified =
    vendor.shareholders.length > 0 && vendor.shareholders.every((s) => s.isVerified);
  const verifiedCount = [
    corporateInfoVerified,
    shareCapitalVerified,
    directorsVerified,
    shareholdersVerified,
  ].filter(Boolean).length;

  return (
    <div className="flex min-w-0 items-center gap-3">
      <Link
        to="/"
        aria-label="Back to vendor list"
        title="Back to vendor list"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-brand/30 hover:bg-brand/[0.08] hover:text-foreground"
      >
        <ChevronLeft size={16} />
      </Link>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{vendor.companyName}</div>
        <div className="flex items-center gap-2">
          {vendor.registrationNo && (
            <span className="text-[11px] text-muted-foreground">
              BRN {vendor.registrationNo}
            </span>
          )}
          <VerificationProgress verified={verifiedCount} total={4} />
        </div>
      </div>
    </div>
  );
}

export function VendorHeader() {
  return (
    <header className="shrink-0">
      <div className="flex items-center gap-4 border-b border-border bg-background px-6 py-2.5">
        <div className="min-w-0 flex-1">
          <HeaderContext />
        </div>

        <div className="hidden flex-1 justify-center md:flex">
          <GlobalSearch />
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/" aria-label="Home - back to vendor list">
              <Home className="mr-1.5 h-4 w-4" />
              Home
            </Link>
          </Button>
          <NotificationBell />
          <div className="mx-1 hidden h-6 w-px bg-border sm:block" />
          <UserChip />
        </div>
      </div>
      {/* OCBC brand accent under the utility bar. */}
      <div aria-hidden="true" className="h-0.5 bg-brand" />
    </header>
  );
}
