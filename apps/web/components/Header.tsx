"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";

interface HeaderProps {
    showAuth?: boolean;
    activePage?: "pricing";
}

export function Header({ showAuth = false, activePage }: HeaderProps) {
    const { isAuthenticated } = useAuth();

    return (
        <header className="flex flex-wrap w-full items-center justify-between gap-y-4 border-b border-brand-green bg-brand-void px-6 py-4">
            <Link href="/" className="text-xl font-bold tracking-tight text-brand-white">cachet.</Link>
            <nav className="flex flex-wrap items-center justify-center gap-8 sm:gap-12">
                <Link
                    href="/docs"
                    className="font-mono text-sm uppercase tracking-widest text-brand-gray hover:text-brand-white transition"
                >
                    DOCS
                </Link>
                <Link
                    href="/pricing"
                    className={`font-mono text-sm uppercase tracking-widest transition ${activePage === "pricing" ? "text-brand-white" : "text-brand-gray hover:text-brand-white"}`}
                >
                    PRICING
                </Link>
                {showAuth && (
                    isAuthenticated ? (
                        <Link href="/dashboard" className="font-mono text-sm uppercase tracking-widest text-brand-gray hover:text-brand-white transition">
                            DASHBOARD
                        </Link>
                    ) : (
                        <a href={api.getLoginUrl()} className="font-mono text-sm uppercase tracking-widest text-brand-gray hover:text-brand-white transition">
                            LOGIN
                        </a>
                    )
                )}
            </nav>
        </header>
    );
}
