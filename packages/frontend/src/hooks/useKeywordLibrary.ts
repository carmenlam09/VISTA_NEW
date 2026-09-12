import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost, apiPut } from "@/lib/api";
import type { AdverseMediaKeyword, RiskTheme } from "@/types/adverseMedia";

const KEYWORD_LIBRARY_KEY = ["keyword-library"] as const;

export function useKeywordLibrary(params?: { is_active?: boolean; risk_theme?: RiskTheme }) {
  const search = new URLSearchParams();
  if (params?.is_active !== undefined) search.set("is_active", String(params.is_active));
  if (params?.risk_theme) search.set("risk_theme", params.risk_theme);
  const qs = search.toString();

  return useQuery({
    queryKey: [...KEYWORD_LIBRARY_KEY, params ?? {}],
    queryFn: () => apiGet<AdverseMediaKeyword[]>(`/api/keyword-library${qs ? `?${qs}` : ""}`),
  });
}

export interface KeywordInput {
  keyword: string;
  risk_theme: RiskTheme;
}

function useInvalidateKeywordLibrary() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: KEYWORD_LIBRARY_KEY });
}

export function useCreateKeyword() {
  const invalidate = useInvalidateKeywordLibrary();
  return useMutation({
    mutationFn: (input: KeywordInput) => apiPost<AdverseMediaKeyword>("/api/keyword-library", input),
    onSuccess: invalidate,
  });
}

export function useUpdateKeyword() {
  const invalidate = useInvalidateKeywordLibrary();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Partial<KeywordInput> & { is_active?: boolean };
    }) => apiPut<AdverseMediaKeyword>(`/api/keyword-library/${id}`, input),
    onSuccess: invalidate,
  });
}
