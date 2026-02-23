"use client";

import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useState } from "react";

interface Project {
  id: string;
  name: string;
  discordGuildId: string;
}

const navItems = [
  { href: "", label: "Overview" },
  { href: "/contracts", label: "Contracts" },
  { href: "/roles", label: "Role Mappings" },
  { href: "/verifications", label: "Verifications" },
  { href: "/settings", label: "Settings" },
];

function getBreadcrumbLabel(pathname: string, basePath: string): string | null {
  if (pathname === basePath) return "Overview";
  const suffix = pathname.replace(basePath, "");
  const match = navItems.find((item) => item.href && suffix.startsWith(item.href));
  return match?.label ?? null;
}

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const { logout } = useAuth();
  const projectId = params.projectId as string;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => api.fetch<Project>(`/api/v1/projects/${projectId}`),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="font-mono text-sm uppercase tracking-widest text-brand-gray">LOADING_PROJECT...</p>
      </div>
    );
  }

  const basePath = `/dashboard/${projectId}`;
  const currentPage = getBreadcrumbLabel(pathname, basePath);

  const sidebarContent = (
    <>
      <div className="p-4">
        <Link href="/dashboard" className="text-xl font-bold tracking-tight text-brand-white">
          cachet.
        </Link>
        <p className="mt-1 truncate font-mono text-xs text-brand-green">
          {project?.name ?? "UNKNOWN_PROJECT"}
        </p>
      </div>

      <nav className="flex-1 space-y-0.5 px-2 mt-4">
        {navItems.map((item) => {
          const fullHref = `${basePath}${item.href}`;
          const isActive =
            item.href === ""
              ? pathname === basePath
              : pathname.startsWith(fullHref);

          return (
            <Link
              key={item.href}
              href={fullHref}
              onClick={() => setSidebarOpen(false)}
              className={`block rounded-[2px] px-3 py-2 text-sm transition ${isActive
                  ? "bg-brand-green font-medium text-brand-black"
                  : "text-brand-gray hover:bg-brand-green/10 hover:text-brand-white"
                }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-brand-green p-4">
        <Link
          href="/dashboard"
          className="block text-sm text-brand-gray hover:text-brand-white"
        >
          All Projects
        </Link>
        <button
          onClick={logout}
          className="mt-2 text-sm text-brand-gray hover:text-brand-red"
        >
          Logout
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-brand-black text-brand-white">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-col border-r border-brand-green bg-brand-void">
        {sidebarContent}
      </aside>

      {/* Mobile overlay sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-60 flex-col border-r border-brand-green bg-brand-void">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto p-4 md:p-6">
        {/* Mobile header with hamburger */}
        <div className="mb-4 flex items-center gap-3 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-[2px] border border-brand-green p-2 text-brand-white hover:bg-brand-green/10 transition"
            aria-label="Open menu"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 5h14M3 10h14M3 15h14" />
            </svg>
          </button>
          <span className="font-mono text-sm text-brand-green truncate">
            {project?.name ?? "Project"}
          </span>
        </div>

        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="mb-4 font-mono text-xs uppercase tracking-widest text-brand-gray">
          <ol className="flex items-center gap-1.5">
            <li>
              <Link href="/dashboard" className="hover:text-brand-white transition">Dashboard</Link>
            </li>
            <li className="text-brand-green">/</li>
            <li>
              <Link href={basePath} className="hover:text-brand-white transition">
                {project?.name ?? "Project"}
              </Link>
            </li>
            {currentPage && currentPage !== "Overview" && (
              <>
                <li className="text-brand-green">/</li>
                <li className="text-brand-white">{currentPage}</li>
              </>
            )}
          </ol>
        </nav>

        {children}
      </main>
    </div>
  );
}
