"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/adminApi";
import { toast } from "sonner";
import { SUPPORTED_PAYMENT_CHAINS } from "@megaeth-verify/shared";

// ── Types ────────────────────────────────────────────────────────────────

interface Stats {
  projects: { total: number; active: number };
  subscriptions: {
    byTier: { tier: string; count: number }[];
    byStatus: { status: string; count: number }[];
  };
  crypto: {
    totalPayments: number;
    confirmedPayments: number;
    revenueUsdCents: number;
  };
  verifications: { total: number; active: number };
}

interface Payment {
  id: string;
  projectId: string;
  projectName: string;
  tier: string;
  billingPeriod: string;
  amountUsdCents: number;
  token: string;
  chain: string;
  txHash: string | null;
  status: string;
  createdAt: string;
  confirmedAt: string | null;
}

interface ProjectSearchResult {
  id: string;
  name: string;
  discordGuildId: string;
  ownerDiscordId: string;
  createdAt: string;
  deletedAt: string | null;
  tier: string | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  verificationCount: number | null;
}

interface ProjectDetail {
  project: {
    id: string;
    name: string;
    discordGuildId: string;
    ownerDiscordId: string;
    createdAt: string;
    deletedAt: string | null;
  };
  subscription: {
    id: string;
    tier: string;
    status: string;
    currentPeriodEnd: string;
    verificationCount: number;
  } | null;
  verifications: { total: number; active: number };
  recentPayments: Payment[];
}

// ── Helpers ──────────────────────────────────────────────────────────────

function tierColor(tier: string) {
  switch (tier) {
    case "enterprise": return "text-purple-400 border-purple-400/50";
    case "pro": return "text-blue-400 border-blue-400/50";
    case "growth": return "text-brand-green border-brand-green/50";
    default: return "text-brand-gray border-brand-gray/50";
  }
}

function statusColor(status: string) {
  switch (status) {
    case "confirmed":
    case "active": return "text-brand-green";
    case "past_due":
    case "pending":
    case "submitted":
    case "verifying": return "text-yellow-400";
    default: return "text-brand-red";
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function getBlockExplorer(chain: string, txHash: string): string {
  const cfg = SUPPORTED_PAYMENT_CHAINS[chain as keyof typeof SUPPORTED_PAYMENT_CHAINS];
  return cfg ? `${cfg.blockExplorer}/tx/${txHash}` : "#";
}

// ── Component ────────────────────────────────────────────────────────────

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"overview" | "projects">("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => adminApi.fetch<Stats>("/api/v1/admin/stats"),
    refetchInterval: 30_000,
  });

  const { data: paymentsData } = useQuery({
    queryKey: ["admin-payments"],
    queryFn: () => adminApi.fetch<{ payments: Payment[]; total: number }>("/api/v1/admin/payments/recent?limit=20"),
    refetchInterval: 15_000,
  });

  const { data: searchResults } = useQuery({
    queryKey: ["admin-search", searchQuery],
    queryFn: () => adminApi.fetch<ProjectSearchResult[]>(`/api/v1/admin/projects/search?q=${encodeURIComponent(searchQuery)}`),
    enabled: searchQuery.length > 0,
  });

  const { data: projectDetail } = useQuery({
    queryKey: ["admin-project", selectedProjectId],
    queryFn: () => adminApi.fetch<ProjectDetail>(`/api/v1/admin/projects/${selectedProjectId}`),
    enabled: !!selectedProjectId,
  });

  // ── Subscription Override ────────────────────────────────────────────

  const [overrideTier, setOverrideTier] = useState("free");
  const [overrideStatus, setOverrideStatus] = useState("active");
  const [overridePeriodEnd, setOverridePeriodEnd] = useState("");
  const [overrideNotes, setOverrideNotes] = useState("");
  const [overrideLoading, setOverrideLoading] = useState(false);

  const openProjectEditor = (p: ProjectSearchResult) => {
    setSelectedProjectId(p.id);
    setOverrideTier(p.tier ?? "free");
    setOverrideStatus(p.subscriptionStatus ?? "active");
    setOverridePeriodEnd(
      p.currentPeriodEnd
        ? new Date(p.currentPeriodEnd).toISOString().slice(0, 16)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    );
    setOverrideNotes("");
  };

  const handleOverride = async () => {
    if (!selectedProjectId) return;
    setOverrideLoading(true);
    try {
      await adminApi.fetch(`/api/v1/admin/projects/${selectedProjectId}/subscription`, {
        method: "POST",
        body: JSON.stringify({
          tier: overrideTier,
          status: overrideStatus,
          currentPeriodEnd: new Date(overridePeriodEnd).toISOString(),
          notes: overrideNotes || undefined,
        }),
      });
      toast.success(`Subscription updated to ${overrideTier.toUpperCase()}`);
      queryClient.invalidateQueries({ queryKey: ["admin-project", selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ["admin-search"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update subscription");
    } finally {
      setOverrideLoading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────

  const tierCount = (tier: string) => stats?.subscriptions.byTier.find((t) => t.tier === tier)?.count ?? 0;

  return (
    <div className="space-y-6">
      {/* Tab nav */}
      <div className="flex gap-2">
        {(["overview", "projects"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-[2px] border px-4 py-1.5 font-mono text-xs uppercase transition ${
              tab === t
                ? "border-brand-white bg-brand-white text-brand-black"
                : "border-brand-green text-brand-gray hover:text-brand-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ────────────────── OVERVIEW TAB ────────────────── */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* Stats cards */}
          {statsLoading ? (
            <p className="font-mono text-xs text-brand-gray">LOADING_STATS...</p>
          ) : stats ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="PROJECTS" value={stats.projects.active} sub={`${stats.projects.total} total`} />
              <StatCard
                label="REVENUE"
                value={`$${(stats.crypto.revenueUsdCents / 100).toFixed(2)}`}
                sub={`${stats.crypto.confirmedPayments} confirmed payments`}
              />
              <StatCard label="VERIFICATIONS" value={stats.verifications.active} sub={`${stats.verifications.total} total`} />
              <StatCard
                label="SUBSCRIPTIONS"
                value={tierCount("growth") + tierCount("pro") + tierCount("enterprise")}
                sub={`G:${tierCount("growth")} P:${tierCount("pro")} E:${tierCount("enterprise")}`}
              />
            </div>
          ) : null}

          {/* Tier breakdown */}
          {stats && (
            <div className="rounded-[2px] border border-brand-green bg-brand-black p-4">
              <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-brand-white">TIER_BREAKDOWN</h2>
              <div className="mt-3 flex gap-3">
                {["free", "growth", "pro", "enterprise"].map((tier) => (
                  <div key={tier} className={`rounded-[2px] border px-3 py-2 ${tierColor(tier)}`}>
                    <p className="font-mono text-lg font-bold">{tierCount(tier)}</p>
                    <p className="font-mono text-[10px] uppercase">{tier}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent payments table */}
          <div className="rounded-[2px] border border-brand-green bg-brand-black p-4">
            <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-brand-white">RECENT_PAYMENTS</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full font-mono text-xs">
                <thead>
                  <tr className="border-b border-brand-green/30 text-left text-brand-gray">
                    <th className="pb-2 pr-3">DATE</th>
                    <th className="pb-2 pr-3">PROJECT</th>
                    <th className="pb-2 pr-3">TIER</th>
                    <th className="pb-2 pr-3">AMOUNT</th>
                    <th className="pb-2 pr-3">TOKEN</th>
                    <th className="pb-2 pr-3">CHAIN</th>
                    <th className="pb-2 pr-3">STATUS</th>
                    <th className="pb-2">TX</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentsData?.payments.map((p) => (
                    <tr key={p.id} className="border-b border-brand-green/10 text-brand-white">
                      <td className="py-2 pr-3 text-brand-gray">{formatDate(p.createdAt)}</td>
                      <td className="py-2 pr-3">
                        <button
                          onClick={() => { setTab("projects"); setSearchQuery(p.projectId); openProjectEditor({ id: p.projectId, name: p.projectName } as ProjectSearchResult); }}
                          className="text-brand-green underline-offset-2 hover:underline"
                        >
                          {p.projectName}
                        </button>
                      </td>
                      <td className={`py-2 pr-3 uppercase ${tierColor(p.tier).split(" ")[0]}`}>{p.tier}</td>
                      <td className="py-2 pr-3">${(p.amountUsdCents / 100).toFixed(2)}</td>
                      <td className="py-2 pr-3 uppercase">{p.token}</td>
                      <td className="py-2 pr-3 capitalize">{p.chain}</td>
                      <td className={`py-2 pr-3 uppercase ${statusColor(p.status)}`}>{p.status}</td>
                      <td className="py-2">
                        {p.txHash ? (
                          <a
                            href={getBlockExplorer(p.chain, p.txHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-green underline-offset-2 hover:underline"
                          >
                            {p.txHash.slice(0, 8)}...
                          </a>
                        ) : (
                          <span className="text-brand-gray">--</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(!paymentsData || paymentsData.payments.length === 0) && (
                    <tr><td colSpan={8} className="py-4 text-center text-brand-gray">NO_PAYMENTS_YET</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────── PROJECTS TAB ────────────────── */}
      {tab === "projects" && (
        <div className="space-y-4">
          {/* Search */}
          <div className="rounded-[2px] border border-brand-green bg-brand-black p-4">
            <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-brand-white">SEARCH_PROJECTS</h2>
            <p className="mt-1 font-mono text-[10px] text-brand-gray">SEARCH BY NAME, DISCORD GUILD ID, OWNER ID, OR PROJECT UUID</p>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSelectedProjectId(null); }}
              placeholder="Search..."
              className="mt-2 w-full rounded-[2px] border border-brand-green bg-brand-void px-3 py-2 font-mono text-sm text-brand-white focus:border-brand-white focus:outline-none focus:ring-1 focus:ring-brand-white"
            />
          </div>

          {/* Search results */}
          {searchResults && searchResults.length > 0 && (
            <div className="rounded-[2px] border border-brand-green bg-brand-black p-4">
              <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-brand-gray">
                {searchResults.length} RESULT{searchResults.length > 1 ? "S" : ""}
              </h3>
              <div className="mt-2 space-y-1">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => openProjectEditor(p)}
                    className={`flex w-full items-center justify-between rounded-[2px] border px-3 py-2 text-left font-mono text-xs transition ${
                      selectedProjectId === p.id
                        ? "border-brand-white bg-brand-white/5"
                        : "border-brand-green/30 hover:border-brand-green"
                    }`}
                  >
                    <div>
                      <span className="text-brand-white">{p.name}</span>
                      <span className="ml-2 text-brand-gray">({p.discordGuildId})</span>
                      {p.deletedAt && <span className="ml-2 text-brand-red">[DELETED]</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-[2px] border px-1.5 py-0.5 text-[9px] uppercase ${tierColor(p.tier ?? "free")}`}>
                        {p.tier ?? "free"}
                      </span>
                      <span className={`text-[9px] uppercase ${statusColor(p.subscriptionStatus ?? "active")}`}>
                        {p.subscriptionStatus ?? "active"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {searchQuery && searchResults && searchResults.length === 0 && (
            <p className="font-mono text-xs text-brand-gray">NO_RESULTS_FOUND</p>
          )}

          {/* Project detail + subscription editor */}
          {selectedProjectId && projectDetail && (
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Left: project info */}
              <div className="rounded-[2px] border border-brand-green bg-brand-black p-4 space-y-3">
                <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-brand-white">PROJECT_DETAILS</h3>
                <div className="space-y-1.5 font-mono text-xs">
                  <InfoRow label="NAME" value={projectDetail.project.name} />
                  <InfoRow label="ID" value={projectDetail.project.id} />
                  <InfoRow label="GUILD_ID" value={projectDetail.project.discordGuildId} />
                  <InfoRow label="OWNER_ID" value={projectDetail.project.ownerDiscordId} />
                  <InfoRow label="CREATED" value={formatDate(projectDetail.project.createdAt)} />
                  <InfoRow label="VERIFICATIONS" value={`${projectDetail.verifications.active} active / ${projectDetail.verifications.total} total`} />
                  {projectDetail.subscription && (
                    <>
                      <InfoRow label="CURRENT_TIER" value={projectDetail.subscription.tier.toUpperCase()} className={tierColor(projectDetail.subscription.tier).split(" ")[0]} />
                      <InfoRow label="STATUS" value={projectDetail.subscription.status.toUpperCase()} className={statusColor(projectDetail.subscription.status)} />
                      <InfoRow label="PERIOD_END" value={formatDate(projectDetail.subscription.currentPeriodEnd)} />
                    </>
                  )}
                </div>

                {/* Recent payments for this project */}
                {projectDetail.recentPayments.length > 0 && (
                  <div className="mt-3">
                    <h4 className="font-mono text-[10px] font-bold uppercase tracking-widest text-brand-gray">PAYMENT_HISTORY</h4>
                    <div className="mt-1 space-y-1">
                      {projectDetail.recentPayments.map((pay) => (
                        <div key={pay.id} className="flex items-center justify-between font-mono text-[10px]">
                          <span className="text-brand-gray">{formatDate(pay.createdAt)}</span>
                          <span className="text-brand-white">${((pay as unknown as { amountUsdCents: number }).amountUsdCents / 100).toFixed(2)}</span>
                          <span className={`uppercase ${statusColor(pay.status)}`}>{pay.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right: subscription editor */}
              <div className="rounded-[2px] border border-brand-green bg-brand-black p-4 space-y-4">
                <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-brand-white">SUBSCRIPTION_OVERRIDE</h3>
                <p className="font-mono text-[10px] text-brand-gray">MANUALLY SET THE TIER, STATUS, AND PERIOD FOR THIS PROJECT</p>

                <div>
                  <label className="block font-mono text-[10px] text-brand-gray">TIER</label>
                  <div className="mt-1 flex gap-2">
                    {["free", "growth", "pro", "enterprise"].map((t) => (
                      <button
                        key={t}
                        onClick={() => setOverrideTier(t)}
                        className={`rounded-[2px] border px-3 py-1.5 font-mono text-xs uppercase transition ${
                          overrideTier === t
                            ? "border-brand-white bg-brand-white text-brand-black"
                            : `${tierColor(t)} hover:bg-brand-white/5`
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-[10px] text-brand-gray">STATUS</label>
                  <div className="mt-1 flex gap-2">
                    {["active", "past_due", "cancelled"].map((s) => (
                      <button
                        key={s}
                        onClick={() => setOverrideStatus(s)}
                        className={`rounded-[2px] border px-3 py-1.5 font-mono text-xs uppercase transition ${
                          overrideStatus === s
                            ? "border-brand-white bg-brand-white text-brand-black"
                            : "border-brand-green text-brand-gray hover:text-brand-white"
                        }`}
                      >
                        {s.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-[10px] text-brand-gray">PERIOD_END</label>
                  <input
                    type="datetime-local"
                    value={overridePeriodEnd}
                    onChange={(e) => setOverridePeriodEnd(e.target.value)}
                    className="mt-1 w-full rounded-[2px] border border-brand-green bg-brand-void px-3 py-2 font-mono text-xs text-brand-white focus:border-brand-white focus:outline-none focus:ring-1 focus:ring-brand-white"
                  />
                  {/* Quick presets */}
                  <div className="mt-1 flex gap-2">
                    {[
                      { label: "+1M", days: 30 },
                      { label: "+3M", days: 90 },
                      { label: "+1Y", days: 365 },
                      { label: "FOREVER", days: 365 * 100 },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() =>
                          setOverridePeriodEnd(
                            new Date(Date.now() + preset.days * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
                          )
                        }
                        className="rounded-[2px] border border-brand-green/50 px-2 py-0.5 font-mono text-[9px] text-brand-gray transition hover:text-brand-white"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-[10px] text-brand-gray">NOTES (OPTIONAL)</label>
                  <input
                    type="text"
                    value={overrideNotes}
                    onChange={(e) => setOverrideNotes(e.target.value)}
                    placeholder="Reason for override..."
                    className="mt-1 w-full rounded-[2px] border border-brand-green bg-brand-void px-3 py-2 font-mono text-xs text-brand-white focus:border-brand-white focus:outline-none focus:ring-1 focus:ring-brand-white"
                  />
                </div>

                <button
                  onClick={handleOverride}
                  disabled={overrideLoading}
                  className="w-full rounded-[2px] bg-brand-green px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-widest text-brand-black transition hover:bg-brand-green/80 disabled:opacity-50"
                >
                  {overrideLoading ? "SAVING..." : "SAVE OVERRIDE"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="rounded-[2px] border border-brand-green bg-brand-black p-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-brand-gray">{label}</p>
      <p className="mt-1 font-mono text-2xl font-bold text-brand-white">{value}</p>
      <p className="mt-0.5 font-mono text-[10px] text-brand-gray">{sub}</p>
    </div>
  );
}

function InfoRow({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-brand-gray">{label}</span>
      <span className={className ?? "text-brand-white"}>{value}</span>
    </div>
  );
}
