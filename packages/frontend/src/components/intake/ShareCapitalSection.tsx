import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUpdateShareCapital } from "@/hooks/useVendorMutations";
import type { SsmShareCapital } from "@/types/vendor";

import { FieldLabel } from "./FieldLabel";

export function ShareCapitalSection({
  vendorId,
  shareCapital,
}: {
  vendorId: string;
  shareCapital: SsmShareCapital | null;
}) {
  const [value, setValue] = useState(shareCapital?.paidUpCapital ?? "");
  const updateShareCapital = useUpdateShareCapital(vendorId);
  const verified = shareCapital?.isVerified ?? false;

  return (
    <section className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Summary of Share Capital</h2>
        {verified ? (
          <Badge variant="success">Verified</Badge>
        ) : (
          <Badge variant="warning">Needs review</Badge>
        )}
      </div>

      <div className="max-w-xs">
        <FieldLabel text="Paid Up Capital (Total Shared)" aiExtracted={!verified} />
        <Input
          type="number"
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>

      {updateShareCapital.isError && (
        <p className="mt-2 text-xs text-destructive">{updateShareCapital.error.message}</p>
      )}

      <div className="mt-3 flex justify-end">
        <Button
          size="sm"
          disabled={updateShareCapital.isPending}
          onClick={() =>
            updateShareCapital.mutate({
              paid_up_capital: value === "" ? null : Number(value),
            })
          }
        >
          {updateShareCapital.isPending ? "Saving..." : "Confirm & Save"}
        </Button>
      </div>
    </section>
  );
}
