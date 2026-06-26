// Single source of truth for the CRE screening model: property types, the
// universal + per-type metric taxonomy, and the default (editable) risk
// thresholds. The app reads this for Settings, report rendering, and the
// comparison dashboard; the n8n workflow mirrors the same keys + defaults.

export type PropertyFamily =
  | "residential_income"
  | "hospitality"
  | "commercial_leased"
  | "industrial_mixed";

export type PropertySubtype =
  | "multifamily"
  | "sfr"
  | "hotel"
  | "office"
  | "retail"
  | "industrial"
  | "mixed_use";

export const SUBTYPE_TO_FAMILY: Record<PropertySubtype, PropertyFamily> = {
  multifamily: "residential_income",
  sfr: "residential_income",
  hotel: "hospitality",
  office: "commercial_leased",
  retail: "commercial_leased",
  industrial: "industrial_mixed",
  mixed_use: "industrial_mixed",
};

export const FAMILY_LABELS: Record<PropertyFamily, string> = {
  residential_income: "Residential income",
  hospitality: "Hospitality",
  commercial_leased: "Commercial leased",
  industrial_mixed: "Industrial / mixed-use",
};

export const SUBTYPE_LABELS: Record<PropertySubtype, string> = {
  multifamily: "Multifamily",
  sfr: "Single-family rental",
  hotel: "Hotel",
  office: "Office",
  retail: "Retail",
  industrial: "Industrial",
  mixed_use: "Mixed-use",
};

export type MetricUnit =
  | "usd"
  | "usd_per_unit"
  | "pct"
  | "ratio"
  | "count"
  | "year"
  | "text";

export interface MetricDef {
  key: string;
  label: string;
  unit: MetricUnit;
  hint?: string;
}

// Universal core — stored on every deal; powers the cross-type "Universal" comparison.
export const UNIVERSAL_METRICS: MetricDef[] = [
  { key: "purchase_price", label: "Purchase price", unit: "usd" },
  { key: "price_per_unit", label: "Price per unit/key/sqft", unit: "usd_per_unit", hint: "Denominator depends on property type" },
  { key: "gross_income", label: "Gross income", unit: "usd" },
  { key: "operating_expenses", label: "Operating expenses", unit: "usd" },
  { key: "noi", label: "NOI", unit: "usd" },
  { key: "noi_margin_pct", label: "NOI margin", unit: "pct" },
  { key: "cap_rate_pct", label: "Going-in cap rate", unit: "pct" },
  { key: "market_cap_rate_pct", label: "Market cap rate", unit: "pct" },
  { key: "occupancy_pct", label: "Occupancy", unit: "pct" },
  { key: "annual_debt_service", label: "Annual debt service", unit: "usd" },
  { key: "dscr", label: "DSCR", unit: "ratio" },
  { key: "loan_amount", label: "Loan amount", unit: "usd" },
  { key: "ltv_pct", label: "LTV", unit: "pct" },
  { key: "expense_ratio_pct", label: "Expense ratio", unit: "pct" },
  { key: "year_built", label: "Year built", unit: "year" },
];

// Per-family extension metrics.
export const TYPE_METRICS: Record<PropertyFamily, MetricDef[]> = {
  residential_income: [
    { key: "units", label: "Units / doors", unit: "count" },
    { key: "avg_in_place_rent", label: "Avg in-place rent", unit: "usd" },
    { key: "avg_market_rent", label: "Avg market rent", unit: "usd" },
    { key: "loss_to_lease_pct", label: "Loss to lease", unit: "pct" },
    { key: "rent_per_sqft", label: "Rent per sqft", unit: "usd" },
    { key: "concessions_pct", label: "Concessions", unit: "pct" },
    { key: "value_add_capex", label: "Value-add capex", unit: "usd" },
  ],
  hospitality: [
    { key: "keys", label: "Keys (rooms)", unit: "count" },
    { key: "adr", label: "ADR", unit: "usd" },
    { key: "revpar", label: "RevPAR", unit: "usd" },
    { key: "gop_margin_pct", label: "GOP margin", unit: "pct" },
    { key: "brand", label: "Brand / flag", unit: "text" },
    { key: "pip_cost", label: "PIP cost", unit: "usd" },
    { key: "fnb_revenue_pct", label: "F&B revenue share", unit: "pct" },
  ],
  commercial_leased: [
    { key: "nra_sqft", label: "Net rentable area", unit: "count" },
    { key: "walt_years", label: "WALT", unit: "ratio" },
    { key: "in_place_rent_psf", label: "In-place rent / sqft", unit: "usd" },
    { key: "market_rent_psf", label: "Market rent / sqft", unit: "usd" },
    { key: "lease_type", label: "Lease type (NNN/gross)", unit: "text" },
    { key: "top_tenant_pct", label: "Top tenant share", unit: "pct" },
    { key: "near_term_rollover_pct", label: "Near-term rollover", unit: "pct" },
    { key: "ti_lc", label: "TI / LC", unit: "usd" },
  ],
  industrial_mixed: [
    { key: "nra_sqft", label: "Net rentable area", unit: "count" },
    { key: "clear_height_ft", label: "Clear height", unit: "count" },
    { key: "dock_doors", label: "Dock doors", unit: "count" },
    { key: "rent_psf", label: "Rent / sqft", unit: "usd" },
    { key: "walt_years", label: "WALT", unit: "ratio" },
    { key: "tenant_count", label: "Tenant count", unit: "count" },
  ],
};

// Risk rules: catalog (labels) + default thresholds (editable per user/family).
export interface RiskRuleMeta {
  id: string;
  label: string;
}

export const RISK_RULES: Record<PropertyFamily, RiskRuleMeta[]> = {
  residential_income: [
    { id: "dscr", label: "Debt service coverage" },
    { id: "occupancy", label: "Economic occupancy" },
    { id: "expense_ratio", label: "Expense ratio" },
    { id: "cap_vs_market", label: "Going-in cap vs market" },
    { id: "deferred_capex", label: "Deferred capex" },
  ],
  hospitality: [
    { id: "dscr", label: "Debt service coverage" },
    { id: "occupancy", label: "Occupancy" },
    { id: "gop_margin", label: "GOP margin" },
    { id: "revpar_vs_comp", label: "RevPAR vs comp set" },
    { id: "pip_funded", label: "PIP funded" },
  ],
  commercial_leased: [
    { id: "dscr", label: "Debt service coverage" },
    { id: "walt", label: "Weighted avg lease term" },
    { id: "tenant_conc", label: "Tenant concentration" },
    { id: "rollover", label: "Near-term rollover" },
    { id: "occupancy", label: "Occupancy" },
  ],
  industrial_mixed: [
    { id: "dscr", label: "Debt service coverage" },
    { id: "walt", label: "Weighted avg lease term" },
    { id: "occupancy", label: "Occupancy" },
    { id: "tenant_conc", label: "Tenant concentration" },
    { id: "deferred_capex", label: "Deferred capex" },
  ],
};

export type Thresholds = Record<string, Record<string, number>>;

// Industry-standard starting points. Editable per user in Settings; seeded into
// risk_settings on first save, and read by n8n at scoring time.
export const DEFAULT_THRESHOLDS: Record<PropertyFamily, Thresholds> = {
  residential_income: {
    dscr: { min: 1.25, critical_min: 1.2 },
    occupancy: { min_pct: 90 },
    expense_ratio: { max_pct: 55 },
    cap_vs_market: { max_bps_below: 75 },
    deferred_capex: { max_pct_of_price: 5 },
  },
  hospitality: {
    dscr: { min: 1.4, critical_min: 1.3 },
    occupancy: { min_pct: 60 },
    gop_margin: { min_pct: 30 },
    revpar_vs_comp: { max_pct_below: 15 },
    pip_funded: { required: 1 },
  },
  commercial_leased: {
    dscr: { min: 1.3, critical_min: 1.2 },
    walt: { min_years: 4 },
    tenant_conc: { max_top_tenant_pct: 30 },
    rollover: { max_near_term_pct: 20 },
    occupancy: { min_pct: 85 },
  },
  industrial_mixed: {
    dscr: { min: 1.3, critical_min: 1.2 },
    walt: { min_years: 4 },
    occupancy: { min_pct: 85 },
    tenant_conc: { max_top_tenant_pct: 40 },
    deferred_capex: { max_pct_of_price: 5 },
  },
};

// Human labels for the editable threshold params (used by the Settings UI).
export const PARAM_LABELS: Record<string, string> = {
  min: "Minimum",
  critical_min: "Critical below",
  min_pct: "Min %",
  max_pct: "Max %",
  min_years: "Min years",
  max_bps_below: "Max bps below market",
  max_pct_of_price: "Max % of price",
  max_top_tenant_pct: "Max top-tenant %",
  max_near_term_pct: "Max near-term rollover %",
  max_pct_below: "Max % below comp",
  required: "Required (1 = yes)",
};

export const PROPERTY_FAMILIES = Object.keys(FAMILY_LABELS) as PropertyFamily[];

// Risk outcome vocabulary shared by app + n8n.
export type Recommendation = "pursue" | "pursue_with_conditions" | "pass";
export type AnalysisStatus = "pending" | "processing" | "complete" | "excluded" | "failed";

export interface RiskRuleResult {
  id: string;
  label: string;
  status: "pass" | "review" | "high" | "critical";
  value: number | null;
  threshold: string;
  note?: string;
}

export interface RiskResults {
  rules: RiskRuleResult[];
  decision: { recommendation: Recommendation; reason: string };
}
