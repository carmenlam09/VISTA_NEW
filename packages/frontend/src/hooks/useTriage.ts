import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";
import type { RiskTriageResult, SourceType, TriageDecision } from "@/types/triage";

export interface TriageFilters {
  sourceType?: SourceType;
  reviewerFinalDecision?: TriageDecision;
}

export function triageQueryKey(vendorId: string | undefined, filters: TriageFilters) {
  return ["triage", vendorId, filters] as const;
}

export function useTriageResults(vendorId: string | undefined, filters: TriageFilters) {
  return useQuery({
    queryKey: triageQueryKey(vendorId, filters),
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.sourceType) params.set("source_type", filters.sourceType);
      if (filters.reviewerFinalDecision) {
        params.set("reviewer_final_decision", filters.reviewerFinalDecision);
      }
      const qs = params.toString();
      return apiGet<RiskTriageResult[]>(`/api/vendors/${vendorId}/triage${qs ? `?${qs}` : ""}`);
    },
    enabled: Boolean(vendorId),
  });
}
