import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";
import type {
  KnowledgeRepositorySearchParams,
  KnowledgeRepositorySearchResponse,
} from "@/types/knowledgeRepository";

function buildSearchUrl(params: KnowledgeRepositorySearchParams): string {
  const search = new URLSearchParams();
  search.set("q", params.q);
  if (params.riskTheme) search.set("risk_theme", params.riskTheme);
  if (params.decision) search.set("decision", params.decision);
  if (params.subjectName) search.set("subject_name", params.subjectName);
  if (params.dateFrom) search.set("date_from", params.dateFrom);
  if (params.dateTo) search.set("date_to", params.dateTo);
  return `/api/knowledge-repository/search?${search.toString()}`;
}

// Search is explicitly triggered (submit button / Enter / arriving via a
// pre-filled link), not run on every keystroke - `params` is null until a
// search has actually been submitted.
export function useKnowledgeRepositorySearch(params: KnowledgeRepositorySearchParams | null) {
  return useQuery({
    queryKey: ["knowledge-repository-search", params],
    queryFn: () => apiGet<KnowledgeRepositorySearchResponse>(buildSearchUrl(params!)),
    enabled: params !== null,
  });
}
