import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type DirectorInput,
  useCreateDirector,
  useDeleteDirector,
  useUpdateDirector,
} from "@/hooks/useVendorMutations";
import type { SsmDirector } from "@/types/vendor";

interface DraftRow extends DirectorInput {
  tempId: string;
}

const emptyDraft = (): DraftRow => ({
  tempId: crypto.randomUUID(),
  name: "",
  ic_passport_no: null,
  designation: null,
});

export function DirectorsSection({
  vendorId,
  directors,
}: {
  vendorId: string;
  directors: SsmDirector[];
}) {
  const [edits, setEdits] = useState<Record<string, Partial<DirectorInput>>>({});
  const [drafts, setDrafts] = useState<DraftRow[]>([]);

  const createDirector = useCreateDirector(vendorId);
  const updateDirector = useUpdateDirector(vendorId);
  const deleteDirector = useDeleteDirector(vendorId);

  const unverifiedCount = directors.filter((d) => !d.isVerified).length;
  const sectionVerified = directors.length === 0 || unverifiedCount === 0;

  function setEdit(id: string, patch: Partial<DirectorInput>) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function saveRow(director: SsmDirector) {
    const patch = edits[director.id];
    if (!patch) return;
    updateDirector.mutate(
      { directorId: director.id, input: patch },
      { onSuccess: () => setEdits((prev) => ({ ...prev, [director.id]: {} })) }
    );
  }

  function saveDraft(draft: DraftRow) {
    createDirector.mutate(
      { name: draft.name, ic_passport_no: draft.ic_passport_no, designation: draft.designation },
      { onSuccess: () => setDrafts((prev) => prev.filter((d) => d.tempId !== draft.tempId)) }
    );
  }

  function confirmSection() {
    Promise.all(
      directors
        .filter((d) => !d.isVerified)
        .map((d) => updateDirector.mutateAsync({ directorId: d.id, input: { is_verified: true } }))
    );
  }

  return (
    <section className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Directors / Officers</h2>
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
              <th className="pb-2 pr-2 font-medium">Name</th>
              <th className="pb-2 pr-2 font-medium">IC/Passport No.</th>
              <th className="pb-2 pr-2 font-medium">Designation</th>
              <th className="pb-2 pr-2 font-medium" />
              <th className="pb-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {directors.map((director) => {
              const edit = edits[director.id];
              const hasEdit = edit && Object.keys(edit).length > 0;
              return (
                <tr key={director.id} className="border-t border-border">
                  <td className="py-1.5 pr-2">
                    <Input
                      value={edit?.name ?? director.name}
                      onChange={(e) => setEdit(director.id, { name: e.target.value })}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <Input
                      value={edit?.ic_passport_no ?? director.icPassportNo ?? ""}
                      onChange={(e) =>
                        setEdit(director.id, { ic_passport_no: e.target.value || null })
                      }
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <Input
                      value={edit?.designation ?? director.designation ?? ""}
                      onChange={(e) =>
                        setEdit(director.id, { designation: e.target.value || null })
                      }
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    {!director.isVerified && <Badge variant="warning">AI-extracted</Badge>}
                  </td>
                  <td className="py-1.5 whitespace-nowrap">
                    {hasEdit && (
                      <Button size="sm" variant="outline" onClick={() => saveRow(director)}>
                        Save
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteDirector.mutate(director.id)}
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
                    value={draft.ic_passport_no ?? ""}
                    onChange={(e) =>
                      setDrafts((prev) =>
                        prev.map((d) =>
                          d.tempId === draft.tempId
                            ? { ...d, ic_passport_no: e.target.value || null }
                            : d
                        )
                      )
                    }
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <Input
                    value={draft.designation ?? ""}
                    onChange={(e) =>
                      setDrafts((prev) =>
                        prev.map((d) =>
                          d.tempId === draft.tempId
                            ? { ...d, designation: e.target.value || null }
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
                    disabled={!draft.name || createDirector.isPending}
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
        {directors.length === 0 && drafts.length === 0 && (
          <p className="py-2 text-xs text-muted-foreground">No directors added yet.</p>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <Button size="sm" variant="outline" onClick={() => setDrafts((prev) => [...prev, emptyDraft()])}>
          Add director
        </Button>
        <Button size="sm" disabled={sectionVerified || updateDirector.isPending} onClick={confirmSection}>
          {updateDirector.isPending ? "Saving..." : "Confirm & Save"}
        </Button>
      </div>
    </section>
  );
}
