import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Architecture: the app is a skin. All OM processing (extract -> risk -> report
// -> PDF) runs in n8n via OpenRouter, which writes results back to Supabase and
// the UI follows via Realtime. This server function does ONE thing: securely
// fire the n8n webhook with the analysis id + storage path, keeping the shared
// secret server-side. The pending row + Storage upload happen client-side
// (owner-scoped RLS), so large PDFs never pass through here.
//
// Env-gated: if N8N_WEBHOOK_URL is unset, this no-ops so the app still runs
// before the automation is connected (the deal just stays "pending").

interface TriggerInput {
  analysis_id: string;
  storage_path: string;
}

export const triggerAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: TriggerInput) => input)
  .handler(async ({ data, context }) => {
    const url = process.env.N8N_WEBHOOK_URL;
    if (!url) {
      return { triggered: false, reason: "n8n webhook not configured" as const };
    }

    const secret = process.env.N8N_WEBHOOK_SECRET ?? "";

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-webhook-secret": secret,
        },
        body: JSON.stringify({
          analysis_id: data.analysis_id,
          bucket: "oms",
          storage_path: data.storage_path,
          user_id: context.userId,
        }),
      });

      if (!res.ok) {
        // Surface the failure in the UI instead of spinning forever.
        await context.supabase
          .from("analyses")
          .update({ status: "failed", error_message: `Trigger failed (${res.status})` })
          .eq("id", data.analysis_id);
        return { triggered: false, reason: `webhook ${res.status}` };
      }

      return { triggered: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown trigger error";
      await context.supabase
        .from("analyses")
        .update({ status: "failed", error_message: message })
        .eq("id", data.analysis_id);
      return { triggered: false, reason: message };
    }
  });
