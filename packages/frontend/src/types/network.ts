export interface CompanyNode {
  id: string;
  kind: "company";
  label: string;
  vendorId: string;
  registrationNo: string | null;
  status: string;
}

export interface PersonRole {
  vendorId: string;
  vendorName: string;
  role: "director" | "shareholder";
  designation: string | null;
  totalShares: string | null;
}

export interface PersonNode {
  id: string;
  kind: "director" | "shareholder";
  label: string;
  icPassportNo: string | null;
  roles: PersonRole[];
  linkedCompanyCount: number;
}

export type NetworkNode = CompanyNode | PersonNode;

export interface NetworkEdge {
  source: string;
  target: string;
}

export interface NetworkGraphData {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
}
