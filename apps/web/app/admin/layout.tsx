"use client";

import { useState, useEffect } from "react";
import { adminApi } from "@/lib/adminApi";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isAuthed, setIsAuthed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (adminApi.hasSecret()) {
      setIsAuthed(true);
    }
    setIsLoading(false);
  }, []);

  const handleLogin = async () => {
    setError("");
    adminApi.setSecret(secret);
    try {
      // Test the secret by hitting the stats endpoint
      await adminApi.fetch("/api/v1/admin/stats");
      setIsAuthed(true);
    } catch {
      adminApi.clearSecret();
      setError("INVALID_SECRET");
    }
  };

  const handleLogout = () => {
    adminApi.clearSecret();
    setIsAuthed(false);
    setSecret("");
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-void">
        <p className="font-mono text-sm uppercase tracking-widest text-brand-gray">LOADING...</p>
      </div>
    );
  }

  if (!isAuthed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-void">
        <div className="w-full max-w-sm space-y-4 rounded-[2px] border border-brand-green bg-brand-black p-6">
          <h1 className="font-mono text-sm font-bold uppercase tracking-widest text-brand-white">
            ADMIN_ACCESS
          </h1>
          <p className="font-mono text-[10px] text-brand-gray">ENTER_ADMIN_SECRET_TO_CONTINUE</p>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="ADMIN_API_SECRET"
            className="w-full rounded-[2px] border border-brand-green bg-brand-void px-3 py-2 font-mono text-sm text-brand-white focus:border-brand-white focus:outline-none focus:ring-1 focus:ring-brand-white"
          />
          {error && <p className="font-mono text-[10px] text-brand-red">{error}</p>}
          <button
            onClick={handleLogin}
            disabled={!secret}
            className="w-full rounded-[2px] bg-brand-green px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest text-brand-black transition hover:bg-brand-green/80 disabled:opacity-50"
          >
            AUTHENTICATE
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-void">
      <header className="border-b border-brand-green/30 bg-brand-black px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-sm font-bold uppercase tracking-widest text-brand-green">
              CACHET_ADMIN
            </h1>
            <span className="rounded-[2px] border border-brand-red/50 px-1.5 py-0.5 font-mono text-[9px] text-brand-red">
              RESTRICTED
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-[2px] border border-brand-green px-3 py-1 font-mono text-[10px] text-brand-gray transition hover:text-brand-white"
          >
            LOGOUT
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
    </div>
  );
}
