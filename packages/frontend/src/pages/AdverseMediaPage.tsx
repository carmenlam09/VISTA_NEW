import { useState } from "react";
import { useParams } from "react-router-dom";

import { KeywordLibraryModal } from "@/components/adverseMedia/KeywordLibraryModal";
import { RiskThemeGroups } from "@/components/adverseMedia/RiskThemeGroups";
import { SearchHistoryList } from "@/components/adverseMedia/SearchHistoryList";
import { SearchPanel } from "@/components/adverseMedia/SearchPanel";
import { Button } from "@/components/ui/button";
import { useAdverseMediaArticles, useAdverseMediaSearchHistory } from "@/hooks/useAdverseMedia";

export function AdverseMediaPage() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const { data: articles, isLoading, isError } = useAdverseMediaArticles(vendorId);
  const { data: searches } = useAdverseMediaSearchHistory(vendorId);
  const [keywordModalOpen, setKeywordModalOpen] = useState(false);

  if (!vendorId) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Adverse Media Screening</h1>
          <p className="text-sm text-muted-foreground">
            Search the web for adverse media on this vendor and its directors/shareholders.
          </p>
        </div>
        <Button variant="outline" onClick={() => setKeywordModalOpen(true)}>
          Manage Keywords
        </Button>
      </div>

      <SearchPanel vendorId={vendorId} />

      {isLoading && <p className="text-sm text-muted-foreground">Loading results...</p>}
      {isError && <p className="text-sm text-destructive">Could not load adverse media results.</p>}
      {articles && <RiskThemeGroups vendorId={vendorId} articles={articles} />}

      <SearchHistoryList searches={searches ?? []} />

      <KeywordLibraryModal open={keywordModalOpen} onOpenChange={setKeywordModalOpen} />
    </div>
  );
}
