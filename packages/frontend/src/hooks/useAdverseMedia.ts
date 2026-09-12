import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";
import type { AdverseMediaArticle, AdverseMediaSearchRun } from "@/types/adverseMedia";

export function useAdverseMediaArticles(vendorId: string | undefined) {
  return useQuery({
    queryKey: ["adverse-media", vendorId],
    queryFn: () => apiGet<AdverseMediaArticle[]>(`/api/vendors/${vendorId}/adverse-media`),
    enabled: Boolean(vendorId),
  });
}

export function useAdverseMediaSearchHistory(vendorId: string | undefined) {
  return useQuery({
    queryKey: ["adverse-media-searches", vendorId],
    queryFn: () =>
      apiGet<AdverseMediaSearchRun[]>(`/api/vendors/${vendorId}/adverse-media-searches`),
    enabled: Boolean(vendorId),
  });
}
