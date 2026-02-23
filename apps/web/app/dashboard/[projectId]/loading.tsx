import { StatsSkeleton, CardSkeleton } from "@/components/Skeleton";

export default function ProjectLoading() {
  return (
    <div className="space-y-6">
      <div className="h-7 w-40 animate-pulse rounded-[2px] bg-brand-gray/20" />
      <StatsSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}
