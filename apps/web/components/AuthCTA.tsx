"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";

/**
 * Hero CTA — shows "OPEN DASHBOARD" if logged in, "LOGIN WITH DISCORD" otherwise.
 */
export function HeroCTA() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <span className="rounded-[2px] border border-brand-gray bg-brand-black px-8 py-4 font-mono text-sm font-semibold tracking-widest text-brand-gray uppercase">
        LOADING...
      </span>
    );
  }

  if (isAuthenticated) {
    return (
      <Link
        href="/dashboard"
        className="rounded-[2px] border border-brand-white bg-brand-white px-8 py-4 font-mono text-sm font-semibold tracking-widest text-brand-black transition hover:bg-brand-gray hover:border-brand-gray uppercase"
      >
        OPEN DASHBOARD
      </Link>
    );
  }

  return (
    <a
      href={api.getLoginUrl()}
      className="rounded-[2px] border border-brand-white bg-brand-white px-8 py-4 font-mono text-sm font-semibold tracking-widest text-brand-black transition hover:bg-brand-gray hover:border-brand-gray uppercase"
    >
      LOGIN WITH DISCORD
    </a>
  );
}

/**
 * Pricing card CTA — shows "MANAGE PLAN" if logged in, "GET STARTED" otherwise.
 */
export function PricingCTA() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return (
      <Link
        href="/dashboard"
        className="flex w-full items-center justify-center rounded-[2px] border border-brand-green bg-brand-black px-4 py-3 font-mono text-xs font-bold uppercase tracking-widest text-brand-white transition hover:bg-brand-green/20"
      >
        MANAGE PLAN
      </Link>
    );
  }

  return (
    <a
      href={api.getLoginUrl()}
      className="flex w-full items-center justify-center rounded-[2px] border border-brand-green bg-brand-black px-4 py-3 font-mono text-xs font-bold uppercase tracking-widest text-brand-white transition hover:bg-brand-green/20"
    >
      GET STARTED
    </a>
  );
}
