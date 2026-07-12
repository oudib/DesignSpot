import SiteHeader from "@/components/SiteHeader";
import { SkeletonDetail } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <SkeletonDetail />
      </div>
    </div>
  );
}
