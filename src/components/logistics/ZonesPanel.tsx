import { useState } from 'react'
import { Link } from 'react-router'
import { RotateCcw } from 'lucide-react'
import useDeliveryZones from '../../hooks/useDeliveryZones'
import { useGetBranchDropdownQuery } from '../../services/branchApi'
import { useGetLogisticsSettingsQuery } from '../../services/dispatchApi'
import type { DeliveryZone } from '../../types/deliveryZone'
import type { DispatchJob } from '../../types/logistics'
import { isClosed } from '../../utils/logistics'
import { formatXaf } from '../../utils/orders'
import { fieldClass, secondaryButton } from '../orders/styles'
import Panel, { PanelEmpty } from '../ui/Panel'

// A job belongs to a zone by its uuid; jobs read before the API sent one fall
// back to the zone's name
const inZone = (job: DispatchJob, zone: DeliveryZone) => (job.zoneId ? job.zoneId === zone.id : job.zone === zone.name)

const zoneLabel = (zone: DeliveryZone) => zone.name || zone.neighborhoods[0] || 'Unnamed zone'

function zoneStats(zone: DeliveryZone, jobs: DispatchJob[]) {
  const mine = jobs.filter((job) => inZone(job, zone))
  const open = mine.filter((job) => !isClosed(job))
  return {
    active: open.length,
    completed: mine.filter(({ status }) => status === 'done').length,
    failed: mine.filter(({ status }) => status === 'failed').length,
    drivers: new Set(open.map(({ driverId }) => driverId).filter(Boolean)).size,
  }
}

// The delivery zones from GET /delivery-zones with how each one is doing in the
// loaded jobs. The panel is as tall as its rows; the page doesn't stretch it
export function ZonesTable({ jobs, className }: { jobs: DispatchJob[]; className?: string }) {
  const { zones, isLoading, isError, isFetching, refetch } = useDeliveryZones()
  const manyBranches = new Set(zones.map(({ branchId }) => branchId)).size > 1
  const place = (zone: DeliveryZone) => [manyBranches && zone.branchName, zone.neighborhoods.join(', ')].filter(Boolean).join(' · ')

  return (
    <Panel
      title="Delivery Zones"
      subtitle={zones.length ? `${zones.length} ${zones.length === 1 ? 'zone' : 'zones'}` : undefined}
      className={className}
      action={
        <Link to="/pickup-delivery/zones" className="text-[11px] font-bold text-brand hover:underline">
          Manage zones
        </Link>
      }
    >
      {isLoading ? (
        <div className="h-32 animate-pulse rounded-md bg-field" aria-busy="true" />
      ) : isError && zones.length === 0 ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-xs text-danger">
          Couldn’t load the delivery zones.
          <button type="button" onClick={() => void refetch()} disabled={isFetching} className={secondaryButton}>
            <RotateCcw className="size-3.5" aria-hidden="true" />
            {isFetching ? 'Retrying…' : 'Try Again'}
          </button>
        </div>
      ) : zones.length === 0 ? (
        <PanelEmpty>
          No delivery zones yet.{' '}
          <Link to="/pickup-delivery/zones" className="font-bold text-brand hover:underline">
            Add one
          </Link>{' '}
          to set the fees for the neighborhoods you serve.
        </PanelEmpty>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead>
              <tr className="text-[9px] font-bold tracking-wider text-muted uppercase">
                <th scope="col" className="py-1.5 pr-3">Zone</th>
                <th scope="col" className="py-1.5 pr-3 text-right">Active now</th>
                <th scope="col" className="py-1.5 pr-3 text-right">Completed</th>
                <th scope="col" className="py-1.5 pr-3 text-right">Failed</th>
                <th scope="col" className="py-1.5 pr-3 text-right">Drivers</th>
                <th scope="col" className="py-1.5 pr-3 text-right">Pickup fee</th>
                <th scope="col" className="py-1.5 text-right">Delivery fee</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((zone) => {
                const stats = zoneStats(zone, jobs)
                return (
                  <tr key={zone.id} className="border-t border-line align-top tabular-nums">
                    <th scope="row" className="py-2 pr-3 font-normal">
                      <span className="block font-semibold text-ink">{zoneLabel(zone)}</span>
                      <span className="block text-[10px] text-muted">{place(zone)}</span>
                    </th>
                    <td className="py-2 pr-3 text-right font-semibold text-ink">{stats.active}</td>
                    <td className="py-2 pr-3 text-right">{stats.completed}</td>
                    <td className={`py-2 pr-3 text-right ${stats.failed ? 'font-semibold text-danger' : ''}`}>{stats.failed}</td>
                    <td className="py-2 pr-3 text-right">{stats.drivers}</td>
                    <td className="py-2 pr-3 text-right">{formatXaf(zone.collectionFee)}</td>
                    <td className="py-2 text-right">{formatXaf(zone.deliveryFee)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

// A branch's surcharges and limits from GET /logistics/settings
export function PricingPanel() {
  const { zones } = useDeliveryZones()
  const { data: branches = [] } = useGetBranchDropdownQuery()
  const [picked, setPicked] = useState('')
  const branchId = picked || zones[0]?.branchId || branches[0]?.uuid || ''
  const branchName = branches.find(({ uuid }) => uuid === branchId)?.name ?? zones.find((zone) => zone.branchId === branchId)?.branchName ?? ''
  const settings = useGetLogisticsSettingsQuery(branchId, { skip: !branchId })

  return (
      <Panel
        title="Delivery Pricing"
        subtitle={branchName ? `${branchName} · added to the zone fee` : 'Added to the zone fee'}
        action={
          <Link to="/pickup-delivery/zones" className="text-[11px] font-bold text-brand hover:underline">
            Edit
          </Link>
        }
      >
        {branches.length > 1 && (
          <div className="mb-2">
            <label htmlFor="pricing-branch" className="sr-only">
              Branch
            </label>
            <select id="pricing-branch" value={branchId} onChange={(event) => setPicked(event.target.value)} className={fieldClass}>
              {branches.map(({ uuid, name }) => (
                <option key={uuid} value={uuid}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        )}
        {!branchId ? (
          <PanelEmpty>No branch to show pricing for.</PanelEmpty>
        ) : settings.isLoading ? (
          <div className="h-28 animate-pulse rounded-md bg-field" aria-busy="true" />
        ) : settings.isError || !settings.data ? (
          <p role="alert" className="text-xs text-danger">Couldn’t load this branch’s pricing.</p>
        ) : (
          <dl className="space-y-1.5 text-xs">
            {(
              [
                ['Standard', 'Zone fee'],
                ['Express', `Zone fee + ${formatXaf(settings.data.expressSurcharge)}`],
                ['Same day', `Zone fee + ${formatXaf(settings.data.sameDaySurcharge)}`],
                ['Pickup (no zone fee)', formatXaf(settings.data.pickupFee)],
                ['Free delivery from', settings.data.freeDeliveryThreshold ? formatXaf(settings.data.freeDeliveryThreshold) : 'Never'],
                ['Counts as delayed after', `${settings.data.delayLimitMinutes} min`],
              ] as [string, string][]
            ).map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-muted">{label}</dt>
                <dd className="text-right font-semibold text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </Panel>
  )
}
