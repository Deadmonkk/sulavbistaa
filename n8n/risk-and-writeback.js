// Ledger — n8n Code node: score risk + build the Supabase write-back body.
// Paste this into the "Score risk" Code node (Run Once for All Items, language: JS).
//
// Expected inputs (adjust the two reads below to your node names):
//   - extraction: the parsed JSON object from the OpenRouter node
//     (property_name, location, property_subtype, metrics, type_metrics, confidence)
//   - ctx: the original webhook body (analysis_id, user_id)
//   - thresholdsByFamily: optional override fetched from risk_settings; else DEFAULTS used.
//
// Output: one item { json: { analysis_id, patch } } — feed `patch` to the
// Supabase PATCH node body. See n8n/CONTRACT.md §5–§7.

const SUBTYPE_TO_FAMILY = {
  multifamily: "residential_income", sfr: "residential_income",
  hotel: "hospitality",
  office: "commercial_leased", retail: "commercial_leased",
  industrial: "industrial_mixed", mixed_use: "industrial_mixed",
};

const DEFAULTS = {
  residential_income: { dscr: { min: 1.25, critical_min: 1.2 }, occupancy: { min_pct: 90 }, expense_ratio: { max_pct: 55 }, cap_vs_market: { max_bps_below: 75 }, deferred_capex: { max_pct_of_price: 5 } },
  hospitality: { dscr: { min: 1.4, critical_min: 1.3 }, occupancy: { min_pct: 60 }, gop_margin: { min_pct: 30 }, revpar_vs_comp: { max_pct_below: 15 }, pip_funded: { required: 1 } },
  commercial_leased: { dscr: { min: 1.3, critical_min: 1.2 }, walt: { min_years: 4 }, tenant_conc: { max_top_tenant_pct: 30 }, rollover: { max_near_term_pct: 20 }, occupancy: { min_pct: 85 } },
  industrial_mixed: { dscr: { min: 1.3, critical_min: 1.2 }, walt: { min_years: 4 }, occupancy: { min_pct: 85 }, tenant_conc: { max_top_tenant_pct: 40 }, deferred_capex: { max_pct_of_price: 5 } },
};

const RULE_LABELS = {
  dscr: "Debt service coverage", occupancy: "Occupancy", expense_ratio: "Expense ratio",
  cap_vs_market: "Going-in cap vs market", deferred_capex: "Deferred capex",
  gop_margin: "GOP margin", revpar_vs_comp: "RevPAR vs comp set", pip_funded: "PIP funded",
  walt: "Weighted avg lease term", tenant_conc: "Tenant concentration", rollover: "Near-term rollover",
};

// --- read upstream data (rename to your actual node names) -------------------
const extraction = $('OpenRouter extract').first().json.parsed
  ?? JSON.parse($('OpenRouter extract').first().json.choices[0].message.content);
const ctx = $('Webhook').first().json.body;
const thresholdsByFamily = null; // set from a risk_settings fetch node if you add one

const subtype = extraction.property_subtype;
const family = SUBTYPE_TO_FAMILY[subtype] || "residential_income";
const t = (thresholdsByFamily && thresholdsByFamily[family]) || DEFAULTS[family];
const m = extraction.metrics || {};
const tm = extraction.type_metrics || {};
const conf = extraction.confidence || {};

const num = (v) => (typeof v === "number" && !Number.isNaN(v) ? v : null);

function evalRule(id) {
  const p = t[id] || {};
  let value = null, status = "review", threshold = "", note = "";
  switch (id) {
    case "dscr": {
      value = num(m.dscr); threshold = `DSCR >= ${p.min}`;
      if (value === null) { status = "review"; note = "DSCR not extracted."; }
      else if (value < p.critical_min) { status = "critical"; note = `DSCR ${value} below critical ${p.critical_min}.`; }
      else if (value < p.min) { status = "high"; note = `DSCR ${value} below ${p.min}.`; }
      else status = "pass";
      break;
    }
    case "occupancy": {
      value = num(m.occupancy_pct); threshold = `Occupancy >= ${p.min_pct}%`;
      if (value === null) status = "review";
      else if (value < p.min_pct - 10) status = "critical";
      else if (value < p.min_pct) status = "high";
      else status = "pass";
      break;
    }
    case "expense_ratio": {
      value = num(m.expense_ratio_pct); threshold = `Expense ratio <= ${p.max_pct}%`;
      if (value === null) status = "review";
      else if (value > p.max_pct) status = "high";
      else status = "pass";
      break;
    }
    case "cap_vs_market": {
      const cap = num(m.cap_rate_pct), mkt = num(m.market_cap_rate_pct);
      threshold = `Going-in cap not > ${p.max_bps_below}bps below market`;
      if (cap === null || mkt === null) status = "review";
      else { value = +((mkt - cap) * 100).toFixed(0); status = value > p.max_bps_below ? "high" : "pass"; }
      break;
    }
    case "deferred_capex": {
      const capex = num(tm.value_add_capex), price = num(m.purchase_price);
      threshold = `Deferred capex <= ${p.max_pct_of_price}% of price`;
      if (capex === null || !price) status = "review";
      else { value = +((capex / price) * 100).toFixed(1); status = value > p.max_pct_of_price ? "high" : "pass"; }
      break;
    }
    case "gop_margin": {
      value = num(tm.gop_margin_pct); threshold = `GOP margin >= ${p.min_pct}%`;
      status = value === null ? "review" : value < p.min_pct ? "high" : "pass";
      break;
    }
    case "revpar_vs_comp": {
      threshold = `RevPAR not > ${p.max_pct_below}% below comp`; status = "review";
      note = "Provide comp-set RevPAR to evaluate.";
      break;
    }
    case "pip_funded": {
      threshold = "PIP funded"; status = "review"; note = "Confirm PIP is funded.";
      break;
    }
    case "walt": {
      value = num(tm.walt_years); threshold = `WALT >= ${p.min_years} yrs`;
      status = value === null ? "review" : value < p.min_years ? "high" : "pass";
      break;
    }
    case "tenant_conc": {
      value = num(tm.top_tenant_pct); threshold = `Top tenant <= ${p.max_top_tenant_pct}%`;
      status = value === null ? "review" : value > p.max_top_tenant_pct ? "high" : "pass";
      break;
    }
    case "rollover": {
      value = num(tm.near_term_rollover_pct); threshold = `Near-term rollover <= ${p.max_near_term_pct}%`;
      status = value === null ? "review" : value > p.max_near_term_pct ? "high" : "pass";
      break;
    }
  }
  return { id, label: RULE_LABELS[id] || id, status, value, threshold, note };
}

const rules = Object.keys(t).map(evalRule);

const hasCritical = rules.some((r) => r.status === "critical");
const hasHighOrReview = rules.some((r) => r.status === "high" || r.status === "review");

let recommendation, status;
if (hasCritical) { recommendation = "pass"; status = "excluded"; }
else if (hasHighOrReview) { recommendation = "pursue_with_conditions"; status = "complete"; }
else { recommendation = "pursue"; status = "complete"; }

const reason = hasCritical
  ? `Excluded: ${rules.filter((r) => r.status === "critical").map((r) => r.label).join(", ")} failed.`
  : hasHighOrReview
  ? `Proceed with conditions: ${rules.filter((r) => r.status === "high" || r.status === "review").length} flag(s) to resolve.`
  : "All risk rules pass.";

const verify_items = Object.keys(conf)
  .filter((k) => conf[k] === "low" || conf[k] === "missing")
  .map((k) => ({ field: k, reason: conf[k] === "missing" ? "not found in OM" : "low-confidence extraction" }));

const patch = {
  status,
  property_type: family,
  property_subtype: subtype,
  location: extraction.location ?? null,
  property_name: extraction.property_name ?? null,
  metrics: m,
  type_metrics: tm,
  risk_results: { rules, decision: { recommendation, reason } },
  verify_items,
  confidence: conf,
};

return [{ json: { analysis_id: ctx.analysis_id, patch } }];
