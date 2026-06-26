import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Subscribe to changes on the analyses table and invalidate the given query so
// the UI updates live as n8n flips a deal pending -> processing -> complete.
// RLS scopes the stream to the current (anonymous) user's own rows.
export function useAnalysesRealtime(invalidateKey: readonly unknown[]): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(`analyses:${invalidateKey.join(":")}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "analyses" },
        () => {
          queryClient.invalidateQueries({ queryKey: invalidateKey as unknown[] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // invalidateKey is treated as stable (literal arrays at call sites).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
