"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState, useEffect, useRef, Suspense } from "react";
import { formatShortDate } from "@/lib/format";

interface Verification {
  id: string;
  userDiscordId: string;
  walletAddress: string;
  rolesGranted: string[];
  verifiedAt: string;
  lastChecked: string;
  status: "active" | "expired" | "revoked";
}

interface PaginatedResult {
  items: Verification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function VerificationsInner() {
  const { projectId } = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const status = searchParams.get("status") ?? "";
  const search = searchParams.get("search") ?? "";

  const [searchInput, setSearchInput] = useState(search);
  const [reverifying, setReverifying] = useState<string | null>(null);
  const [reverifyError, setReverifyError] = useState("");
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const queryString = new URLSearchParams({
    page: String(page),
    limit: "20",
    ...(status && { status }),
    ...(search && { search }),
  }).toString();

  const { data, isLoading } = useQuery({
    queryKey: ["verifications", projectId, page, status, search],
    queryFn: () => api.fetch<PaginatedResult>(`/api/v1/projects/${projectId}/verifications?${queryString}`),
  });

  // Fetch counts for all statuses
  const { data: allData } = useQuery({
    queryKey: ["verifications", projectId, "all-counts"],
    queryFn: () => api.fetch<PaginatedResult>(`/api/v1/projects/${projectId}/verifications?limit=1000`),
  });

  const statusCounts = {
    active: 0,
    expired: 0,
    revoked: 0,
  };
  if (allData?.items) {
    for (const v of allData.items) {
      if (v.status in statusCounts) {
        statusCounts[v.status]++;
      }
    }
  }

  const updateParams = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, val] of Object.entries(updates)) {
      if (val) params.set(key, val);
      else params.delete(key);
    }
    router.push(`/dashboard/${projectId}/verifications?${params.toString()}`);
  };

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (searchInput !== search) {
        updateParams({ search: searchInput, page: "1" });
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    updateParams({ search: searchInput, page: "1" });
  };

  const handleReverify = async (verificationId: string) => {
    setReverifying(verificationId);
    setReverifyError("");
    try {
      await api.fetch(`/api/v1/projects/${projectId}/verifications/${verificationId}/reverify`, {
        method: "POST",
      });
      queryClient.invalidateQueries({ queryKey: ["verifications", projectId] });
    } catch (err) {
      setReverifyError(err instanceof Error ? err.message : "Reverify failed");
    } finally {
      setReverifying(null);
    }
  };

  const handleCopyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch {
      // Fallback: silently fail
    }
  };

  const handleExportCSV = () => {
    if (!allData?.items || allData.items.length === 0) return;
    const headers = ["Discord ID", "Wallet Address", "Status", "Roles Granted", "Verified At", "Last Checked"];
    const rows = allData.items.map((v) => [
      v.userDiscordId,
      v.walletAddress,
      v.status,
      (v.rolesGranted ?? []).join("; "),
      v.verifiedAt,
      v.lastChecked,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `verifications-${projectId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalCount = allData?.items?.length ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-brand-white">Verifications</h1>
        {totalCount > 0 && (
          <button
            onClick={handleExportCSV}
            className="rounded-[2px] border border-brand-green px-4 py-2 text-sm font-medium text-brand-green transition hover:bg-brand-green/10"
          >
            EXPORT CSV
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by wallet or Discord ID..."
            className="w-72 rounded-[2px] border border-brand-green bg-brand-black px-3 py-2 text-sm text-brand-white focus:border-brand-white focus:outline-none focus:ring-1 focus:ring-brand-white"
          />
        </form>

        <select
          value={status}
          onChange={(e) => updateParams({ status: e.target.value, page: "1" })}
          className="rounded-[2px] border border-brand-green bg-brand-black px-3 py-2 text-sm text-brand-white focus:border-brand-white focus:outline-none focus:ring-1 focus:ring-brand-white"
        >
          <option value="">ALL_STATUSES ({totalCount})</option>
          <option value="active">ACTIVE ({statusCounts.active})</option>
          <option value="expired">EXPIRED ({statusCounts.expired})</option>
          <option value="revoked">REVOKED ({statusCounts.revoked})</option>
        </select>
      </div>

      {reverifyError && (
        <p className="mt-2 font-mono text-sm text-brand-red">{reverifyError}</p>
      )}

      {/* Table */}
      {isLoading ? (
        <p className="mt-6 font-mono text-sm tracking-widest text-brand-gray uppercase">LOADING_VERIFICATIONS...</p>
      ) : !data || data.items.length === 0 ? (
        <p className="mt-8 text-center font-mono text-sm text-brand-gray">NO_VERIFICATIONS_FOUND</p>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto rounded-[2px] border border-brand-green bg-brand-void font-mono">
            <table className="w-full text-left text-sm">
              <thead className="bg-brand-black">
                <tr className="border-b border-brand-green text-brand-gray text-xs tracking-wider">
                  <th className="px-3 py-3 uppercase">Discord ID</th>
                  <th className="px-3 py-3 uppercase">Wallet</th>
                  <th className="px-3 py-3 uppercase">Status</th>
                  <th className="px-3 py-3 uppercase">Roles</th>
                  <th className="px-3 py-3 uppercase">Verified</th>
                  <th className="px-3 py-3 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((v) => (
                  <tr key={v.id} className="border-b border-brand-green/30 transition hover:bg-brand-green/10">
                    <td className="px-3 py-3 text-brand-white">{v.userDiscordId}</td>
                    <td className="px-3 py-3 text-brand-gray">
                      <button
                        onClick={() => handleCopyAddress(v.walletAddress)}
                        className="group flex items-center gap-1 transition hover:text-brand-white"
                        title="Click to copy full address"
                      >
                        <span>{v.walletAddress.slice(0, 6)}...{v.walletAddress.slice(-4)}</span>
                        <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                          {copiedAddress === v.walletAddress ? "\u2713" : "\u2398"}
                        </span>
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-[2px] border px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${v.status === "active"
                            ? "border-brand-green/50 bg-brand-green/10 text-brand-green"
                            : "border-brand-red/50 bg-brand-red/10 text-brand-red"
                          }`}
                      >
                        {v.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-brand-white">{v.rolesGranted?.length ?? 0}</td>
                    <td className="px-3 py-3 text-brand-gray">
                      {formatShortDate(v.verifiedAt)}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => handleReverify(v.id)}
                        disabled={reverifying === v.id}
                        className="rounded-[2px] border border-brand-green px-2 py-1 text-xs font-medium text-brand-green transition hover:bg-brand-green/20 disabled:opacity-50"
                      >
                        {reverifying === v.id ? "..." : "RE-VERIFY"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between font-mono text-sm text-brand-gray">
              <p>
                PAGE {data.pagination.page} OF {data.pagination.totalPages} ({data.pagination.total} TOTAL)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => updateParams({ page: String(page - 1) })}
                  disabled={page <= 1}
                  className="rounded-[2px] border border-brand-green px-3 py-1 font-medium transition hover:bg-brand-green/10 disabled:opacity-50 text-brand-white hover:text-brand-white"
                >
                  PREV
                </button>
                <button
                  onClick={() => updateParams({ page: String(page + 1) })}
                  disabled={page >= data.pagination.totalPages}
                  className="rounded-[2px] border border-brand-green px-3 py-1 font-medium transition hover:bg-brand-green/10 disabled:opacity-50 text-brand-white hover:text-brand-white"
                >
                  NEXT
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function VerificationsPage() {
  return (
    <Suspense fallback={<p className="font-mono text-sm tracking-widest text-brand-gray uppercase">LOADING...</p>}>
      <VerificationsInner />
    </Suspense>
  );
}
