import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type TradeReferenceInput,
  useDeleteTradeReference,
  useUpdateTradeReference,
} from "@/hooks/useScreeningMutations";
import type { CtosTradeReference } from "@/types/screening";

import { SubjectBadge } from "./SubjectBadge";

export function TradeReferencesTable({
  vendorId,
  items,
  showSubjectBadge = true,
}: {
  vendorId: string;
  items: CtosTradeReference[];
  /** Omit when items are already scoped to a single, known enquiry (e.g. inside the upload-review modal) */
  showSubjectBadge?: boolean;
}) {
  const [edits, setEdits] = useState<Record<string, Partial<TradeReferenceInput>>>({});
  const updateTradeReference = useUpdateTradeReference(vendorId);
  const deleteTradeReference = useDeleteTradeReference(vendorId);

  const unverifiedCount = items.filter((r) => !r.isVerified).length;

  function setEdit(id: string, patch: Partial<TradeReferenceInput>) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function saveRow(item: CtosTradeReference) {
    const patch = edits[item.id];
    if (!patch) return;
    updateTradeReference.mutate(
      { ctosEnquiryId: item.ctosEnquiryId, refId: item.id, input: patch },
      { onSuccess: () => setEdits((prev) => ({ ...prev, [item.id]: {} })) }
    );
  }

  function confirmAll() {
    Promise.all(
      items
        .filter((r) => !r.isVerified)
        .map((r) =>
          updateTradeReference.mutateAsync({
            ctosEnquiryId: r.ctosEnquiryId,
            refId: r.id,
            input: { is_verified: true },
          })
        )
    );
  }

  return (
    <section className="rounded-lg border border-border p-4">
      <h2 className="mb-3 text-sm font-semibold">Trade References</h2>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No trade references found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                {showSubjectBadge && <th className="pb-2 pr-2 font-medium">Subject</th>}
                <th className="pb-2 pr-2 font-medium">Referee</th>
                <th className="pb-2 pr-2 font-medium">Account No.</th>
                <th className="pb-2 pr-2 font-medium">Capacity</th>
                <th className="pb-2 pr-2 font-medium">Default Amount</th>
                <th className="pb-2 pr-2 font-medium" />
                <th className="pb-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const edit = edits[item.id];
                const hasEdit = edit && Object.keys(edit).length > 0;
                return (
                  <tr key={item.id} className="border-t border-border">
                    {showSubjectBadge && (
                      <td className="py-1.5 pr-2">
                        {item.ctosEnquiry && (
                          <SubjectBadge
                            subjectType={item.ctosEnquiry.subjectType}
                            subjectName={item.ctosEnquiry.subjectName}
                          />
                        )}
                      </td>
                    )}
                    <td className="py-1.5 pr-2">
                      <Input
                        value={edit?.referee ?? item.referee ?? ""}
                        onChange={(e) => setEdit(item.id, { referee: e.target.value || null })}
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <Input
                        value={edit?.account_no ?? item.accountNo ?? ""}
                        onChange={(e) => setEdit(item.id, { account_no: e.target.value || null })}
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <Input
                        value={edit?.capacity ?? item.capacity ?? ""}
                        onChange={(e) => setEdit(item.id, { capacity: e.target.value || null })}
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <Input
                        type="number"
                        value={edit?.default_amount ?? item.defaultAmount ?? ""}
                        onChange={(e) =>
                          setEdit(item.id, {
                            default_amount: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      {!item.isVerified && <Badge variant="warning">AI-extracted</Badge>}
                    </td>
                    <td className="py-1.5 whitespace-nowrap">
                      {hasEdit && (
                        <Button size="sm" variant="outline" onClick={() => saveRow(item)}>
                          Save
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          deleteTradeReference.mutate({
                            ctosEnquiryId: item.ctosEnquiryId,
                            refId: item.id,
                          })
                        }
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-3 flex justify-end">
          <Button
            size="sm"
            disabled={unverifiedCount === 0 || updateTradeReference.isPending}
            onClick={confirmAll}
          >
            {updateTradeReference.isPending ? "Saving..." : "Confirm & Save"}
          </Button>
        </div>
      )}
    </section>
  );
}
