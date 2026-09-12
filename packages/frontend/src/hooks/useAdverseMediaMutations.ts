import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiPost, apiPut } from "@/lib/api";
import type { AdverseMediaArticle, AdverseMediaSearchRun } from "@/types/adverseMedia";
import type { SubjectType } from "@/types/screening";

export type DecidableDecision = "relevant" | "false_positive";

export interface RunSearchInput {
  subject_type: SubjectType;
  related_director_id?: string | null;
  related_shareholder_id?: string | null;
  extra_keywords?: string[];
  keyword_ids?: string[];
}

function useInvalidateAdverseMedia(vendorId: string | undefined) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["adverse-media", vendorId] });
    queryClient.invalidateQueries({ queryKey: ["adverse-media-searches", vendorId] });
  };
}

export function useRunAdverseMediaSearch(vendorId: string | undefined) {
  const invalidate = useInvalidateAdverseMedia(vendorId);
  return useMutation({
    mutationFn: (input: RunSearchInput) =>
      apiPost<AdverseMediaSearchRun>(`/api/vendors/${vendorId}/adverse-media-searches`, input),
    onSuccess: invalidate,
  });
}

export function useSetArticleDecision(vendorId: string | undefined) {
  const invalidate = useInvalidateAdverseMedia(vendorId);
  return useMutation({
    mutationFn: ({ articleId, decision }: { articleId: string; decision: DecidableDecision }) =>
      apiPut<AdverseMediaArticle>(`/api/adverse-media-articles/${articleId}/decision`, { decision }),
    onSuccess: invalidate,
  });
}
