import { Skeleton } from "@/shared/components/ui/skeleton";

export function PageLoading() {
  return (
    <div role="status" className="space-y-4">
      <span className="sr-only">جارٍ التحميل…</span>
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-56 w-full rounded-xl" />
    </div>
  );
}
