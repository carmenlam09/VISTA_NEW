import { useEffect, useState } from "react";

import { FieldLabel } from "@/components/intake/FieldLabel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { type NetrevealUpdateInput, useUpdateNetrevealRecord } from "@/hooks/useScreeningMutations";
import { cn } from "@/lib/utils";
import type { NetrevealRecord } from "@/types/screening";

import { SubjectBadge } from "./SubjectBadge";

// Set from the Triage queue (Module 4) - shown here too so a decision made
// there is visible back in its original module.
const RISK_DECISION_BADGE = {
  pending: { variant: "warning" as const, label: "Triage: Pending" },
  relevant: { variant: "destructive" as const, label: "Triage: Relevant" },
  false_positive: { variant: "secondary" as const, label: "Triage: False Positive" },
};

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
  const [savedForm, setSavedForm] = useState<NetrevealUpdateInput>(() => toForm(record));
  const updateNetreveal = useUpdateNetrevealRecord(vendorId);
  const hasWatchHit = Boolean(record.watchpersonDetails?.trim());
  const verified = record.isVerified;
  // Once verified, only re-enable the button if the reviewer edits something new.
  const isDirty = JSON.stringify(form) !== JSON.stringify(savedForm);
  const canSave = !verified || isDirty;

  // This card is created immediately on upload (fields still blank) and kept
  // mounted (same key) while extraction runs in the background - resync the
  // form whenever the underlying record's fields actually change (extraction
  // filling them in, or a save elsewhere), so this card doesn't keep showing
  // its stale blank initial state once real data arrives.
  useEffect(() => {
    const next = toForm(record);
    setForm(next);
    setSavedForm(next);
  }, [
    record.dobDoi,
    record.nationality,
    record.checkName,
    record.uid,
    record.watchpersonDetails,
  ]);

  function set<K extends keyof NetrevealUpdateInput>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value === "" ? null : value }));
  }

  function save() {
    updateNetreveal.mutate(
      { recordId: record.id, input: form },
      { onSuccess: () => setSavedForm(form) }
    );
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
        <div className="flex items-center gap-2">
          <Badge variant={RISK_DECISION_BADGE[record.riskDecision].variant}>
            {RISK_DECISION_BADGE[record.riskDecision].label}
          </Badge>
          {verified ? (
            <Badge variant="success">Verified</Badge>
          ) : (
            <Badge variant="warning">Needs review</Badge>
          )}
        </div>
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
        <Button size="sm" disabled={updateNetreveal.isPending || !canSave} onClick={save}>
          {updateNetreveal.isPending ? "Saving..." : "Confirm & Save"}
        </Button>
      </div>
    </div>
  );
}
