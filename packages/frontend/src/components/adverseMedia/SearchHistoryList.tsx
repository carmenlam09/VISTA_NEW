import { SubjectBadge } from "@/components/screening/SubjectBadge";
import { Badge } from "@/components/ui/badge";
import { Collapsible } from "@/components/ui/collapsible";
import type { AdverseMediaSearchRun } from "@/types/adverseMedia";

export function SearchHistoryList({ searches }: { searches: AdverseMediaSearchRun[] }) {
  return (
    <Collapsible title="Search History" badge={<Badge variant="outline">{searches.length}</Badge>}>
      {searches.length === 0 ? (
        <p className="text-sm text-muted-foreground">No searches run yet.</p>
      ) : (
        <div className="space-y-2">
          {searches.map((search) => {
            const resultCount = search._count?.articles ?? 0;
            return (
              <div key={search.id} className="rounded-md border border-border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <SubjectBadge subjectType={search.subjectType} subjectName={search.subjectName} />
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(search.searchedAt).toLocaleString()}
                  </span>
                </div>
                <div className="mt-1.5 text-xs text-muted-foreground">
                  {search.keywordsUsed.join(", ")}
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-xs">
                  <Badge variant={search.searchStatus === "failed" ? "destructive" : "secondary"}>
                    {search.searchStatus}
                  </Badge>
                  <span className="text-muted-foreground">
                    {resultCount} result{resultCount === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Collapsible>
  );
}
