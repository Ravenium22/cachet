"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BILLING_PLANS, TIER_LIMITS } from "@megaeth-verify/shared";
import type { SubscriptionTier } from "@megaeth-verify/shared";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";

function formatLimit(value: number): string {
    if (!Number.isFinite(value)) {
        return "Unlimited";
    }
    return value.toLocaleString();
}

interface ProjectSummary {
    id: string;
    name: string;
}

interface SubscriptionState {
    tier: SubscriptionTier;
    status: string;
}

const pricingFaqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
        {
            "@type": "Question",
            name: "What payment methods do you accept?",
            acceptedAnswer: {
                "@type": "Answer",
                text: "We accept USDC and USDT stablecoin payments on Ethereum, Base, and Arbitrum. All prices are in USD.",
            },
        },
        {
            "@type": "Question",
            name: "Can I change plans at any time?",
            acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. Upgrades take effect immediately. Downgrades apply at the end of your current billing cycle.",
            },
        },
        {
            "@type": "Question",
            name: "Is there a free trial?",
            acceptedAnswer: {
                "@type": "Answer",
                text: "The Free tier is available indefinitely with up to 100 verified members. No credit card required.",
            },
        },
        {
            "@type": "Question",
            name: "What happens if I exceed my plan limits?",
            acceptedAnswer: {
                "@type": "Answer",
                text: "You will be prompted to upgrade. Existing verifications remain active, but new verifications will be blocked until you upgrade or reduce usage.",
            },
        },
        {
            "@type": "Question",
            name: "Can I get a refund?",
            acceptedAnswer: {
                "@type": "Answer",
                text: "All sales are final. We offer a free tier so you can evaluate the platform before committing. See our refund policy for details.",
            },
        },
    ],
};

export default function PricingPage() {
    const { isAuthenticated, isLoading } = useAuth();
    const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");

    const { data: projects } = useQuery({
        queryKey: ["projects"],
        queryFn: () => api.fetch<ProjectSummary[]>("/api/v1/projects"),
        enabled: isAuthenticated,
    });

    const firstProjectId = projects?.[0]?.id;

    const { data: subscription } = useQuery({
        queryKey: ["billing-subscription", firstProjectId],
        queryFn: () => api.fetch<SubscriptionState>(`/api/v1/billing/subscription?projectId=${firstProjectId}`),
        enabled: isAuthenticated && !!firstProjectId,
    });

    const currentTier = subscription?.tier ?? "free";
    const manageHref = firstProjectId ? `/dashboard/${firstProjectId}/settings` : "/dashboard";

    return (
        <div className="min-h-screen bg-brand-black text-brand-white flex flex-col font-sans">
            <JsonLd data={pricingFaqSchema} />
            <Header showAuth activePage="pricing" />

            <main className="relative flex-1 overflow-hidden">
                <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(10,143,84,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(10,143,84,0.3)_1px,transparent_1px)] [background-size:34px_34px]" />

                <section className="relative mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 lg:px-12">
                    <div className="mb-12">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-green">PRICING</p>
                        <h1 className="mt-2 text-4xl font-semibold uppercase tracking-tight text-brand-white sm:text-5xl">SIMPLE TIERS BUILT FOR NFT COMMUNITIES</h1>
                        <p className="mt-4 max-w-2xl font-mono text-sm uppercase tracking-widest text-brand-gray leading-relaxed">
                            Choose the plan that fits your community. Upgrade, downgrade, or cancel at any time.
                        </p>
                        <p className="mt-3 inline-block rounded-[2px] border border-brand-green bg-brand-green/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-brand-green">
                            CRYPTO PAYMENTS ACCEPTED — USDC / USDT ON ETHEREUM, BASE, ARBITRUM
                        </p>

                        {/* Billing interval toggle */}
                        <div className="mt-6 inline-flex items-center rounded-[2px] border border-brand-green bg-brand-void">
                            <button
                                onClick={() => setBillingInterval("monthly")}
                                className={`px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest transition ${billingInterval === "monthly"
                                    ? "bg-brand-green text-brand-black"
                                    : "text-brand-gray hover:text-brand-white"
                                    }`}
                            >
                                MONTHLY
                            </button>
                            <button
                                onClick={() => setBillingInterval("annual")}
                                className={`flex items-center gap-2 px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest transition ${billingInterval === "annual"
                                    ? "bg-brand-green text-brand-black"
                                    : "text-brand-gray hover:text-brand-white"
                                    }`}
                            >
                                ANNUAL
                                <span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] font-bold tracking-wider ${billingInterval === "annual"
                                    ? "bg-brand-black text-brand-green"
                                    : "bg-brand-green/20 text-brand-green"
                                    }`}>
                                    SAVE 20%
                                </span>
                            </button>
                        </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-4">
                        {BILLING_PLANS.map((plan) => {
                            const limits = TIER_LIMITS[plan.tier];
                            const isGrowth = plan.tier === "growth";
                            const isCurrent = isAuthenticated && plan.tier === currentTier;
                            const price = billingInterval === "annual" ? plan.priceAnnualUsd : plan.priceMonthlyUsd;
                            const perMonthPrice = billingInterval === "annual" && plan.priceAnnualUsd !== null
                                ? Math.round((plan.priceAnnualUsd / 12) * 100) / 100
                                : null;

                            return (
                                <article
                                    key={plan.tier}
                                    className={`rounded-[2px] border p-6 bg-brand-void ${isCurrent
                                        ? "border-brand-white ring-1 ring-brand-white"
                                        : isGrowth
                                            ? "border-brand-white"
                                            : "border-brand-green"
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        {isGrowth && !isCurrent && (
                                            <p className="mb-3 inline-block rounded-[2px] border border-brand-white bg-brand-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-brand-white">
                                                MOST POPULAR
                                            </p>
                                        )}
                                        {isCurrent && (
                                            <p className="mb-3 inline-block rounded-[2px] border border-brand-green bg-brand-green/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-brand-green">
                                                CURRENT PLAN
                                            </p>
                                        )}
                                    </div>
                                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-gray">{plan.label}</p>
                                    <div className="mt-4 flex items-baseline gap-1">
                                        <span className="text-4xl font-semibold text-brand-white tracking-tight">
                                            {price === null ? "CONTACT" : billingInterval === "annual" && price !== 0 ? `$${perMonthPrice}` : `$${price}`}
                                        </span>
                                        {price !== null && (
                                            <span className="text-sm font-mono text-brand-gray uppercase">/MO</span>
                                        )}
                                    </div>
                                    {billingInterval === "annual" && price !== null && price !== 0 && (
                                        <p className="mt-1 font-mono text-[10px] uppercase text-brand-gray">
                                            BILLED ${price}/YR
                                        </p>
                                    )}
                                    <p className="mt-3 font-mono text-xs uppercase text-brand-gray leading-relaxed">{plan.description}</p>

                                    <ul className="font-mono mt-6 space-y-3 text-xs uppercase text-brand-white">
                                        <li className="flex justify-between border-b border-brand-green/30 pb-2">
                                            <span className="text-brand-gray">VERIFIED_MEMBERS:</span> <span>{formatLimit(limits.maxVerifiedMembers)}</span>
                                        </li>
                                        <li className="flex justify-between border-b border-brand-green/30 pb-2">
                                            <span className="text-brand-gray">NFT_CONTRACTS:</span> <span>{formatLimit(limits.maxContracts)}</span>
                                        </li>
                                        <li className="flex justify-between border-b border-brand-green/30 pb-2">
                                            <span className="text-brand-gray">ROLE_MAPPINGS:</span> <span>{formatLimit(limits.maxRoleMappings)}</span>
                                        </li>
                                        <li className="flex justify-between border-b border-brand-green/30 pb-2">
                                            <span className="text-brand-gray">SERVERS:</span> <span>{formatLimit(limits.maxServers)}</span>
                                        </li>
                                        <li className="flex justify-between pb-2">
                                            <span className="text-brand-gray">ADMIN_CHECKS:</span>
                                            <span>{limits.maxAdminChecksPerMonth <= 0 ? "NONE" : `${formatLimit(limits.maxAdminChecksPerMonth)}/MO`}</span>
                                        </li>
                                    </ul>

                                    <div className="mt-8">
                                        {isLoading ? (
                                            <span className="flex w-full items-center justify-center rounded-[2px] border border-brand-gray bg-brand-black px-4 py-3 font-mono text-xs uppercase tracking-widest text-brand-gray">
                                                LOADING...
                                            </span>
                                        ) : isAuthenticated ? (
                                            isCurrent ? (
                                                <Link
                                                    href={manageHref}
                                                    className="flex w-full items-center justify-center rounded-[2px] border border-brand-green bg-brand-green/10 px-4 py-3 font-mono text-xs font-bold uppercase tracking-widest text-brand-green transition hover:bg-brand-green/20"
                                                >
                                                    CURRENT PLAN
                                                </Link>
                                            ) : (
                                                <Link
                                                    href={manageHref}
                                                    className="flex w-full items-center justify-center rounded-[2px] border border-brand-green bg-brand-black px-4 py-3 font-mono text-xs font-bold uppercase tracking-widest text-brand-white transition hover:bg-brand-green/20"
                                                >
                                                    MANAGE PLAN
                                                </Link>
                                            )
                                        ) : (
                                            <a
                                                href={api.getLoginUrl()}
                                                onClick={() => {
                                                    if (typeof window !== "undefined") {
                                                        localStorage.setItem("returnTo", "/dashboard");
                                                    }
                                                }}
                                                className="flex w-full items-center justify-center rounded-[2px] border border-brand-green bg-brand-black px-4 py-3 font-mono text-xs font-bold uppercase tracking-widest text-brand-white transition hover:bg-brand-green/20"
                                            >
                                                GET STARTED
                                            </a>
                                        )}
                                    </div>
                                </article>
                            );
                        })}
                    </div>

                    <div className="mt-16 rounded-[2px] border border-brand-green bg-brand-void p-8">
                        <h2 className="text-lg font-semibold uppercase tracking-tight text-brand-white">FREQUENTLY ASKED QUESTIONS</h2>

                        <div className="mt-6 space-y-6">
                            <div>
                                <p className="font-mono text-xs font-bold uppercase tracking-widest text-brand-white">WHAT PAYMENT METHODS DO YOU ACCEPT?</p>
                                <p className="mt-2 font-mono text-xs uppercase text-brand-gray leading-relaxed">
                                    We accept USDC and USDT stablecoin payments on Ethereum, Base, and Arbitrum. All prices are in USD.
                                </p>
                            </div>
                            <div>
                                <p className="font-mono text-xs font-bold uppercase tracking-widest text-brand-white">CAN I CHANGE PLANS AT ANY TIME?</p>
                                <p className="mt-2 font-mono text-xs uppercase text-brand-gray leading-relaxed">
                                    Yes. Upgrades take effect immediately. Downgrades apply at the end of your current billing cycle.
                                </p>
                            </div>
                            <div>
                                <p className="font-mono text-xs font-bold uppercase tracking-widest text-brand-white">IS THERE A FREE TRIAL?</p>
                                <p className="mt-2 font-mono text-xs uppercase text-brand-gray leading-relaxed">
                                    The Free tier is available indefinitely with up to 100 verified members. No credit card required.
                                </p>
                            </div>
                            <div>
                                <p className="font-mono text-xs font-bold uppercase tracking-widest text-brand-white">WHAT HAPPENS IF I EXCEED MY PLAN LIMITS?</p>
                                <p className="mt-2 font-mono text-xs uppercase text-brand-gray leading-relaxed">
                                    You will be prompted to upgrade. Existing verifications remain active, but new verifications will be blocked until you upgrade or reduce usage.
                                </p>
                            </div>
                            <div>
                                <p className="font-mono text-xs font-bold uppercase tracking-widest text-brand-white">CAN I GET A REFUND?</p>
                                <p className="mt-2 font-mono text-xs uppercase text-brand-gray leading-relaxed">
                                    All sales are final. We offer a free tier so you can evaluate the platform before committing. See our{" "}
                                    <Link href="/refund-policy" className="text-brand-green hover:underline">refund policy</Link> for details.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
}
