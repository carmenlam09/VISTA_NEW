import { Link, useParams } from "react-router-dom";

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

export function VendorHeader() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const { data: vendor } = useVendor(vendorId);

  if (!vendorId) {
    return (
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="text-base font-semibold">No vendor selected</div>
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
    </header>
  );
}
