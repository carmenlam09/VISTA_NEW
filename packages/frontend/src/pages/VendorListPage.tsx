import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { NetworkGraph } from "@/components/dashboard/NetworkGraph";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVendors } from "@/hooks/useVendors";
import { useCreateVendor, useDeleteVendor } from "@/hooks/useVendorMutations";

const STATUS_BADGE: Record<string, { variant: BadgeProps["variant"]; label: string }> = {
  draft: { variant: "secondary", label: "Draft" },
  in_review: { variant: "warning", label: "In Review" },
  approved: { variant: "success", label: "Approved" },
  rejected: { variant: "destructive", label: "Rejected" },
};

export function VendorListPage() {
  const { data: vendors, isLoading, isError } = useVendors();
  const createVendor = useCreateVendor();
  const deleteVendor = useDeleteVendor();
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

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
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <div className="mb-2 h-1 w-12 rounded-full bg-brand" />
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          An overview of vendor risk screening activity across VISTA.
        </p>
      </div>

      <DashboardOverview />

      <div className="border-t border-border pt-6">
        <div aria-hidden="true" className="mb-2 h-1 w-8 rounded-full bg-brand" />
        <h2 className="text-base font-semibold">Vendor Network</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          How companies, directors, and shareholders connect across your portfolio. Drag nodes to
          rearrange, click one to see its details.
        </p>
        <NetworkGraph />
      </div>

      <div className="flex items-center justify-between border-t border-border pt-6">
        <div>
          <div aria-hidden="true" className="mb-2 h-1 w-8 rounded-full bg-brand" />
          <h2 className="text-base font-semibold">Vendors</h2>
          <p className="text-sm text-muted-foreground">
            Select a vendor to continue their KYV review, or start a new intake.
          </p>
        </div>
        {!isCreating && <Button onClick={() => setIsCreating(true)}>New Vendor</Button>}
      </div>

      {isCreating && (
        <div className="flex items-center gap-2 rounded-lg border border-border p-3">
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
        <p className="text-xs text-destructive">{createVendor.error.message}</p>
      )}
      {deleteVendor.isError && (
        <p className="text-xs text-destructive">{deleteVendor.error.message}</p>
      )}

      <div className="card-elevated overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Company Name</th>
              <th className="px-4 py-3 font-medium">Registration No.</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={5}>
                  Loading vendors...
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td className="px-4 py-6 text-destructive" colSpan={5}>
                  Could not reach the backend API.
                </td>
              </tr>
            )}
            {!isLoading && !isError && vendors?.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={5}>
                  No vendors yet.
                </td>
              </tr>
            )}
            {vendors?.map((vendor) => (
              <tr
                key={vendor.id}
                className="border-b border-border transition-colors last:border-0 hover:bg-brand/[0.08]"
              >
                <td className="px-4 py-3 font-medium">{vendor.companyName}</td>
                <td className="px-4 py-3 text-muted-foreground">{vendor.registrationNo ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge dot variant={(STATUS_BADGE[vendor.status] ?? STATUS_BADGE.draft).variant}>
                    {(STATUS_BADGE[vendor.status] ?? STATUS_BADGE.draft).label}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {new Date(vendor.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
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
                        className="text-sm font-medium text-primary hover:underline"
                        to={`/vendor/${vendor.id}`}
                      >
                        Open
                      </Link>
                      <button
                        type="button"
                        className="text-sm font-medium text-destructive hover:underline"
                        onClick={() => setPendingDeleteId(vendor.id)}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
