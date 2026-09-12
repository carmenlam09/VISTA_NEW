import { useState } from "react";

import { FieldLabel } from "@/components/intake/FieldLabel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { type NetrevealUpdateInput, useUpdateNetrevealRecord } from "@/hooks/useScreeningMutations";
import { cn } from "@/lib/utils";
import type { NetrevealRecord } from "@/types/screening";

import { SubjectBadge } from "./SubjectBadge";

function toForm(record: NetrevealRecord): NetrevealUpdateInput {
  return {
    dob_doi: record.dobDoi?.slice(0, 10) ?? null,
    nationality: record.nationality,
    check_name: record.checkName,
    uid: record.uid,
    watchperson_details: record.watchpersonDetails,
  };
}

export function NetrevealCard({
  vendorId,
  record,
}: {
  vendorId: string;
  record: NetrevealRecord;
}) {
  const [form, setForm] = useState<NetrevealUpdateInput>(() => toForm(record));
  const updateNetreveal = useUpdateNetrevealRecord(vendorId);
  const hasWatchHit = Boolean(record.watchpersonDetails?.trim());
  const verified = record.isVerified;

  function set<K extends keyof NetrevealUpdateInput>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value === "" ? null : value }));
  }

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        hasWatchHit ? "border-border border-l-4 border-l-red-500" : "border-border"
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <SubjectBadge subjectType={record.subjectType} subjectName={record.subjectName} />
        {verified ? (
          <Badge variant="success">Verified</Badge>
        ) : (
          <Badge variant="warning">Needs review</Badge>
        )}
      </div>

      {hasWatchHit && (
        <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs font-medium text-red-800">
          ⚠ Watchlist details found for this subject — review carefully before proceeding.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <FieldLabel text="DOB / DOI" aiExtracted={!verified} />
          <Input
            type="date"
            value={form.dob_doi ?? ""}
            onChange={(e) => set("dob_doi", e.target.value)}
          />
        </div>
        <div>
          <FieldLabel text="Nationality" aiExtracted={!verified} />
          <Input value={form.nationality ?? ""} onChange={(e) => set("nationality", e.target.value)} />
        </div>
        <div>
          <FieldLabel text="Check Name" aiExtracted={!verified} />
          <Input value={form.check_name ?? ""} onChange={(e) => set("check_name", e.target.value)} />
        </div>
        <div>
          <FieldLabel text="UID" aiExtracted={!verified} />
          <Input value={form.uid ?? ""} onChange={(e) => set("uid", e.target.value)} />
        </div>
      </div>

      <div className="mt-3">
        <FieldLabel text="Watchperson Details" aiExtracted={!verified} />
        <Textarea
          value={form.watchperson_details ?? ""}
          onChange={(e) => set("watchperson_details", e.target.value)}
        />
      </div>

      {updateNetreveal.isError && (
        <p className="mt-2 text-xs text-destructive">{updateNetreveal.error.message}</p>
      )}

      <div className="mt-3 flex justify-end">
        <Button
          size="sm"
          disabled={updateNetreveal.isPending}
          onClick={() => updateNetreveal.mutate({ recordId: record.id, input: form })}
        >
          {updateNetreveal.isPending ? "Saving..." : "Confirm & Save"}
        </Button>
      </div>
    </div>
  );
}
