// Ledger (SIMPLE / 24h build) — n8n Code node "Score".
// One OpenRouter call already returned metrics + summary + verdict; here we
// score risk deterministically and assemble the write-back patch (incl. an
// in-app markdown report). No PDF, no second AI call.
// Paste into the "Score" Code node (Run Once for All Items).
// Adjust the two $('...') reads to your node names.

const extraction =
  $('OpenRouter').first().json.parsed ??
  JSON.parse($('OpenRouter').first().json.choices[0].message.content);
const ctx = $('Webhook').first().json.body;

const SUBTYPE_TO_FAMILY = {
  multifamily: "residential_income", sfr: "residential_income",
  hotel: "hospitality",
  office: "commercial_leased", retail: "commercial_leased",
  industrial: "industrial_mixed", mixed_use: "industrial_mixed",
};
const DEFAULTS = {
  residential_income: { dscr: { min: 1.25, crit: 1.2 }, occ: { min: 90 }, exp: { max: 55 } },
  hospitality:        { dscr: { min: 1.4,  crit: 1.3 }, occ: { min: 60 }, exp: { max: 70 } },
  commercial_leased:  { dscr: { min: 1.3,  crit: 1.2 }, occ: { min: 85 }, exp: { max: 45 } },
  industrial_mixed:   { dscr: { min: 1.3,  crit: 1.2 }, occ: { min: 85 }, exp: { max: 45 } },
};
const num = (v) => (typeof v === "number" && !Number.isNaN(v) ? v : null);

const subtype = extraction.property_subtype || "multifamily";
const family = SUBTYPE_TO_FAMILY[subtype] || "residential_income";
const t = DEFAULTS[family];
const m = extraction.metrics || {};
const conf = extraction.confidence || {};

const rules = [];
// DSCR
{
  const v = num(m.dscr);
  rules.push({
    id: "dscr", label: "Debt service coverage", value: v,
    threshold: `DSCR >= ${t.dscr.min}`,
    status: v === null ? "review" : v < t.dscr.crit ? "critical" : v < t.dscr.min ? "high" : "pass",
    note: v === null ? "DSCR not found." : `DSCR ${v} vs min ${t.dscr.min}.`,
  });
}
// Occupancy
{
  const v = num(m.occupancy_pct);
  rules.push({
    id: "occupancy", label: "Occupancy", value: v,
    threshold: `Occupancy >= ${t.occ.min}%`,
    status: v === null ? "review" : v < t.occ.min - 10 ? "critical" : v < t.occ.min ? "high" : "pass",
    note: v === null ? "Occupancy not found." : `Occupancy ${v}% vs min ${t.occ.min}%.`,
  });
}
// Expense ratio
{
  const v = num(m.expense_ratio_pct);
  rules.push({
    id: "expense_ratio", label: "Expense ratio", value: v,
    threshold: `Expense ratio <= ${t.exp.max}%`,
    status: v === null ? "review" : v > t.exp.max ? "high" : "pass",
    note: v === null ? "Expense ratio not found." : `Expense ratio ${v}% vs max ${t.exp.max}%.`,
  });
}

const hasCritical = rules.some((r) => r.status === "critical");
const hasFlag = rules.some((r) => r.status === "high" || r.status === "review");

let recommendation, status;
if (hasCritical) { recommendation = "pass"; status = "excluded"; }
else if (hasFlag) { recommendation = "pursue_with_conditions"; status = "complete"; }
else { recommendation = "pursue"; status = "complete"; }

const reason = hasCritical
  ? `Excluded: ${rules.filter((r) => r.status === "critical").map((r) => r.label).join(", ")} failed.`
  : hasFlag
  ? "Proceed with conditions — resolve the flagged items before bidding."
  : "All risk rules pass.";

// In-app markdown report (only for non-excluded deals).
const report_text =
  status === "excluded"
    ? null
    : [
        `# Summary`,
        extraction.summary || reason,
        ``,
        `## Investor verdict`,
        extraction.investor_verdict || "—",
      ].join("\n");

const verify_items = Object.keys(conf)
  .filter((k) => conf[k] === "low" || conf[k] === "missing")
  .map((k) => ({ field: k, reason: conf[k] === "missing" ? "not found in OM" : "low confidence" }));

const patch = {
  status,
  property_type: family,
  property_subtype: subtype,
  location: extraction.location ?? null,
  property_name: extraction.property_name ?? null,
  metrics: m,
  type_metrics: extraction.type_metrics || {},
  risk_results: { rules, decision: { recommendation, reason } },
  verify_items,
  confidence: conf,
  report_text,
};

return [{ json: { analysis_id: ctx.analysis_id, patch } }];
