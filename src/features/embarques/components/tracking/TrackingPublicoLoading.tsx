import { PageSkeleton } from "@/components/shared/skeletons";

export function TrackingPublicoLoading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-full max-w-2xl px-4">
        <PageSkeleton contentHeightClass="h-64" />
      </div>
    </div>
  );
}
