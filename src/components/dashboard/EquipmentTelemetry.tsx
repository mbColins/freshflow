import type { LucideIcon } from 'lucide-react'
import { Cpu, Gauge, RotateCcw, Sparkles, Thermometer, WashingMachine, Wind } from 'lucide-react'
import { Link } from 'react-router'
import { MACHINE_KINDS, useListMachinesQuery } from '../../services/machineApi'
import type { MachineKind, MachineListParams } from '../../services/machineApi'
import { NETWORK_ERROR_MESSAGE, errorMessage, serverMessage } from '../../utils/apiErrors'
import { secondaryButton } from '../orders/styles'
import Badge from '../ui/Badge'
import DashboardCard from './DashboardCard'

const KIND_ICONS: Record<MachineKind, LucideIcon> = {
  WASHING_MACHINE: WashingMachine,
  DRYER: Wind,
  DRY_CLEANING_MACHINE: WashingMachine,
  STEAM_PRESS: Thermometer,
  OZONE_CHAMBER: Sparkles,
}

// The card shows a handful; the Machines page lists them all
const SHOWN = 6
const QUERY: MachineListParams = { page: 0, size: 50 }

// The machines the caller can see, from GET /machines. The server stores each
// machine's profile only, so there is no live load, cycle or status to show yet
function EquipmentTelemetry({ branch }: { branch?: string }) {
  const { data, isLoading, isError, isFetching, error, refetch } = useListMachinesQuery(QUERY)
  // The dashboard's branch picker narrows tenant owners' machines too
  const machines = (data?.items ?? []).filter((machine) => !branch || machine.branchId === branch)

  return (
    <DashboardCard
      title="Equipment Telemetry"
      subtitle="Machines on the floor, by area"
      icon={Gauge}
      badge={!isLoading && !isError ? <Badge tone="brand">{machines.length} {machines.length === 1 ? 'machine' : 'machines'}</Badge> : undefined}
    >
      {isLoading ? (
        <ul className="space-y-2" aria-busy="true">
          <li className="sr-only" role="status">Loading machines…</li>
          {[0, 1, 2, 3].map((key) => (
            <li key={key} className="h-[62px] animate-pulse rounded-lg bg-field" />
          ))}
        </ul>
      ) : isError && !data ? (
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
          {machines.slice(0, SHOWN).map((machine) => {
            const Icon = machine.type ? KIND_ICONS[machine.type] ?? Cpu : Cpu
            return (
              <li key={machine.id} className="rounded-lg bg-field p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="flex min-w-0 items-center gap-2 text-xs font-semibold text-ink">
                    <Icon className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
                    <span className="truncate">{machine.name}</span>
                  </p>
                  <Badge>{machine.code}</Badge>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted">
                  <span className="truncate">
                    {[machine.type ? MACHINE_KINDS[machine.type] : '', machine.manufacturer, machine.model].filter(Boolean).join(' · ')}
                  </span>
                  <span className="shrink-0">{[machine.branchName, machine.area].filter(Boolean).join(' · ')}</span>
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
