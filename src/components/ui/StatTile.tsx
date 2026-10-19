// Small shaded figure with a label and an optional note
function StatTile({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-field px-3 py-2">
      <p className="truncate text-[10px] font-semibold text-muted">{label}</p>
      <p className="truncate text-sm font-bold text-ink tabular-nums">{value}</p>
      {note && <p className="truncate text-[10px] text-muted">{note}</p>}
    </div>
  )
}

export default StatTile
