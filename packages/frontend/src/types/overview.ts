export type RiskTier = "high" | "medium" | "low" | "unassessed";

export interface KpiSeries {
  value: number;
  /** One entry per month, oldest first. */
  series: number[];
  /** Percent change vs the previous month, or null when there is no prior data. */
  deltaPct: number | null;
  /** How to read `series`: a running total, or fresh activity per month. */
  basis: "cumulative" | "per_month";
}

export interface VendorRisk {
  vendorId: string;
  companyName: string;
  status: string;
  /** null when the vendor has no triage findings at all. */
  score: number | null;
  tier: RiskTier;
  findingCount: number;
  openFindingCount: number;
}

export interface DashboardAlert {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  at: string;
}

export interface DashboardOverview {
  generatedAt: string;
  windowStart: string;
  months: string[];
  kpis: {
    totalVendors: KpiSeries;
    vendorsScreened: KpiSeries;
    pendingTriage: KpiSeries;
    reportsApproved: KpiSeries;
  };
  risk: {
    portfolioScore: number | null;
    portfolioTier: RiskTier;
    distribution: Record<Exclude<RiskTier, never>, number>;
    totalExposures: number;
    byVendor: VendorRisk[];
    methodology: {
      weights: Record<string, number>;
      divisor: number;
      highRiskMin: number;
      mediumRiskMin: number;
    };
  };
  alerts: DashboardAlert[];
}
