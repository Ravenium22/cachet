import { CardSkeleton } from "@/components/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-brand-black p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-[2px] bg-brand-gray/20" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    </div>
  );
}
