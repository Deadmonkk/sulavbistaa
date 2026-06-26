import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  PROPERTY_FAMILIES,
  FAMILY_LABELS,
  RISK_RULES,
  DEFAULT_THRESHOLDS,
  PARAM_LABELS,
  type PropertyFamily,
  type Thresholds,
} from "@/lib/screening/taxonomy";
import { Loader2, Save, RotateCcw, Check } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Risk settings — Ledger" },
      { name: "description", content: "Tune the pass/fail thresholds for each property type's risk rules." },
    ],
  }),
  component: SettingsPage,
});

type AllThresholds = Record<PropertyFamily, Thresholds>;

function mergeWithDefaults(saved: Partial<Record<PropertyFamily, Thresholds>>): AllThresholds {
  const out = {} as AllThresholds;
  for (const fam of PROPERTY_FAMILIES) {
    const def = DEFAULT_THRESHOLDS[fam];
    const sv = saved[fam] ?? {};
    const merged: Thresholds = {};
    for (const ruleId of Object.keys(def)) {
      merged[ruleId] = { ...def[ruleId], ...(sv[ruleId] ?? {}) };
    }
    out[fam] = merged;
  }
  return out;
}

function SettingsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["risk_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("risk_settings").select("property_type, thresholds");
      if (error) throw error;
      const map: Partial<Record<PropertyFamily, Thresholds>> = {};
      for (const r of data ?? []) {
        map[r.property_type as PropertyFamily] = r.thresholds as unknown as Thresholds;
      }
      return map;
    },
  });

  const [edits, setEdits] = useState<AllThresholds | null>(null);
  const [savingFamily, setSavingFamily] = useState<PropertyFamily | null>(null);
  const [savedFamily, setSavedFamily] = useState<PropertyFamily | null>(null);

  useEffect(() => {
    if (data) setEdits(mergeWithDefaults(data));
  }, [data]);

  if (isLoading || !edits) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-20 text-center text-muted-foreground">
        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
        <p className="mt-3 text-sm">Loading settings…</p>
      </div>
    );
  }

  const setParam = (fam: PropertyFamily, ruleId: string, param: string, value: number) => {
    setSavedFamily(null);
    setEdits((prev) =>
      prev
        ? { ...prev, [fam]: { ...prev[fam], [ruleId]: { ...prev[fam][ruleId], [param]: value } } }
        : prev,
    );
  };

  const resetFamily = (fam: PropertyFamily) => {
    setSavedFamily(null);
    setEdits((prev) => (prev ? { ...prev, [fam]: structuredClone(DEFAULT_THRESHOLDS[fam]) } : prev));
  };

  const saveFamily = async (fam: PropertyFamily) => {
    setSavingFamily(fam);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) throw new Error("No session");
      const { error } = await supabase.from("risk_settings").upsert(
        {
          user_id: userId,
          property_type: fam,
          thresholds: edits[fam] as unknown as Json,
        },
        { onConflict: "user_id,property_type" },
      );
      if (error) throw error;
      setSavedFamily(fam);
    } finally {
      setSavingFamily(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Settings</p>
      <h1 className="font-display mt-2 text-5xl">Risk thresholds</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        These thresholds drive the pass / pass-with-conditions / excluded decision per property type.
        Defaults are industry-standard starting points — tune them to your underwriting box. The screening
        pipeline reads these at scoring time.
      </p>

      <div className="mt-10 space-y-8">
        {PROPERTY_FAMILIES.map((fam) => (
          <section key={fam} className="card-base p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{FAMILY_LABELS[fam]}</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => resetFamily(fam)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium hover:bg-secondary"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reset
                </button>
                <button
                  onClick={() => saveFamily(fam)}
                  disabled={savingFamily === fam}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {savingFamily === fam ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : savedFamily === fam ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  {savedFamily === fam ? "Saved" : "Save"}
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {RISK_RULES[fam].map((rule) => {
                const params = edits[fam][rule.id] ?? {};
                return (
                  <div key={rule.id} className="rounded-lg border border-border/60 p-4">
                    <div className="text-sm font-medium">{rule.label}</div>
                    <div className="mt-3 flex flex-wrap gap-4">
                      {Object.keys(params).map((param) => (
                        <label key={param} className="flex flex-col gap-1">
                          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                            {PARAM_LABELS[param] ?? param}
                          </span>
                          <input
                            type="number"
                            step="any"
                            value={params[param]}
                            onChange={(e) => setParam(fam, rule.id, param, Number(e.target.value))}
                            className="w-32 rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm tabular"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
