"use client";
import { useEffect } from "react";
import { getSupabase } from "@/lib/supabase";

// OAuth redirect target. With `detectSessionInUrl` enabled, simply loading the
// Supabase client parses the session out of the URL hash; we then bounce back
// home. Fully client-side, so it survives `output: "export"`.
export default function AuthCallback() {
  useEffect(() => {
    const sb = getSupabase();
    const go = () => window.location.replace("/");
    if (!sb) {
      go();
      return;
    }
    // Give the client a tick to consume the URL session, then return home.
    sb.auth.getSession().finally(go);
  }, []);

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#9ca3af",
        fontSize: 14,
      }}
    >
      Signing you in…
    </div>
  );
}
