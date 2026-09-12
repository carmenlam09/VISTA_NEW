import { MODULES } from "shared-types";
import { Link, useParams } from "react-router-dom";

import { AdverseMediaSummaryCard } from "@/components/adverseMedia/AdverseMediaSummaryCard";
import { KyvReportSummaryCard } from "@/components/kyvReport/KyvReportSummaryCard";
import { ScreeningSummaryCard } from "@/components/screening/ScreeningSummaryCard";
import { TriageSummaryCard } from "@/components/triage/TriageSummaryCard";
import { Badge } from "@/components/ui/badge";
import { useVendor } from "@/hooks/useVendor";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

export function VendorProfilePage() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const { data: vendor, isLoading, isError } = useVendor(vendorId);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading vendor...</p>;
  }
  if (isError || !vendor) {
    return <p className="text-sm text-destructive">Could not load this vendor.</p>;
  }

  const futureModules = MODULES.filter((m) => !m.implemented);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{vendor.companyName}</h1>
          <p className="text-sm text-muted-foreground">
            Read-only summary of everything captured for this vendor so far.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            to={`/knowledge-repository?q=${encodeURIComponent(vendor.companyName)}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            View Similar Past Cases
          </Link>
          <Link
            to={`/vendor/${vendor.id}/intake`}
            className="text-sm font-medium text-primary hover:underline"
          >
            Open intake &amp; extraction
          </Link>
        </div>
      </div>

      <section className="rounded-lg border border-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Corporate Information</h2>
          {vendor.corporateInfo?.isVerified && <Badge variant="success">Verified</Badge>}
        </div>
        {vendor.corporateInfo ? (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Company Name</dt>
              <dd>{vendor.corporateInfo.companyName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Former Company Name</dt>
              <dd>{vendor.corporateInfo.formerCompanyName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Date of Incorporation</dt>
              <dd>{formatDate(vendor.corporateInfo.dateOfIncorporation)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Company Status</dt>
              <dd>{vendor.corporateInfo.companyStatus ?? "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">Nature of Business</dt>
              <dd>{vendor.corporateInfo.natureOfBusiness ?? "—"}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">Not yet captured.</p>
        )}
      </section>

      <section className="rounded-lg border border-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Summary of Share Capital</h2>
          {vendor.shareCapital?.isVerified && <Badge variant="success">Verified</Badge>}
        </div>
        {vendor.shareCapital ? (
          <p className="text-sm">Paid Up Capital: {vendor.shareCapital.paidUpCapital ?? "—"}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Not yet captured.</p>
        )}
      </section>

      <section className="rounded-lg border border-border p-4">
        <h2 className="mb-3 text-sm font-semibold">Directors / Officers</h2>
        {vendor.directors.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="pb-1 pr-2 font-medium">Name</th>
                <th className="pb-1 pr-2 font-medium">IC/Passport No.</th>
                <th className="pb-1 font-medium">Designation</th>
              </tr>
            </thead>
            <tbody>
              {vendor.directors.map((d) => (
                <tr key={d.id} className="border-t border-border">
                  <td className="py-1 pr-2">{d.name}</td>
                  <td className="py-1 pr-2">{d.icPassportNo ?? "—"}</td>
                  <td className="py-1">{d.designation ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground">Not yet captured.</p>
        )}
      </section>

      <section className="rounded-lg border border-border p-4">
        <h2 className="mb-3 text-sm font-semibold">Shareholders / Members</h2>
        {vendor.shareholders.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="pb-1 pr-2 font-medium">IC/Passport/Registration No.</th>
                <th className="pb-1 pr-2 font-medium">Name</th>
                <th className="pb-1 font-medium">Total Shares</th>
              </tr>
            </thead>
            <tbody>
              {vendor.shareholders.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="py-1 pr-2">{s.icPassportRegistrationNo ?? "—"}</td>
                  <td className="py-1 pr-2">{s.name}</td>
                  <td className="py-1">{s.totalShares ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground">Not yet captured.</p>
        )}
      </section>

      <ScreeningSummaryCard vendorId={vendor.id} />
      <AdverseMediaSummaryCard vendorId={vendor.id} />
      <TriageSummaryCard vendorId={vendor.id} />
      <KyvReportSummaryCard vendorId={vendor.id} />

      <div className="grid gap-4 sm:grid-cols-2">
        {futureModules.map((module) => (
          <div key={module.slug} className="rounded-lg border border-border p-4">
            <div className="text-sm font-medium">{module.label}</div>
            <div className="mt-1 text-xs text-muted-foreground">Coming soon</div>
          </div>
        ))}
      </div>
    </div>
  );
}
