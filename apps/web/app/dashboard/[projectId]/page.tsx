"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";
import dynamic from "next/dynamic";

const VerificationChart = dynamic(() => import("@/components/VerificationChart"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[250px] items-center justify-center">
      <p className="font-mono text-sm text-brand-gray animate-pulse">LOADING_CHART...</p>
    </div>
  ),
});

interface Stats {
  totalVerifications: number;
  activeVerifications: number;
  recentVerifications: number;
  recentActivity: {
    id: string;
    eventType: string;
    details: Record<string, unknown>;
    createdAt: string;
    userDiscordId: string;
    walletAddress: string;
  }[];
}

interface DailyCount {
  date: string;
  count: number;
}

interface Contract {
  id: string;
}

interface RoleMapping {
  id: string;
}

export default function OverviewPage() {
  const { projectId } = useParams<{ projectId: string }>();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["stats", projectId],
    queryFn: () => api.fetch<Stats>(`/api/v1/projects/${projectId}/verifications/stats`),
  });

  const { data: dailyCounts } = useQuery({
    queryKey: ["daily", projectId],
    queryFn: () => api.fetch<DailyCount[]>(`/api/v1/projects/${projectId}/verifications/daily`),
  });

  const { data: contracts } = useQuery({
    queryKey: ["contracts", projectId],
    queryFn: () => api.fetch<Contract[]>(`/api/v1/projects/${projectId}/contracts`),
  });

  const { data: roles } = useQuery({
    queryKey: ["roles", projectId],
    queryFn: () => api.fetch<RoleMapping[]>(`/api/v1/projects/${projectId}/roles`),
  });

  if (statsLoading) {
    return <p className="font-mono text-sm tracking-widest text-brand-gray uppercase">LOADING_OVERVIEW...</p>;
  }

  const statCards = [
    { label: "TOTAL_VERIFICATIONS", value: stats?.totalVerifications ?? 0 },
    { label: "ACTIVE", value: stats?.activeVerifications ?? 0 },
    { label: "LAST_7_DAYS", value: stats?.recentVerifications ?? 0 },
  ];

  const hasContracts = contracts && contracts.length > 0;
  const hasRoles = roles && roles.length > 0;
  const showQuickActions = !hasContracts || !hasRoles;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-white">Overview</h1>

      {/* Quick-action cards for new users */}
      {showQuickActions && (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {!hasContracts && (
            <Link
              href={`/dashboard/${projectId}/contracts`}
              className="rounded-[2px] border border-dashed border-brand-green bg-brand-void p-4 transition hover:bg-brand-green/10"
            >
              <p className="font-mono text-xs font-bold uppercase tracking-widest text-brand-green">GET STARTED</p>
              <p className="mt-2 text-sm font-semibold text-brand-white">Add your first contract</p>
              <p className="mt-1 font-mono text-xs text-brand-gray">Add an NFT contract address to start verifying holders.</p>
            </Link>
          )}
          {!hasRoles && (
            <Link
              href={`/dashboard/${projectId}/roles`}
              className="rounded-[2px] border border-dashed border-brand-green bg-brand-void p-4 transition hover:bg-brand-green/10"
            >
              <p className="font-mono text-xs font-bold uppercase tracking-widest text-brand-green">GET STARTED</p>
              <p className="mt-2 text-sm font-semibold text-brand-white">Set up role mappings</p>
              <p className="mt-1 font-mono text-xs text-brand-gray">Map NFT contracts to Discord roles for automatic assignment.</p>
            </Link>
          )}
        </div>
      )}

      {/* Stats cards — responsive */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-[2px] border border-brand-green bg-brand-void p-4"
          >
            <p className="font-mono text-xs text-brand-gray">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold text-brand-white">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="mt-8 rounded-[2px] border border-brand-green bg-brand-void p-4">
        <h2 className="mb-4 text-lg font-semibold text-brand-white">Verification Activity (30 days)</h2>
        {dailyCounts && dailyCounts.length > 0 ? (
          <VerificationChart data={dailyCounts} />
        ) : (
          <div className="py-12 text-center">
            <p className="font-mono text-sm text-brand-gray">NO VERIFICATION DATA YET</p>
            <p className="mt-2 font-mono text-xs text-brand-gray max-w-md mx-auto">
              Set up contracts and role mappings to start receiving verifications.
            </p>
          </div>
        )}
      </div>

      {/* Recent activity */}
      <div className="mt-8 rounded-[2px] border border-brand-green bg-brand-void p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-brand-white">Recent Activity</h2>
          <Link
            href={`/dashboard/${projectId}/verifications`}
            className="font-mono text-xs uppercase tracking-widest text-brand-green hover:text-brand-white transition"
          >
            VIEW ALL
          </Link>
        </div>
        {stats?.recentActivity && stats.recentActivity.length > 0 ? (
          <div className="space-y-2">
            {stats.recentActivity.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between rounded-[2px] border border-brand-green/30 bg-brand-black px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-mono font-medium text-brand-white">{log.eventType}</span>
                  <span className="ml-2 font-mono text-brand-gray">
                    {log.walletAddress.slice(0, 6)}...{log.walletAddress.slice(-4)}
                  </span>
                </div>
                <span className="font-mono text-xs text-brand-gray">
                  {formatRelativeTime(log.createdAt)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-4 text-center font-mono text-sm text-brand-gray">NO_ACTIVITY</p>
        )}
      </div>
    </div>
  );
}
