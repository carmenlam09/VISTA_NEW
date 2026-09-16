import { useState } from "react";

import { SubjectPicker } from "@/components/screening/SubjectPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRunAdverseMediaSearch } from "@/hooks/useAdverseMediaMutations";
import { useKeywordLibrary } from "@/hooks/useKeywordLibrary";
import { useSubjects } from "@/hooks/useSubjects";
import { ALL_SUBJECTS_ID, type Subject } from "@/types/screening";

export function SearchPanel({ vendorId }: { vendorId: string }) {
  const [subject, setSubject] = useState<Subject | null>(null);
  // Tracked separately from `subject` so the picker keeps its single-subject
  // contract - "all" is a mode, not a subject record.
  const [searchAll, setSearchAll] = useState(false);
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
  const hasSubject = searchAll || Boolean(subject);
  const canSearch = hasSubject && keywordCount > 0;

  // Each subject-keyword pair is one paid SERP call, so an "all" run is worth
  // showing the reviewer before they trigger it.
  const subjectCount = searchAll ? (subjects?.length ?? 0) : 1;
  const plannedQueries = subjectCount * keywordCount;

  function handleRunSearch() {
    if (!canSearch) return;

    if (searchAll) {
      runSearch.mutate({
        subject_type: "all",
        keyword_ids: Array.from(selectedIds),
        extra_keywords: extraKeywords.length > 0 ? extraKeywords : undefined,
      });
      return;
    }
    if (!subject) return;
    runSearch.mutate({
      subject_type: subject.type,
      related_director_id: subject.type === "director" ? subject.id : undefined,
      related_shareholder_id: subject.type === "shareholder" ? subject.id : undefined,
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
          <SubjectPicker
            vendorId={vendorId}
            includeAll
            value={searchAll ? ALL_SUBJECTS_ID : subject?.id ?? ""}
            onChange={(next) => {
              setSearchAll(false);
              setSubject(next);
            }}
            onSelectAll={() => {
              setSearchAll(true);
              setSubject(null);
            }}
          />
          {searchAll && (
            <p className="mt-1 text-xs text-muted-foreground">
              Searches the company and every director and shareholder captured in Intake &amp;
              Extraction, one search per subject.
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
          {canSearch && searchAll && (
            <p className="text-xs text-muted-foreground">
              {plannedQueries} queries across {subjectCount} subjects
            </p>
          )}
          <Button disabled={!canSearch || runSearch.isPending} onClick={handleRunSearch}>
            {runSearch.isPending
              ? searchAll
                ? `Searching ${subjectCount} subjects...`
                : "Searching..."
              : "Run Search"}
          </Button>
        </div>
      </div>
    </section>
  );
}
