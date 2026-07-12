import { Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="card space-y-3 p-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <div className="ml-6 space-y-2">
              <Skeleton className="h-3.5 w-1/4" />
              <Skeleton className="h-3.5 w-1/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
