import { supabase } from "./client";

// Ensures every visitor has a Supabase session so the owner-scoped RLS policies
// (auth.uid() = user_id) can give each browser its own private set of analyses.
// Uses anonymous auth, so there is no login UI; you can later upgrade to
// email/OAuth without changing the database policies.
//
// Returns true when a NEW session was created, so the caller can refetch any
// owner-scoped data that was loaded before the session existed.
//
// NOTE: Supabase anonymous sign-ins must be enabled once in the dashboard:
//   Authentication -> Sign In / Providers -> Anonymous sign-ins -> Enable.

let inFlight: Promise<boolean> | null = null;

export function ensureAnonymousSession(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) return false;

    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.error("[Supabase] anonymous sign-in failed:", error.message);
      return false;
    }
    return true;
  })();

  return inFlight;
}
