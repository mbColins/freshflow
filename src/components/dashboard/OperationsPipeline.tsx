import { Activity } from 'lucide-react'
import { STAGES } from '../../constants/pipeline'
import type { StageId } from '../../constants/pipeline'
import Badge from '../ui/Badge'
import DashboardCard from './DashboardCard'

const IN_FLIGHT = STAGES.reduce((sum, { count }) => sum + count, 0)

type OperationsPipelineProps = {
  selectedStage: StageId | null
  onSelectStage: (stage: StageId | null) => void
}

function OperationsPipeline({
  selectedStage,
  onSelectStage,
}: OperationsPipelineProps) {
  return (
    <DashboardCard
      title="Live Laundry Operations Pipeline"
      subtitle="Click any stage to filter the orders register below"
      icon={Activity}
      badge={<Badge tone="brand">{IN_FLIGHT} in flight</Badge>}
      action={
        <p className="text-[11px] text-muted">
          Plant speed: <span className="font-bold text-ink">32 kg / hr</span>
        </p>
      }
    >
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
        {STAGES.map(({ id, step, short, label, count, detail, load, color }) => {
          const selected = selectedStage === id
          return (
            <li key={id}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelectStage(selected ? null : id)}
                className={`flex h-full w-full flex-col rounded-lg p-3 text-left transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
                  selected
                    ? 'bg-brand/5 ring-2 ring-brand'
                    : 'bg-field hover:bg-brand/5'
                }`}
              >
                <span className="flex items-center gap-1.5 text-[9px] font-bold tracking-wider text-muted uppercase">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  {step}. {short}
                </span>
                <span className="mt-2 text-xl font-bold text-ink">{count}</span>
                <span className="text-[11px] font-semibold text-ink">
                  {label}
                </span>
                <span className="mt-1 flex-1 text-[10px] leading-snug text-muted">
                  {detail}
                </span>
                <span
                  className="mt-3 block h-1 overflow-hidden rounded-full"
                  style={{ backgroundColor: `${color}33` }}
                  role="meter"
                  aria-label={`${label} capacity in use`}
                  aria-valuenow={load}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${load}%`, backgroundColor: color }}
                  />
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </DashboardCard>
  )
}

export default OperationsPipeline
