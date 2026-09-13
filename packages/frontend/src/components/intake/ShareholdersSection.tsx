import { forwardRef, useImperativeHandle, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type ShareholderInput,
  useCreateShareholder,
  useDeleteShareholder,
  useUpdateShareholder,
} from "@/hooks/useVendorMutations";
import type { SsmShareholder } from "@/types/vendor";

import type { ConfirmableSectionHandle } from "./CorporateInfoSection";

interface DraftRow extends ShareholderInput {
  tempId: string;
}

const emptyDraft = (): DraftRow => ({
  tempId: crypto.randomUUID(),
  name: "",
  ic_passport_registration_no: null,
  total_shares: null,
});

export const ShareholdersSection = forwardRef<
  ConfirmableSectionHandle,
  { vendorId: string; shareholders: SsmShareholder[] }
>(function ShareholdersSection({ vendorId, shareholders }, ref) {
  const [edits, setEdits] = useState<Record<string, Partial<ShareholderInput>>>({});
  const [drafts, setDrafts] = useState<DraftRow[]>([]);

  const createShareholder = useCreateShareholder(vendorId);
  const updateShareholder = useUpdateShareholder(vendorId);
  const deleteShareholder = useDeleteShareholder(vendorId);

  const unverifiedCount = shareholders.filter((s) => !s.isVerified).length;
  const sectionVerified = shareholders.length === 0 || unverifiedCount === 0;

  useImperativeHandle(ref, () => ({ confirmAll: confirmSection }));

  function setEdit(id: string, patch: Partial<ShareholderInput>) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function saveRow(shareholder: SsmShareholder) {
    const patch = edits[shareholder.id];
    if (!patch) return;
    updateShareholder.mutate(
      { shareholderId: shareholder.id, input: patch },
      { onSuccess: () => setEdits((prev) => ({ ...prev, [shareholder.id]: {} })) }
    );
  }

  function saveDraft(draft: DraftRow) {
    createShareholder.mutate(
      {
        name: draft.name,
        ic_passport_registration_no: draft.ic_passport_registration_no,
        total_shares: draft.total_shares,
      },
      { onSuccess: () => setDrafts((prev) => prev.filter((d) => d.tempId !== draft.tempId)) }
    );
  }

  function confirmSection() {
    Promise.all(
      shareholders
        .filter((s) => !s.isVerified)
        .map((s) =>
          updateShareholder.mutateAsync({ shareholderId: s.id, input: { is_verified: true } })
        )
    );
  }

  return (
    <section className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Shareholders / Members</h2>
        {sectionVerified ? (
          <Badge variant="success">Verified</Badge>
        ) : (
          <Badge variant="warning">Needs review</Badge>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="pb-2 pr-2 font-medium">IC/Passport/Registration No.</th>
              <th className="pb-2 pr-2 font-medium">Name</th>
              <th className="pb-2 pr-2 font-medium">Total Shares</th>
              <th className="pb-2 pr-2 font-medium" />
              <th className="pb-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {shareholders.map((shareholder) => {
              const edit = edits[shareholder.id];
              const hasEdit = edit && Object.keys(edit).length > 0;
              return (
                <tr key={shareholder.id} className="border-t border-border">
                  <td className="py-1.5 pr-2">
                    <Input
                      value={
                        edit?.ic_passport_registration_no ??
                        shareholder.icPassportRegistrationNo ??
                        ""
                      }
                      onChange={(e) =>
                        setEdit(shareholder.id, {
                          ic_passport_registration_no: e.target.value || null,
                        })
                      }
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <Input
                      value={edit?.name ?? shareholder.name}
                      onChange={(e) => setEdit(shareholder.id, { name: e.target.value })}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <Input
                      type="number"
                      value={edit?.total_shares ?? shareholder.totalShares ?? ""}
                      onChange={(e) =>
                        setEdit(shareholder.id, {
                          total_shares: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    {!shareholder.isVerified && <Badge variant="warning">AI-extracted</Badge>}
                  </td>
                  <td className="py-1.5 whitespace-nowrap">
                    {hasEdit && (
                      <Button size="sm" variant="outline" onClick={() => saveRow(shareholder)}>
                        Save
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteShareholder.mutate(shareholder.id)}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              );
            })}
            {drafts.map((draft) => (
              <tr key={draft.tempId} className="border-t border-border">
                <td className="py-1.5 pr-2">
                  <Input
                    value={draft.ic_passport_registration_no ?? ""}
                    onChange={(e) =>
                      setDrafts((prev) =>
                        prev.map((d) =>
                          d.tempId === draft.tempId
                            ? { ...d, ic_passport_registration_no: e.target.value || null }
                            : d
                        )
                      )
                    }
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <Input
                    value={draft.name}
                    onChange={(e) =>
                      setDrafts((prev) =>
                        prev.map((d) =>
                          d.tempId === draft.tempId ? { ...d, name: e.target.value } : d
                        )
                      )
                    }
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <Input
                    type="number"
                    value={draft.total_shares ?? ""}
                    onChange={(e) =>
                      setDrafts((prev) =>
                        prev.map((d) =>
                          d.tempId === draft.tempId
                            ? {
                                ...d,
                                total_shares: e.target.value === "" ? null : Number(e.target.value),
                              }
                            : d
                        )
                      )
                    }
                  />
                </td>
                <td className="py-1.5 pr-2" />
                <td className="py-1.5 whitespace-nowrap">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!draft.name || createShareholder.isPending}
                    onClick={() => saveDraft(draft)}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDrafts((prev) => prev.filter((d) => d.tempId !== draft.tempId))}
                  >
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shareholders.length === 0 && drafts.length === 0 && (
          <p className="py-2 text-xs text-muted-foreground">No shareholders added yet.</p>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <Button size="sm" variant="outline" onClick={() => setDrafts((prev) => [...prev, emptyDraft()])}>
          Add shareholder
        </Button>
        <Button
          size="sm"
          disabled={sectionVerified || updateShareholder.isPending}
          onClick={confirmSection}
        >
          {updateShareholder.isPending ? "Saving..." : "Confirm & Save"}
        </Button>
      </div>
    </section>
  );
});
