"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useEffect, useState, useRef, useCallback } from "react";
import { formatShortDate } from "@/lib/format";
import Script from "next/script";
import type { BillingPlan, SubscriptionStatus, SubscriptionTier } from "@megaeth-verify/shared";
import { toast } from "sonner";

interface Project {
  id: string;
  name: string;
  discordGuildId: string;
  verificationChannelId: string | null;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface SubscriptionState {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  inGracePeriod: boolean;
  currentPeriodEnd: string;
}

interface PlanLimits {
  maxVerifiedMembers: number | null;
  maxServers: number | null;
  maxContracts: number | null;
  maxRoleMappings: number | null;
  maxAdminChecksPerMonth: number | null;
}

interface PlanWithLimits extends BillingPlan {
  limits: PlanLimits;
}

interface VerificationStats {
  totalVerifications: number;
  activeVerifications: number;
  recentVerifications: number;
}

function formatLimit(value: number | null): string {
  return typeof value === "number" ? value.toLocaleString() : "Unlimited";
}

export default function SettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => api.fetch<Project>(`/api/v1/projects/${projectId}`),
  });

  const { data: subscription, refetch: refetchSubscription } = useQuery({
    queryKey: ["billing-subscription", projectId],
    queryFn: () => api.fetch<SubscriptionState>(`/api/v1/billing/subscription?projectId=${projectId}`),
  });

  const { data: plans } = useQuery({
    queryKey: ["billing-plans"],
    queryFn: () => api.fetch<PlanWithLimits[]>("/api/v1/billing/plans"),
  });

  const { data: stats } = useQuery({
    queryKey: ["verification-stats", projectId],
    queryFn: () => api.fetch<{ data: VerificationStats }>(`/api/v1/projects/${projectId}/verifications/stats`),
  });

  const [name, setName] = useState("");
  const [channelId, setChannelId] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [billingLoading, setBillingLoading] = useState<SubscriptionTier | "portal" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [pollCount, setPollCount] = useState(0);
  const [pendingTransactionId, setPendingTransactionId] = useState<string | null>(null);
  const paddleInitialized = useRef(false);

  // Initialize Paddle.js once
  const initPaddle = useCallback(() => {
    if (paddleInitialized.current) return;
    const PaddleGlobal = (window as unknown as { Paddle?: Record<string, unknown> }).Paddle as
      | { Initialize: (opts: Record<string, unknown>) => void; Checkout: { open: (opts: Record<string, unknown>) => void } }
      | undefined;
    if (!PaddleGlobal) return;

    const paddleEnv = process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT || "sandbox";
    const paddleToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || "test_8691a29852587d962291023743c";
    if (paddleEnv === "sandbox" && (PaddleGlobal as unknown as { Environment?: { set: (env: string) => void } }).Environment) {
      (PaddleGlobal as unknown as { Environment: { set: (env: string) => void } }).Environment.set("sandbox");
    }
    PaddleGlobal.Initialize({
      token: paddleToken,
      eventCallback: (event: { name?: string; data?: Record<string, unknown> }) => {
        if (event.name === "checkout.completed") {
          const txId = localStorage.getItem(`pendingTx:${projectId}`);
          if (txId) {
            setPendingTransactionId(txId);
            toast.success("Payment completed! Activating your plan...");
            setPollCount(1);
          }
        }
      },
    });
    paddleInitialized.current = true;
  }, [projectId]);

  useEffect(() => {
    if (project) {
      setName(project.name);
      setChannelId(project.verificationChannelId ?? "");
    }
  }, [project]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.fetch(`/api/v1/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          verificationChannelId: channelId || null,
        }),
      });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Settings saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.fetch(`/api/v1/projects/${projectId}`, { method: "DELETE" });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
      setDeleting(false);
    }
  };

  const handleCheckout = async (tier: SubscriptionTier) => {
    if (tier === "free") return;

    setBillingLoading(tier);

    try {
      const response = await api.fetch<{ id: string; url: string | null }>("/api/v1/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ projectId, tier }),
      });

      if (!response.id) {
        throw new Error("Transaction ID was not returned.");
      }

      localStorage.setItem(`pendingTx:${projectId}`, response.id);

      initPaddle();
      const PaddleGlobal = (window as unknown as { Paddle?: { Checkout: { open: (opts: Record<string, unknown>) => void } } }).Paddle;
      if (!PaddleGlobal) {
        throw new Error("Paddle.js not loaded. Please refresh and try again.");
      }

      PaddleGlobal.Checkout.open({
        transactionId: response.id,
        settings: {
          displayMode: "overlay",
          theme: "dark",
          locale: "en",
          successUrl: `${window.location.origin}/dashboard/${projectId}/settings?billing=success`,
        },
      });

      setBillingLoading(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open checkout");
      setBillingLoading(null);
    }
  };

  const handlePortal = async () => {
    setBillingLoading("portal");

    try {
      const response = await api.fetch<{ url: string }>("/api/v1/billing/portal", {
        method: "POST",
        body: JSON.stringify({ projectId }),
      });

      window.location.href = response.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open billing portal");
      setBillingLoading(null);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const billingState = params.get("billing");

    if (billingState === "success") {
      const txId = localStorage.getItem(`pendingTx:${projectId}`);
      if (txId) {
        setPendingTransactionId(txId);
      }
      toast.success("Payment completed! Activating your plan...");
      setPollCount(1);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [projectId]);

  // Poll for subscription activation
  useEffect(() => {
    if (pollCount === 0) return;
    if (pollCount > 20) {
      toast.success("Payment received. Your plan may take a moment to activate — please refresh shortly.");
      localStorage.removeItem(`pendingTx:${projectId}`);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        if (pendingTransactionId) {
          const result = await api.fetch<{ activated: boolean; tier: string; transactionStatus: string }>(
            "/api/v1/billing/activate",
            {
              method: "POST",
              body: JSON.stringify({ projectId, transactionId: pendingTransactionId }),
            },
          );

          if (result.activated && result.tier !== "free") {
            toast.success(`Your ${result.tier.charAt(0).toUpperCase() + result.tier.slice(1)} plan is now active!`);
            setPollCount(0);
            localStorage.removeItem(`pendingTx:${projectId}`);
            refetchSubscription();
            return;
          }
        } else {
          const result = await refetchSubscription();
          const newTier = result.data?.tier;
          if (newTier && newTier !== "free") {
            toast.success(`Your ${newTier.charAt(0).toUpperCase() + newTier.slice(1)} plan is now active!`);
            setPollCount(0);
            return;
          }
        }
      } catch {
        // Ignore polling errors
      }
      setPollCount((c) => c + 1);
    }, 2500);

    return () => clearTimeout(timer);
  }, [pollCount, refetchSubscription, pendingTransactionId, projectId]);

  // Compute usage stats
  const currentPlan = plans?.find((p) => p.tier === (subscription?.tier ?? "free"));
  const activeMembers = stats?.data?.activeVerifications ?? 0;
  const memberLimit = currentPlan?.limits?.maxVerifiedMembers ?? null;
  const usagePercent = memberLimit ? Math.min(100, Math.round((activeMembers / memberLimit) * 100)) : 0;
  const isFree = !subscription || subscription.tier === "free";

  if (isLoading) {
    return <p className="font-mono text-sm tracking-widest text-brand-gray uppercase">LOADING_SETTINGS...</p>;
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-brand-white">Settings</h1>

      {/* H1: Billing section with usage stats */}
      <section className="mt-6 rounded-[2px] border border-brand-green bg-brand-void p-4">
        <h2 className="text-lg font-semibold text-brand-white">Billing</h2>
        <p className="mt-1 font-mono text-xs text-brand-gray">MANAGE_SUBSCRIPTION_PLAN_AND_LIMITS</p>

        <div className="mt-4 rounded-[2px] border border-brand-green/50 bg-brand-black p-3 text-sm">
          <p className="font-mono text-brand-gray">
            CURRENT_TIER: <span className="font-semibold text-brand-white">{subscription?.tier?.toUpperCase() ?? "FREE"}</span>
          </p>
          <p className="mt-1 font-mono text-brand-gray">
            STATUS: {subscription?.status?.toUpperCase() ?? "ACTIVE"}
            {subscription?.inGracePeriod ? " (GRACE_PERIOD_ACTIVE)" : ""}
          </p>
          {subscription?.inGracePeriod && (
            <p className="mt-1 font-mono text-brand-red">
              GRACE_PERIOD_ENDS: {formatShortDate(subscription.currentPeriodEnd)}
            </p>
          )}

          {/* Usage progress bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between font-mono text-xs text-brand-gray">
              <span>VERIFIED_MEMBERS</span>
              <span>{activeMembers.toLocaleString()} / {memberLimit ? memberLimit.toLocaleString() : "Unlimited"}</span>
            </div>
            {memberLimit && (
              <div className="mt-1 h-2 w-full rounded-full bg-brand-gray/20">
                <div
                  className={`h-2 rounded-full transition-all ${usagePercent >= 90 ? "bg-brand-red" : usagePercent >= 70 ? "bg-yellow-500" : "bg-brand-green"}`}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
            )}
          </div>

          {/* H2: Disable manage subscription for free tier */}
          {isFree ? (
            <p className="mt-3 font-mono text-xs text-brand-gray">NO_ACTIVE_SUBSCRIPTION — CHOOSE_A_PLAN_BELOW</p>
          ) : (
            <button
              onClick={handlePortal}
              disabled={billingLoading !== null}
              className="mt-3 rounded-[2px] border border-brand-green px-3 py-1.5 text-sm font-medium text-brand-white transition hover:bg-brand-green/10 disabled:opacity-50"
            >
              {billingLoading === "portal" ? "OPENING_PORTAL..." : "MANAGE SUBSCRIPTION"}
            </button>
          )}
        </div>

        {/* H3: Full feature comparison on plan cards */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {plans?.map((plan) => (
            <div key={plan.tier} className="rounded-[2px] border border-brand-green/50 bg-brand-black p-3 text-sm">
              <p className="font-semibold text-brand-white">{plan.label}</p>
              <p className="mt-1 font-mono text-brand-gray">
                {plan.priceMonthlyUsd === null ? "CONTACT" : `$${plan.priceMonthlyUsd}/MO`}
              </p>
              <div className="mt-2 space-y-0.5 font-mono text-xs text-brand-gray">
                <p>MEMBERS: {formatLimit(plan.limits.maxVerifiedMembers)}</p>
                <p>CONTRACTS: {formatLimit(plan.limits.maxContracts)}</p>
                <p>ROLE_MAPPINGS: {formatLimit(plan.limits.maxRoleMappings)}</p>
                <p>SERVERS: {formatLimit(plan.limits.maxServers)}</p>
                <p>ADMIN_CHECKS: {formatLimit(plan.limits.maxAdminChecksPerMonth)}</p>
              </div>
              {plan.tier === "enterprise" ? (
                <a
                  href="mailto:support@usecachet.com?subject=Enterprise%20Plan%20Inquiry"
                  className="mt-3 inline-flex w-full items-center justify-center rounded-[2px] border border-brand-green bg-brand-black px-3 py-1.5 text-xs font-medium text-brand-white transition hover:bg-brand-green/10"
                >
                  CONTACT US
                </a>
              ) : (
                <button
                  onClick={() => handleCheckout(plan.tier)}
                  disabled={plan.tier === "free" || billingLoading !== null || plan.tier === subscription?.tier}
                  className="mt-3 rounded-[2px] bg-brand-white px-3 py-1.5 text-xs font-medium text-brand-black transition hover:bg-brand-gray disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {billingLoading === plan.tier ? "OPENING..." : plan.tier === "free" ? "INCLUDED" : plan.tier === subscription?.tier ? "CURRENT PLAN" : `CHOOSE ${plan.label.toUpperCase()}`}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <form onSubmit={handleSave} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-brand-gray">Project Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            className="mt-1 w-full rounded-[2px] border border-brand-green bg-brand-black px-3 py-2 text-sm text-brand-white focus:border-brand-white focus:outline-none focus:ring-1 focus:ring-brand-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-brand-gray">Discord Server ID</label>
          <input
            type="text"
            value={project?.discordGuildId ?? ""}
            disabled
            className="mt-1 w-full rounded-[2px] border border-brand-gray/30 bg-brand-void px-3 py-2 text-sm text-brand-gray"
          />
          <p className="mt-1 font-mono text-xs text-brand-gray">CANNOT_BE_CHANGED_AFTER_CREATION</p>
        </div>

        {/* H7: Editable verification channel */}
        <div>
          <label className="block text-sm font-medium text-brand-gray">Verification Channel ID</label>
          <input
            type="text"
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            placeholder="Enter Discord channel ID..."
            className="mt-1 w-full rounded-[2px] border border-brand-green bg-brand-black px-3 py-2 text-sm text-brand-white focus:border-brand-white focus:outline-none focus:ring-1 focus:ring-brand-white"
          />
          <p className="mt-1 font-mono text-xs text-brand-gray">CHANNEL_WHERE_VERIFICATION_BOT_SENDS_MESSAGES</p>
        </div>

        {/* H4: Human-readable created at */}
        <div>
          <label className="block text-sm font-medium text-brand-gray">Created At</label>
          <p className="mt-1 font-mono text-sm text-brand-white">
            {project ? formatShortDate(project.createdAt) : ""}
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-[2px] bg-brand-green px-4 py-2 text-sm font-medium text-brand-black transition hover:bg-brand-green/80 disabled:opacity-50"
        >
          {saving ? "SAVING..." : "SAVE SETTINGS"}
        </button>
      </form>

      {/* H6: Type-to-confirm danger zone */}
      <div className="mt-12 rounded-[2px] border border-brand-red p-4 bg-brand-black">
        <h2 className="text-lg font-semibold text-brand-red">Danger Zone</h2>
        <p className="mt-1 font-mono text-xs text-brand-gray">
          DELETING_PROJECT_PERFORMS_SOFT_DELETE. DATA_PRESERVED_FOR_30_DAYS.
        </p>

        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="mt-4 rounded-[2px] border border-brand-red px-4 py-2 text-sm text-brand-red transition hover:bg-brand-red/10"
          >
            DELETE PROJECT
          </button>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="font-mono text-sm text-brand-gray">
              TYPE <span className="font-semibold text-brand-white">{project?.name}</span> TO CONFIRM:
            </p>
            <input
              type="text"
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder={project?.name ?? "project name"}
              className="w-full rounded-[2px] border border-brand-red bg-brand-black px-3 py-2 text-sm text-brand-white focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={handleDelete}
                disabled={deleting || deleteConfirmName !== project?.name}
                className="rounded-[2px] bg-brand-red px-4 py-2 text-sm font-medium text-brand-black transition hover:bg-brand-red/80 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? "DELETING..." : "CONFIRM DELETE"}
              </button>
              <button
                onClick={() => { setConfirmDelete(false); setDeleteConfirmName(""); }}
                className="text-sm font-medium text-brand-gray transition hover:text-brand-white"
              >
                CANCEL
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Paddle.js — only loaded on settings page where checkout happens */}
      <Script src="https://cdn.paddle.com/paddle/v2/paddle.js" strategy="lazyOnload" />
    </div>
  );
}
