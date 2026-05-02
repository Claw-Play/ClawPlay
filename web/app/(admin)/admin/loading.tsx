export default function AdminLoading() {
  return (
    <div className="mx-auto max-w-[1240px] space-y-5 px-4 sm:px-6">
      <div className="h-12 w-full animate-pulse rounded-full border border-[#dbe5f7] bg-white" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-[240px] animate-pulse rounded-[24px] border border-[#dbe5f7] bg-white shadow-[0_12px_28px_rgba(25,43,87,0.04)]" />
        <div className="h-[240px] animate-pulse rounded-[24px] border border-[#dbe5f7] bg-white shadow-[0_12px_28px_rgba(25,43,87,0.04)]" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-[92px] animate-pulse rounded-[24px] border border-[#dbe5f7] bg-white shadow-[0_12px_28px_rgba(25,43,87,0.04)]"
          />
        ))}
      </div>
    </div>
  );
}
