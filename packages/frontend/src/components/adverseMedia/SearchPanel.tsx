import { useState } from "react";

import { SubjectCheckboxList } from "@/components/adverseMedia/SubjectCheckboxList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRunAdverseMediaSearch } from "@/hooks/useAdverseMediaMutations";
import { useKeywordLibrary } from "@/hooks/useKeywordLibrary";
import { useSubjects } from "@/hooks/useSubjects";

export function SearchPanel({ vendorId }: { vendorId: string }) {
  // One, several, or every subject - the reviewer checks whichever they want.
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<string>>(new Set());
  const { data: subjects } = useSubjects(vendorId);
  const { data: activeKeywords } = useKeywordLibrary({ is_active: true });
  // Nothing pre-checked - the reviewer opts in to whichever keywords they want.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [extraKeywordsText, setExtraKeywordsText] = useState("");
  const runSearch = useRunAdverseMediaSearch(vendorId);

  function toggleKeyword(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const extraKeywords = extraKeywordsText
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const keywordCount = selectedIds.size + extraKeywords.length;
  const hasSubject = selectedSubjectIds.size > 0;
  const canSearch = hasSubject && keywordCount > 0;

  // Each subject-keyword pair is one paid SERP call, so a multi-subject run
  // is worth showing the reviewer before they trigger it.
  const subjectCount = selectedSubjectIds.size;
  const plannedQueries = subjectCount * keywordCount;

  function handleRunSearch() {
    if (!canSearch || !subjects) return;

    const selectedSubjects = subjects.filter((s) => selectedSubjectIds.has(s.id));
    if (selectedSubjects.length === 0) return;

    runSearch.mutate({
      subjects: selectedSubjects.map((s) => ({
        subject_type: s.type,
        related_director_id: s.type === "director" ? s.id : undefined,
        related_shareholder_id: s.type === "shareholder" ? s.id : undefined,
      })),
      keyword_ids: Array.from(selectedIds),
      extra_keywords: extraKeywords.length > 0 ? extraKeywords : undefined,
    });
  }

  const result = runSearch.data;
  const articleCount = result?.articles?.length ?? 0;

  return (
    <section className="rounded-lg border border-border p-4">
      <h2 className="mb-3 text-sm font-semibold">Search</h2>
      <div className="space-y-3">
        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">Subject</div>
          <SubjectCheckboxList
            vendorId={vendorId}
            selectedIds={selectedSubjectIds}
            onChange={setSelectedSubjectIds}
          />
          {subjectCount > 1 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Searches each selected subject separately, one search per subject.
            </p>
          )}
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
                    checked={selectedIds.has(k.id)}
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

        {runSearch.isError && <p className="text-xs text-destructive">{runSearch.error.message}</p>}
        {runSearch.isSuccess && result && (
          <p className="text-xs text-muted-foreground">
            Found {articleCount} new article{articleCount === 1 ? "" : "s"}
            {result.subjectsSearched ? ` across ${result.subjectsSearched} subjects` : ""}
            {result.duplicatesSkipped
              ? ` - skipped ${result.duplicatesSkipped} already saved for this vendor`
              : ""}
            .
            {result.failedSubjects && result.failedSubjects.length > 0 && (
              <span className="text-destructive">
                {" "}
                Search failed for {result.failedSubjects.join(", ")}.
              </span>
            )}
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          {hasSubject && keywordCount === 0 && (
            <p className="text-xs text-muted-foreground">
              Select at least one keyword, or enter an extra keyword above.
            </p>
          )}
          {canSearch && subjectCount > 1 && (
            <p className="text-xs text-muted-foreground">
              {plannedQueries} queries across {subjectCount} subjects
            </p>
          )}
          <Button disabled={!canSearch || runSearch.isPending} onClick={handleRunSearch}>
            {runSearch.isPending
              ? subjectCount > 1
                ? `Searching ${subjectCount} subjects...`
                : "Searching..."
              : "Run Search"}
          </Button>
        </div>
      </div>
    </section>
  );
}
