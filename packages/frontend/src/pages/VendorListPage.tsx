import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { NetworkGraph } from "@/components/dashboard/NetworkGraph";
import { RecentAlertsCard } from "@/components/dashboard/RecentAlertsCard";
import { RiskExposureCard } from "@/components/dashboard/RiskExposureCard";
import { WelcomeBanner } from "@/components/dashboard/WelcomeBanner";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDashboardOverview } from "@/hooks/useDashboardOverview";
import { useVendors } from "@/hooks/useVendors";
import { useCreateVendor, useDeleteVendor } from "@/hooks/useVendorMutations";
import { RISK_TIERS } from "@/lib/risk";
import type { VendorRisk } from "@/types/overview";

const STATUS_BADGE: Record<string, { variant: BadgeProps["variant"]; label: string }> = {
  draft: { variant: "secondary", label: "Draft" },
  in_review: { variant: "warning", label: "In Review" },
  approved: { variant: "success", label: "Approved" },
  rejected: { variant: "destructive", label: "Rejected" },
};

// Stubbed auth (CLAUDE.md §2) - matches the reviewer the backend attributes to.
const CURRENT_USER_NAME = "Default Reviewer";

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

  const riskByVendorId = useMemo(
    () => new Map((overview?.risk.byVendor ?? []).map((v) => [v.vendorId, v])),
    [overview]
  );

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
              {vendors?.map((vendor) => {
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
                      {new Date(vendor.createdAt).toLocaleDateString()}
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
