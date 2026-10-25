function LogisticsSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true">
      <p className="sr-only" role="status">Loading pickups and deliveries…</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-[76px] rounded-xl bg-white ring-1 ring-line">
            <div className="m-3 h-2.5 w-16 rounded bg-field" />
            <div className="mx-3 h-5 w-10 rounded bg-field" />
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-white ring-1 ring-line">
        <div className="flex gap-2 border-b border-line p-3">
          <div className="h-9 flex-1 rounded-md bg-field" />
          <div className="h-9 w-28 rounded-md bg-field max-sm:hidden" />
          <div className="h-9 w-28 rounded-md bg-field max-sm:hidden" />
        </div>
        {Array.from({ length: 7 }, (_, index) => (
          <div key={index} className="flex items-center gap-4 border-b border-line px-4 py-4 last:border-0">
            <div className="size-4 rounded bg-field" />
            <div className="h-3 w-24 rounded bg-field" />
            <div className="h-3 w-32 rounded bg-field" />
            <div className="h-3 flex-1 rounded bg-field" />
            <div className="h-5 w-20 rounded bg-field" />
            <div className="h-3 w-24 rounded bg-field max-sm:hidden" />
          </div>
        ))}
      </div>
    </div>
  )
}

export { LogisticsSkeleton }
