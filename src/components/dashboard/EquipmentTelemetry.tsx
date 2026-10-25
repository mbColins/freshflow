import type { LucideIcon } from 'lucide-react'
import { Cpu, Gauge, RotateCcw, Sparkles, Thermometer, Timer, WashingMachine, Wind } from 'lucide-react'
import { Link } from 'react-router'
import { useMachineList } from '../../hooks/useMachines'
import { getMachineStatus } from '../../utils/machines'
import type { MachineType } from '../../types/machine'
import { NETWORK_ERROR_MESSAGE, errorMessage, serverMessage } from '../../utils/apiErrors'
import { secondaryButton } from '../orders/styles'
import Badge from '../ui/Badge'
import DashboardCard from './DashboardCard'

const TYPE_ICONS: Record<MachineType, LucideIcon> = {
  'Washing Machine': WashingMachine,
  Dryer: Wind,
  Press: Thermometer,
  'Ironing Machine': Thermometer,
  'Steam Machine': Thermometer,
  'Folding Machine': Sparkles,
  'Packaging Machine': Sparkles,
  Other: Cpu,
}

// The card shows a handful; the Machines page lists them all
const SHOWN = 6

// Live machine status from GET /machines: what each is running, how loaded it is
// and whether it is available, down or in maintenance
function EquipmentTelemetry({ branch }: { branch?: string }) {
  const { machines: all, isLoading, isError, isFetching, error, refetch } = useMachineList()
  // The dashboard's branch picker narrows tenant owners' machines too
  const machines = all.filter((machine) => machine.status !== 'retired' && (!branch || machine.branchId === branch))
  const active = machines.filter(({ status }) => status === 'running').length

  return (
    <DashboardCard
      title="Equipment Telemetry"
      subtitle="Live status of the machines on the floor"
      icon={Gauge}
      badge={!isLoading && !isError ? <Badge tone="success">{active} / {machines.length} running</Badge> : undefined}
    >
      {isLoading ? (
        <ul className="space-y-2" aria-busy="true">
          <li className="sr-only" role="status">Loading machines…</li>
          {[0, 1, 2, 3].map((key) => (
            <li key={key} className="h-[62px] animate-pulse rounded-lg bg-field" />
          ))}
        </ul>
      ) : isError && machines.length === 0 ? (
        <div role="alert" className="flex flex-col items-center gap-2 py-8 text-center">
          <p className="text-sm font-bold text-ink">Couldn’t load the machines</p>
          <p className="max-w-xs text-xs text-muted">
            {serverMessage(error) ?? errorMessage(error, 'The server refused the request.') ?? NETWORK_ERROR_MESSAGE}
          </p>
          <button type="button" onClick={() => void refetch()} disabled={isFetching} className={`${secondaryButton} mt-1`}>
            <RotateCcw className="size-3.5" aria-hidden="true" />
            {isFetching ? 'Retrying…' : 'Try again'}
          </button>
        </div>
      ) : machines.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Cpu className="size-6 text-muted" aria-hidden="true" />
          <p className="text-sm font-bold text-ink">No machines yet</p>
          <p className="max-w-xs text-xs text-muted">Machines you add appear here.</p>
        </div>
      ) : (
        <ul className={`space-y-2 transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
          {[...machines]
            // Running machines first, then the ones needing attention
            .sort((a, b) => Number(b.status === 'running') - Number(a.status === 'running'))
            .slice(0, SHOWN)
            .map((machine) => {
              const Icon = TYPE_ICONS[machine.type] ?? Cpu
              const status = getMachineStatus(machine.status)
              const job = machine.job
              const load = job && machine.specs.capacityKg > 0 ? Math.round((job.loadKg / machine.specs.capacityKg) * 100) : null
              return (
                <li key={machine.id} className="rounded-lg bg-field p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="flex min-w-0 items-center gap-2 text-xs font-semibold text-ink">
                      <Icon className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
                      <span className="truncate">{machine.name}</span>
                    </p>
                    {job ? (
                      <Badge tone="brand">
                        <Timer className="size-3" aria-hidden="true" />
                        {job.paused ? 'Paused' : `${job.remainingMin}m left`}
                      </Badge>
                    ) : (
                      <Badge tone={status.tone}>{status.label}</Badge>
                    )}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted">
                    <span className="truncate">
                      {job ? `${job.cycle || 'Cycle'} · order ${job.orderId}` : machine.statusNote || [machine.area, machine.zone].filter(Boolean).join(' · ')}
                    </span>
                    {load !== null && <span className="shrink-0">{load}% load</span>}
                  </div>
                </li>
              )
            })}
        </ul>
      )}
      <Link
        to="/machines"
        className="mt-3 flex h-9 w-full items-center justify-center rounded-md bg-field text-[11px] font-bold text-ink transition hover:bg-brand/10 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
      >
        {machines.length > SHOWN ? `All ${machines.length} machines` : 'Equipment Grid & Calibration'}
      </Link>
    </DashboardCard>
  )
}

export default EquipmentTelemetry
