import { Skeleton, SkeletonCards } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <SkeletonCards count={6} />
    </div>
  );
}
