import SiteHeader from "@/components/SiteHeader";
import { Skeleton, SkeletonDetail } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_320px]">
        <SkeletonDetail />
        <div className="space-y-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </main>
    </div>
  );
}
