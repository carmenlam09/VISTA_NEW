import { useEffect, useState } from "react";

import { SubjectPicker } from "@/components/screening/SubjectPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRunAdverseMediaSearch } from "@/hooks/useAdverseMediaMutations";
import { useKeywordLibrary } from "@/hooks/useKeywordLibrary";
import type { Subject } from "@/types/screening";

export function SearchPanel({ vendorId }: { vendorId: string }) {
  const [subject, setSubject] = useState<Subject | null>(null);
  const { data: activeKeywords } = useKeywordLibrary({ is_active: true });
  const [selectedIds, setSelectedIds] = useState<Set<string> | null>(null);
  const [extraKeywordsText, setExtraKeywordsText] = useState("");
  const runSearch = useRunAdverseMediaSearch(vendorId);

  // Pre-check every active keyword by default, once - so later refetches
  // (e.g. after running a search) don't clobber the reviewer's edits.
  useEffect(() => {
    if (activeKeywords && selectedIds === null) {
      setSelectedIds(new Set(activeKeywords.map((k) => k.id)));
    }
  }, [activeKeywords, selectedIds]);

  function toggleKeyword(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleRunSearch() {
    if (!subject) return;
    const extraKeywords = extraKeywordsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    runSearch.mutate({
      subject_type: subject.type,
      related_director_id: subject.type === "director" ? subject.id : undefined,
      related_shareholder_id: subject.type === "shareholder" ? subject.id : undefined,
      keyword_ids: selectedIds ? Array.from(selectedIds) : undefined,
      extra_keywords: extraKeywords.length > 0 ? extraKeywords : undefined,
    });
  }

  return (
    <section className="rounded-lg border border-border p-4">
      <h2 className="mb-3 text-sm font-semibold">Search</h2>
      <div className="space-y-3">
        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">Subject</div>
          <SubjectPicker vendorId={vendorId} value={subject?.id ?? ""} onChange={setSubject} />
        </div>

        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">Keywords</div>
          {!activeKeywords || activeKeywords.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No active keywords in the library yet - add some via Manage Keywords, or just use
              extra keywords below.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {activeKeywords.map((k) => (
                <label
                  key={k.id}
                  className="flex items-center gap-1.5 rounded-full border border-input px-2.5 py-1 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds?.has(k.id) ?? false}
                    onChange={() => toggleKeyword(k.id)}
                  />
                  {k.keyword}
                </label>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">
            Extra keywords (comma-separated)
          </div>
          <Input
            placeholder="e.g. embezzlement, insider trading"
            value={extraKeywordsText}
            onChange={(e) => setExtraKeywordsText(e.target.value)}
          />
        </div>

        {runSearch.isError && (
          <p className="text-xs text-destructive">{runSearch.error.message}</p>
        )}

        <div className="flex justify-end">
          <Button disabled={!subject || runSearch.isPending} onClick={handleRunSearch}>
            {runSearch.isPending ? "Searching..." : "Run Search"}
          </Button>
        </div>
      </div>
    </section>
  );
}
