export default function ReaderDashboardLoading() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl animate-pulse">
      <div className="h-8 bg-muted rounded w-56 mb-6" />
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <div className="h-24 bg-muted rounded" />
        <div className="h-24 bg-muted rounded" />
        <div className="h-24 bg-muted rounded" />
      </div>
      <div className="space-y-4">
        <div className="h-48 bg-muted rounded" />
        <div className="h-48 bg-muted rounded" />
      </div>
    </div>
  );
}
