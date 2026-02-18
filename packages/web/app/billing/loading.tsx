export default function BillingLoading() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl animate-pulse">
      <div className="h-8 bg-muted rounded w-48 mb-6" />
      <div className="space-y-4">
        <div className="h-32 bg-muted rounded" />
        <div className="h-48 bg-muted rounded" />
      </div>
    </div>
  );
}
