// Shown by Next.js while a route segment's server data is still loading —
// this file being present also lets Next prefetch+cache this boundary for
// <Link> navigation, so tapping a nav link shows this instantly instead of
// a blank screen while the real (force-dynamic) content streams in behind
// it. Not a manual loading state — Next renders/unmounts this on its own.
export function RouteLoading() {
  return (
    <div className="flex h-dvh w-full items-center justify-center bg-canvas">
      <div
        className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary"
        role="status"
        aria-label="Memuat"
      />
    </div>
  );
}
