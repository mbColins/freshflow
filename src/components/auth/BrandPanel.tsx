import { ShieldCheck, TrendingUp, WashingMachine } from 'lucide-react'
import AuthPanel from './AuthPanel'

const BATCH_PROGRESS = 84

function BrandPanel() {
  return (
    <AuthPanel
      badgeIcon={WashingMachine}
      badge="Next-gen laundry ops"
      title="Effortless linen & commercial wash operations."
      description="Continuous real-time washer cycle telemetry, multi-store dispatch, and counter intake synced automatically across your network."
      footer={
        <figure className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </span>
          <div>
            <blockquote className="text-sm font-semibold">
              “Turnaround time dropped 35% in week one.”
            </blockquote>
            <figcaption className="mt-0.5 text-xs text-white/75">
              Marcus V. — Lead Facility Manager
            </figcaption>
          </div>
        </figure>
      }
    >
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs font-semibold">
          <span className="size-2 rounded-full bg-emerald-400" />
          Network Sync Live
        </p>
        <span className="rounded-md bg-white/15 px-2 py-1 text-[10px] font-semibold">
          3 Branches Active
        </span>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-white/10 p-4 ring-1 ring-white/10">
          <dt className="text-[10px] font-semibold tracking-wider text-white/70 uppercase">
            Machine uptime
          </dt>
          <dd className="mt-1 flex items-center gap-2 text-2xl font-bold">
            99.4%
            <TrendingUp
              className="size-4 text-emerald-300"
              aria-hidden="true"
            />
          </dd>
          <dd className="mt-1 text-[11px] text-white/75">
            128 Washers active
          </dd>
        </div>
        <div className="rounded-lg bg-white/10 p-4 ring-1 ring-white/10">
          <dt className="text-[10px] font-semibold tracking-wider text-white/70 uppercase">
            Processed mo.
          </dt>
          <dd className="mt-1 flex items-baseline gap-1.5 text-2xl font-bold">
            12.4k
            <span className="text-[11px] font-medium text-white/75">
              orders
            </span>
          </dd>
          <dd className="mt-1 text-[11px] text-white/75">
            +18% vs last month
          </dd>
        </div>
      </dl>

      <div className="mt-5">
        <div className="flex items-center justify-between text-[11px] font-semibold">
          <span id="batch-progress-label">Downtown Route Batch #08</span>
          <span className="text-white/80">{BATCH_PROGRESS}% Finished</span>
        </div>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20"
          role="progressbar"
          aria-labelledby="batch-progress-label"
          aria-valuenow={BATCH_PROGRESS}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-white"
            style={{ width: `${BATCH_PROGRESS}%` }}
          />
        </div>
      </div>
    </AuthPanel>
  )
}

export default BrandPanel
