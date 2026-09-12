import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiPost, apiPut } from "@/lib/api";
import type { RiskTriageResult, TriageRunSummary } from "@/types/triage";

import { screeningQueryKey } from "./useScreening";

export type TriageDecisionInput = "relevant" | "false_positive";

function useInvalidateTriage(vendorId: string | undefined) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["triage", vendorId] });
  };
}

export function useRunTriage(vendorId: string | undefined) {
  const invalidate = useInvalidateTriage(vendorId);
  return useMutation({
    mutationFn: () => apiPost<TriageRunSummary>(`/api/vendors/${vendorId}/triage/run`),
    onSuccess: invalidate,
  });
}

// A decision made here also updates the underlying Module 2/3 source row
// (server-side, in one transaction) - invalidate those pages' own query keys
// too so they never show stale data if the reviewer visits them next.
export function useSetTriageDecision(vendorId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateTriage(vendorId);
  return useMutation({
    mutationFn: ({ triageId, decision }: { triageId: string; decision: TriageDecisionInput }) =>
      apiPut<RiskTriageResult>(`/api/risk-triage/${triageId}/decision`, { decision }),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: screeningQueryKey(vendorId) });
      queryClient.invalidateQueries({ queryKey: ["adverse-media", vendorId] });
    },
  });
}
