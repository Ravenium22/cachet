"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import { useState } from "react";
import { formatShortDate } from "@/lib/format";
import type { SubscriptionTier } from "@megaeth-verify/shared";
import { toast } from "sonner";

interface Project {
  id: string;
  name: string;
  discordGuildId: string;
  createdAt: string;
}

interface ProjectSubscription {
  tier: SubscriptionTier;
  status: string;
}

const TIER_COLORS: Record<string, string> = {
  free: "border-brand-gray text-brand-gray",
  growth: "border-brand-green text-brand-green",
  pro: "border-brand-white text-brand-white",
  enterprise: "border-brand-white text-brand-white",
};

export default function DashboardPage() {
  const { logout } = useAuth();
  const username = api.getUsername();
  const { data: projects, isLoading, refetch } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.fetch<Project[]>("/api/v1/projects"),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [guildId, setGuildId] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.fetch("/api/v1/projects", {
        method: "POST",
        body: JSON.stringify({ name, discordGuildId: guildId }),
      });
      setName("");
      setGuildId("");
      setShowCreate(false);
      refetch();
      toast.success("Project created successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-brand-white">
            Your Projects{projects && projects.length > 0 ? ` (${projects.length})` : ""}
          </h1>
          <p className="mt-1 text-sm text-brand-gray">Select a project to manage.</p>
        </div>
        <div className="flex items-center gap-3">
          {username && (
            <span className="font-mono text-sm text-brand-gray">{username}</span>
          )}
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="rounded-[2px] bg-brand-green px-4 py-2 text-sm font-medium text-brand-black transition hover:bg-brand-green/80"
          >
            {showCreate ? "CANCEL" : "NEW PROJECT"}
          </button>
          <button
            onClick={logout}
            className="rounded-[2px] border border-brand-green px-4 py-2 text-sm font-medium text-brand-white transition hover:bg-brand-green/10"
          >
            LOGOUT
          </button>
        </div>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="mt-6 rounded-[2px] border border-brand-green bg-brand-void p-4">
          <h2 className="text-lg font-semibold text-brand-white">Create Project</h2>
          <div className="mt-3 space-y-3">
            <div>
              <label className="block text-sm font-medium text-brand-gray">Project Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={100}
                className="mt-1 w-full rounded-[2px] border border-brand-green bg-brand-black px-3 py-2 text-sm text-brand-white focus:border-brand-white focus:outline-none focus:ring-1 focus:ring-brand-white"
                placeholder="My NFT Project"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-gray">Discord Server ID</label>
              <input
                type="text"
                value={guildId}
                onChange={(e) => setGuildId(e.target.value)}
                required
                minLength={17}
                maxLength={20}
                className="mt-1 w-full rounded-[2px] border border-brand-green bg-brand-black px-3 py-2 text-sm text-brand-white focus:border-brand-white focus:outline-none focus:ring-1 focus:ring-brand-white"
                placeholder="123456789012345678"
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="rounded-[2px] bg-brand-white px-4 py-2 text-sm font-medium text-brand-black transition hover:bg-brand-gray disabled:opacity-50"
            >
              {creating ? "CREATING..." : "CREATE"}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className="mt-8 font-mono text-sm uppercase tracking-widest text-brand-gray">LOADING_PROJECTS...</p>
      ) : !projects || projects.length === 0 ? (
        <div className="mt-12 text-center rounded-[2px] border border-brand-green bg-brand-void py-12 px-6">
          <p className="text-lg font-semibold text-brand-white">NO PROJECTS YET</p>
          <p className="mt-2 font-mono text-xs uppercase text-brand-gray leading-relaxed max-w-md mx-auto">
            Create a project to connect your Discord server and start verifying NFT holders.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-6 rounded-[2px] bg-brand-green px-6 py-3 font-mono text-sm font-bold uppercase tracking-widest text-brand-black transition hover:bg-brand-green/80"
          >
            CREATE YOUR FIRST PROJECT
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const { data: subscription } = useQuery({
    queryKey: ["billing-subscription", project.id],
    queryFn: () => api.fetch<ProjectSubscription>(`/api/v1/billing/subscription?projectId=${project.id}`),
  });

  const tier = subscription?.tier ?? "free";
  const colorClass = TIER_COLORS[tier] ?? TIER_COLORS.free;

  return (
    <Link
      href={`/dashboard/${project.id}`}
      className="block rounded-[2px] border border-brand-green bg-brand-void p-4 transition hover:bg-brand-green/10"
    >
      <div className="flex items-center gap-3">
        <h3 className="font-semibold text-brand-white">{project.name}</h3>
        <span className={`rounded-[2px] border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${colorClass}`}>
          {tier.toUpperCase()}
        </span>
      </div>
      <p className="mt-1 font-mono text-xs text-brand-gray">
        GUILD_ID: {project.discordGuildId} | CREATED: {formatShortDate(project.createdAt)}
      </p>
    </Link>
  );
}
