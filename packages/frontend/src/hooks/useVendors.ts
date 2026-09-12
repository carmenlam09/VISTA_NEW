import { useQuery } from "@tanstack/react-query";

export interface VendorListItem {
  id: string;
  companyName: string;
  registrationNo: string | null;
  status: string;
  createdAt: string;
}

async function fetchVendors(): Promise<VendorListItem[]> {
  const res = await fetch("/api/vendors");
  if (!res.ok) {
    throw new Error(`Failed to load vendors: ${res.status}`);
  }
  return res.json();
}

export function useVendors() {
  return useQuery({ queryKey: ["vendors"], queryFn: fetchVendors });
}
