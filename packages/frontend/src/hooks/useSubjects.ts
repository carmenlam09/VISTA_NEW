import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";
import type { Subject } from "@/types/screening";

export function useSubjects(vendorId: string | undefined) {
  return useQuery({
    queryKey: ["subjects", vendorId],
    queryFn: () => apiGet<Subject[]>(`/api/vendors/${vendorId}/subjects`),
    enabled: Boolean(vendorId),
  });
}
