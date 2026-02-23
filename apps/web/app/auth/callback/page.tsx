"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function CallbackInner() {
  const searchParams = useSearchParams();

  useEffect(() => {
    // Immediately clear the hash fragment to minimize token exposure in browser history
    const rawHash = window.location.hash;
    if (rawHash) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }

    const hashParams = new URLSearchParams(rawHash.replace(/^#/, ""));
    const accessToken = hashParams.get("accessToken") ?? searchParams.get("accessToken");
    const refreshToken = hashParams.get("refreshToken") ?? searchParams.get("refreshToken");

    if (accessToken && refreshToken) {
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
      // Clear any remaining query params too
      window.history.replaceState(null, "", "/auth/callback");
      const returnTo = localStorage.getItem("returnTo");
      localStorage.removeItem("returnTo");
      window.location.href = returnTo || "/dashboard";
    }
  }, [searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-black">
      <p className="font-mono text-sm tracking-widest uppercase text-brand-gray">COMPLETING_LOGIN...</p>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<p className="font-mono text-sm tracking-widest uppercase text-brand-gray">LOADING...</p>}>
      <CallbackInner />
    </Suspense>
  );
}
