import { Home } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useVendor } from "@/hooks/useVendor";

function BackToVendorsLink() {
  return (
    <Link
      to="/"
      className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
    >
      ← Back to vendors
    </Link>
  );
}

function HomeButton() {
  return (
    <Button asChild variant="outline" size="sm">
      <Link to="/" aria-label="Home - back to vendor list">
        <Home className="mr-1.5 h-4 w-4" />
        Home
      </Link>
    </Button>
  );
}

export function VendorHeader() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const { data: vendor } = useVendor(vendorId);
  const { pathname } = useLocation();

  if (!vendorId) {
    return (
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="text-base font-semibold">
          {pathname === "/" ? "Welcome back" : "No vendor selected"}
        </div>
        <HomeButton />
      </header>
    );
  }

  if (!vendor) {
    return (
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <BackToVendorsLink />
          <div className="text-base font-semibold text-muted-foreground">Loading vendor...</div>
        </div>
        <HomeButton />
      </header>
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
    <header className="flex items-center justify-between border-b border-border px-6 py-4">
      <div>
        <BackToVendorsLink />
        <div className="text-base font-semibold">{vendor.companyName}</div>
        <div className="text-xs text-muted-foreground">
          {vendor.registrationNo ? `Reg. No. ${vendor.registrationNo} · ` : ""}
          {verifiedCount} of 4 sections verified
        </div>
      </div>
      <HomeButton />
    </header>
  );
}
