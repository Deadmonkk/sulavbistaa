// Ledger — n8n Code node "Attach report" (runs after the PDF is uploaded).
// Adds report_text + report_path (bucket-relative) to the patch, then emits for
// the Write back node. Run Once for All Items.

const prev = $('Build report HTML').first().json;     // { analysis_id, patch, report_text }
const ctx = $('Webhook').first().json.body;           // { user_id, analysis_id, ... }

const patch = {
  ...prev.patch,
  report_text: prev.report_text,
  report_path: `${ctx.user_id}/${prev.analysis_id}/report.pdf`,
};

return [{ json: { analysis_id: prev.analysis_id, patch } }];
