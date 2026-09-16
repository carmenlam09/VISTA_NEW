import { Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { NetworkGraph } from "@/components/dashboard/NetworkGraph";
import { RecentAlertsCard } from "@/components/dashboard/RecentAlertsCard";
import { RiskExposureCard } from "@/components/dashboard/RiskExposureCard";
import { WelcomeBanner } from "@/components/dashboard/WelcomeBanner";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { Input } from "@/components/ui/input";
import { useDashboardOverview } from "@/hooks/useDashboardOverview";
import { useVendors } from "@/hooks/useVendors";
import { useCreateVendor, useDeleteVendor } from "@/hooks/useVendorMutations";
import { RISK_TIER_ORDER, RISK_TIERS } from "@/lib/risk";
import { formatDate, parseDdMmYyyy } from "@/lib/utils";
import type { RiskTier, VendorRisk } from "@/types/overview";

const STATUS_BADGE: Record<string, { variant: BadgeProps["variant"]; label: string }> = {
  draft: { variant: "secondary", label: "Draft" },
  in_review: { variant: "warning", label: "In Review" },
  approved: { variant: "success", label: "Approved" },
  rejected: { variant: "destructive", label: "Rejected" },
};

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "in_review", label: "In Review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const RISK_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All risk levels" },
  ...RISK_TIER_ORDER.map((tier) => ({ value: tier, label: RISK_TIERS[tier].label })),
];

const MAX_RESULTS = 5;

// Stubbed auth (CLAUDE.md §2) - matches the reviewer the backend attributes to.
const CURRENT_USER_NAME = "Carmen";

function RiskCell({ risk }: { risk: VendorRisk | undefined }) {
  if (!risk) return <span className="text-xs text-muted-foreground">—</span>;
  const tier = RISK_TIERS[risk.tier];
  if (risk.score === null) {
    return (
      <Badge variant="outline" title="No triage findings yet - screen this vendor to assess risk">
        {tier.label}
      </Badge>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className={`w-7 text-right text-sm font-extrabold tabular-nums ${tier.text}`}>
        {risk.score}
      </span>
      <Badge dot variant={tier.badge}>
        {tier.label}
      </Badge>
    </div>
  );
}

export function VendorListPage() {
  const { data: vendors, isLoading, isError } = useVendors();
  const { data: overview } = useDashboardOverview();
  const createVendor = useCreateVendor();
  const deleteVendor = useDeleteVendor();
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  // Plain text, not a native <input type="date"> - that control's typing
  // order follows the browser's locale (month-first for en-US), which
  // silently rejects a reviewer typing day-first the way every other date in
  // this app displays. maskDateInput reformats digits to dd-mm-yyyy live as
  // they're typed; parseDdMmYyyy below only resolves once it's complete.
  const [dateFromText, setDateFromText] = useState("");
  const [dateToText, setDateToText] = useState("");

  const riskByVendorId = useMemo(
    () => new Map((overview?.risk.byVendor ?? []).map((v) => [v.vendorId, v])),
    [overview]
  );

  const hasActiveFilters =
    statusFilter !== "all" || riskFilter !== "all" || dateFromText !== "" || dateToText !== "";

  function clearFilters() {
    setStatusFilter("all");
    setRiskFilter("all");
    setDateFromText("");
    setDateToText("");
  }

  const dateFromStart = useMemo(() => parseDdMmYyyy(dateFromText), [dateFromText]);
  // "To" is a whole calendar day, so a vendor created any time on that day
  // should still match rather than only up to midnight.
  const dateToInclusive = useMemo(() => {
    const parsed = parseDdMmYyyy(dateToText);
    if (!parsed) return null;
    parsed.setHours(23, 59, 59, 999);
    return parsed;
  }, [dateToText]);
  // Only flag as invalid once the reviewer has typed a full 8 digits (the
  // "dd-mm-yyyy" mask reaches its full 10 characters) - anything shorter is
  // just "not finished typing yet", not wrong.
  const dateFromInvalid = dateFromText.length === 10 && dateFromStart === null;
  const dateToInvalid = dateToText.length === 10 && dateToInclusive === null;

  const filteredVendors = useMemo(() => {
    if (!vendors) return [];
    return vendors.filter((vendor) => {
      if (statusFilter !== "all" && vendor.status !== statusFilter) return false;

      if (riskFilter !== "all") {
        const tier: RiskTier = riskByVendorId.get(vendor.id)?.tier ?? "unassessed";
        if (tier !== riskFilter) return false;
      }

      const createdAt = new Date(vendor.createdAt);
      if (dateFromStart && createdAt < dateFromStart) return false;
      if (dateToInclusive && createdAt > dateToInclusive) return false;

      return true;
    });
  }, [vendors, statusFilter, riskFilter, dateFromStart, dateToInclusive, riskByVendorId]);

  // Highest risk first once filtered - the vendors most worth a reviewer's
  // attention should surface first when the list is capped. A vendor with no
  // triage findings yet (score === null) sorts last, not first: it isn't
  // "low risk", it's unscored, so it shouldn't crowd out ones that actually
  // need review.
  const sortedVendors = useMemo(() => {
    return [...filteredVendors].sort((a, b) => {
      const scoreA = riskByVendorId.get(a.id)?.score ?? null;
      const scoreB = riskByVendorId.get(b.id)?.score ?? null;
      if (scoreA === null && scoreB === null) return 0;
      if (scoreA === null) return 1;
      if (scoreB === null) return -1;
      return scoreB - scoreA;
    });
  }, [filteredVendors, riskByVendorId]);

  const displayedVendors = sortedVendors.slice(0, MAX_RESULTS);
  const hiddenCount = sortedVendors.length - displayedVendors.length;

  function handleConfirmDelete(vendorId: string) {
    deleteVendor.mutate(vendorId, {
      onSuccess: () => setPendingDeleteId(null),
    });
  }

  function handleCreate() {
    if (!companyName.trim()) return;
    createVendor.mutate(companyName.trim(), {
      onSuccess: (vendor) => {
        setIsCreating(false);
        setCompanyName("");
        navigate(`/vendor/${vendor.id}/intake`);
      },
    });
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-5">
      <WelcomeBanner userName={CURRENT_USER_NAME} />

      <DashboardOverview />

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <NetworkGraph />
        </div>
        <div id="risk" className="grid min-w-0 gap-5 sm:grid-cols-2 xl:grid-cols-1">
          {overview ? (
            <>
              <RiskExposureCard risk={overview.risk} />
              <RecentAlertsCard alerts={overview.alerts} />
            </>
          ) : (
            <>
              <div className="card-elevated h-56 animate-pulse bg-muted/40" />
              <div className="card-elevated h-56 animate-pulse bg-muted/40" />
            </>
          )}
        </div>
      </div>

      <div className="card-elevated overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-4">
          <div>
            <h3 className="text-sm font-bold">Vendors</h3>
            <p className="text-[11px] text-muted-foreground">
              Select a vendor to continue their KYV review, or start a new intake.
            </p>
          </div>
          {!isCreating && (
            <Button size="sm" onClick={() => setIsCreating(true)}>
              <Plus className="mr-1 h-4 w-4" />
              New Vendor
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3 border-t border-border px-5 py-3">
          <div>
            <label htmlFor="vendor-status-filter" className="mb-1 block text-[11px] font-medium text-muted-foreground">
              Status
            </label>
            <select
              id="vendor-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 rounded-lg border border-input bg-background px-2 text-xs font-medium outline-none transition-colors focus:border-brand/40 focus:ring-2 focus:ring-brand/[0.15]"
            >
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="vendor-risk-filter" className="mb-1 block text-[11px] font-medium text-muted-foreground">
              Risk score
            </label>
            <select
              id="vendor-risk-filter"
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="h-8 rounded-lg border border-input bg-background px-2 text-xs font-medium outline-none transition-colors focus:border-brand/40 focus:ring-2 focus:ring-brand/[0.15]"
            >
              {RISK_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="vendor-date-from" className="mb-1 block text-[11px] font-medium text-muted-foreground">
              Created from
            </label>
            <DatePickerInput
              id="vendor-date-from"
              value={dateFromText}
              onChange={setDateFromText}
              invalid={dateFromInvalid}
              maxDate={dateToInclusive}
              className="h-8 w-[8.5rem] text-xs"
            />
          </div>

          <div>
            <label htmlFor="vendor-date-to" className="mb-1 block text-[11px] font-medium text-muted-foreground">
              Created to
            </label>
            <DatePickerInput
              id="vendor-date-to"
              value={dateToText}
              onChange={setDateToText}
              invalid={dateToInvalid}
              minDate={dateFromStart}
              className="h-8 w-[8.5rem] text-xs"
            />
          </div>
          {(dateFromInvalid || dateToInvalid) && (
            <p className="self-center text-[11px] text-destructive">Use dd-mm-yyyy</p>
          )}

          {hasActiveFilters && (
            <Button size="sm" variant="ghost" onClick={clearFilters} className="h-8">
              <X className="mr-1 h-3.5 w-3.5" />
              Clear filters
            </Button>
          )}

          {!isLoading && !isError && vendors && vendors.length > 0 && (
            <p className="ml-auto text-[11px] text-muted-foreground">
              {hasActiveFilters ? (
                <>
                  {sortedVendors.length} of {vendors.length} vendors match
                  {hiddenCount > 0 && <> — showing top {displayedVendors.length} by risk score</>}
                </>
              ) : (
                hiddenCount > 0 && (
                  <>Showing top {displayedVendors.length} of {sortedVendors.length} by risk score</>
                )
              )}
            </p>
          )}
        </div>

        {isCreating && (
          <div className="mx-5 mb-3 flex items-center gap-2 rounded-lg border border-border p-3">
            <Input
              autoFocus
              placeholder="Company name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") setIsCreating(false);
              }}
            />
            <Button size="sm" disabled={createVendor.isPending || !companyName.trim()} onClick={handleCreate}>
              {createVendor.isPending ? "Creating..." : "Create"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsCreating(false)}>
              Cancel
            </Button>
          </div>
        )}
        {createVendor.isError && (
          <p className="mx-5 mb-2 text-xs text-destructive">{createVendor.error.message}</p>
        )}
        {deleteVendor.isError && (
          <p className="mx-5 mb-2 text-xs text-destructive">{deleteVendor.error.message}</p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-y border-border bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-2.5 font-semibold">Company Name</th>
                <th className="px-4 py-2.5 font-semibold">Registration No.</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Risk Score</th>
                <th className="px-4 py-2.5 font-semibold">Created</th>
                <th className="px-5 py-2.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td className="px-5 py-6 text-muted-foreground" colSpan={6}>
                    Loading vendors...
                  </td>
                </tr>
              )}
              {isError && (
                <tr>
                  <td className="px-5 py-6 text-destructive" colSpan={6}>
                    Could not reach the backend API.
                  </td>
                </tr>
              )}
              {!isLoading && !isError && vendors?.length === 0 && (
                <tr>
                  <td className="px-5 py-6 text-muted-foreground" colSpan={6}>
                    No vendors yet.
                  </td>
                </tr>
              )}
              {!isLoading && !isError && vendors && vendors.length > 0 && displayedVendors.length === 0 && (
                <tr>
                  <td className="px-5 py-6 text-muted-foreground" colSpan={6}>
                    No vendors match these filters.{" "}
                    <button type="button" className="font-medium text-brand hover:underline" onClick={clearFilters}>
                      Clear filters
                    </button>
                  </td>
                </tr>
              )}
              {displayedVendors.map((vendor) => {
                const status = STATUS_BADGE[vendor.status] ?? STATUS_BADGE.draft;
                return (
                  <tr
                    key={vendor.id}
                    className="border-b border-border transition-colors last:border-0 hover:bg-brand/[0.06]"
                  >
                    <td className="px-5 py-3 font-semibold">{vendor.companyName}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {vendor.registrationNo ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge dot variant={status.variant}>
                        {status.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <RiskCell risk={riskByVendorId.get(vendor.id)} />
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {formatDate(vendor.createdAt)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {pendingDeleteId === vendor.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-muted-foreground">Delete vendor?</span>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={deleteVendor.isPending}
                            onClick={() => handleConfirmDelete(vendor.id)}
                          >
                            {deleteVendor.isPending ? "Deleting..." : "Confirm"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={deleteVendor.isPending}
                            onClick={() => setPendingDeleteId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-4">
                          <Link
                            className="text-sm font-semibold text-brand hover:underline"
                            to={`/vendor/${vendor.id}`}
                          >
                            Open
                          </Link>
                          <button
                            type="button"
                            className="text-sm font-medium text-muted-foreground transition-colors hover:text-destructive"
                            onClick={() => setPendingDeleteId(vendor.id)}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
