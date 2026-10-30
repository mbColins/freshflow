import { Activity } from 'lucide-react'
import { STAGES } from '../../constants/pipeline'
import type { StageId } from '../../constants/pipeline'
import { useGetPipelineQuery } from '../../services/dashboardCardsApi'
import type { PipelineStage } from '../../services/dashboardCardsApi'
import Badge from '../ui/Badge'
import { CardError, CardLoading } from './CardStatus'
import DashboardCard from './DashboardCard'

type OperationsPipelineProps = {
  branch?: string
  selectedStage: StageId | null
  onSelectStage: (stage: StageId | null) => void
}

// "82 items · 25m wait", "8 of 10 washers busy" for machine stages
function stageDetail({ items, averageWaitMinutes, machinesBusy, machinesTotal }: PipelineStage) {
  const parts = [`${items.toLocaleString('en-US')} ${items === 1 ? 'item' : 'items'}`]
  if (machinesTotal !== null) parts.push(`${machinesBusy ?? 0}/${machinesTotal} machines`)
  else if (averageWaitMinutes > 0) parts.push(`~${averageWaitMinutes}m wait`)
  return parts.join(' · ')
}

// The stages follow the backend's order, so look and feel (label, color) come
// from the constants and the numbers from the API
function OperationsPipeline({ branch, selectedStage, onSelectStage }: OperationsPipelineProps) {
  const { data, isLoading, isError, isFetching, error, refetch } = useGetPipelineQuery(branch ? { branch } : undefined)

  return (
    <DashboardCard
      title="Live Laundry Operations Pipeline"
      subtitle="Click any stage to filter the orders register below"
      icon={Activity}
      badge={data ? <Badge tone="brand">{data.inFlight} in flight</Badge> : undefined}
      action={
        data && (
          <p className="text-[11px] text-muted">
            Plant speed: <span className="font-bold text-ink">{+data.plantSpeedKgPerHour.toFixed(1)} kg / hr</span>
          </p>
        )
      }
    >
      {isLoading ? (
        <CardLoading label="Loading the pipeline…" rows={2} />
      ) : isError && !data ? (
        <CardError title="Couldn’t load the pipeline" error={error} retrying={isFetching} onRetry={() => void refetch()} />
      ) : (
        <ol className={`grid grid-cols-2 gap-2 transition-opacity sm:grid-cols-4 xl:grid-cols-7 ${isFetching ? 'opacity-60' : ''}`}>
          {STAGES.map(({ id, step, short, label, color }, index) => {
            const stage = data?.stages[index]
            const selected = selectedStage === id
            const load = stage?.load ?? 0
            return (
              <li key={id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelectStage(selected ? null : id)}
                  className={`flex h-full w-full flex-col rounded-lg p-3 text-left transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
                    selected ? 'bg-brand/5 ring-2 ring-brand' : 'bg-field hover:bg-brand/5'
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-[9px] font-bold tracking-wider text-muted uppercase">
                    <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
                    {step}. {short}
                  </span>
                  <span className="mt-2 text-xl font-bold text-ink">{stage?.count ?? 0}</span>
                  <span className="text-[11px] font-semibold text-ink">{label}</span>
                  <span className="mt-1 flex-1 text-[10px] leading-snug text-muted">{stage ? stageDetail(stage) : ''}</span>
                  <span
                    className="mt-3 block h-1 overflow-hidden rounded-full"
                    style={{ backgroundColor: `${color}33` }}
                    role="meter"
                    aria-label={`${label} capacity in use`}
                    aria-valuenow={load}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <span className="block h-full rounded-full" style={{ width: `${load}%`, backgroundColor: color }} />
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </DashboardCard>
  )
}

export default OperationsPipeline
