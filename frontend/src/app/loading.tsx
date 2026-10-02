export default function Loading() {
  return (
    <div className="container-page py-16">
      <div className="space-y-6">
        <div className="skeleton h-12 w-64 rounded-xl" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-64 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
