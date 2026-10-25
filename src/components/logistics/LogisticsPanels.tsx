import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CircleCheck,
  Clock,
  PackageCheck,
  Phone,
  ShieldCheck,
  Truck,
  TriangleAlert,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import {
  DELIVERY_FLOW,
  DRIVER_STATUSES,
  PICKUP_FLOW,
  STATUS_LABELS,
} from "../../constants/logistics";
import type {
  DispatchJob,
  Driver,
  JobStatus,
  JobType,
  LogisticsFilters,
} from "../../types/logistics";
import { formatXaf } from "../../utils/orders";
import {
  formatClock,
  formatMinutes,
  getDelayMinutes,
  getReadyMinutes,
  isClosed,
  isWaitingTooLong,
  jobRef,
} from "../../utils/logistics";
import { secondaryButton } from "../orders/styles";
import Badge from "../ui/Badge";
import {
  DriverAvatar,
  DriverStatusBadge,
  JobPriorityBadge,
  JobStatusBadge,
  JobTypeIcon,
} from "./LogisticsBits";
import { PanelEmpty } from "../ui/Panel";

const smallButton = `${secondaryButton} h-7 px-2.5 text-[11px]`;

export function Panel({
  title,
  subtitle,
  icon: Icon,
  badge,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  badge?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 rounded-xl bg-white p-4 ring-1 ring-line ${className}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink">
            {Icon && <Icon className="size-4 text-brand" aria-hidden="true" />}
            {title}
            {badge}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-[11px] text-muted">{subtitle}</p>
          )}
        </div>
        {action}
      </header>
      <div className="mt-3">{children}</div>
    </section>
  );
}

// ---------- KPI cards ----------

type View = LogisticsFilters["view"];

export function LogisticsKpis({
  jobs,
  drivers,
  now,
  filters,
  onSelect,
}: {
  jobs: DispatchJob[];
  drivers: Driver[];
  now: number;
  filters: LogisticsFilters;
  onSelect: (patch: Pick<LogisticsFilters, "type" | "view">) => void;
}) {
  const count = (test: (job: DispatchJob) => boolean) =>
    jobs.filter(test).length;
  const completed = count(
    (job) => job.status === "done" || job.status === "received",
  );
  const delayed = count((job) => getDelayMinutes(job, now) > 0);
  const failed = count((job) => job.status === "failed");
  const active = drivers.filter(({ status }) => status !== "offline").length;
  const available = drivers.filter(
    ({ status }) => status === "available",
  ).length;

  const cards: {
    label: string;
    icon: LucideIcon;
    value: ReactNode;
    note: string;
    type: JobType | "";
    view: View;
    tone?: "danger" | "warning";
  }[] = [
    {
      label: "Today’s Pickups",
      icon: ArrowUpFromLine,
      value: count((job) => job.type === "pickup"),
      note: "Scheduled today",
      type: "pickup",
      view: "",
    },
    {
      label: "Today’s Deliveries",
      icon: ArrowDownToLine,
      value: count((job) => job.type === "delivery"),
      note: "Scheduled today",
      type: "delivery",
      view: "",
    },
    {
      label: "Out on the Road",
      icon: Truck,
      value: count(
        (job) => job.status === "enRoute" || job.status === "arrived",
      ),
      note: "En route or arrived",
      type: "",
      view: "active",
    },
    {
      label: "Ready for Delivery",
      icon: PackageCheck,
      value: count(
        (job) => job.type === "delivery" && job.status === "requested",
      ),
      note: "Awaiting scheduling",
      type: "",
      view: "ready",
    },
    {
      label: "Delayed",
      icon: Clock,
      value: delayed,
      note: "Require attention",
      type: "",
      view: "delayed",
      tone: "warning",
    },
    {
      label: "Completed Today",
      icon: CircleCheck,
      value: completed,
      note: "Picked up or delivered",
      type: "",
      view: "completed",
    },
    {
      label: "Failed Attempts",
      icon: XCircle,
      value: failed,
      note: "Need rescheduling",
      type: "",
      view: "failed",
      tone: "danger",
    },
  ];
  const toneClass = { danger: "text-danger", warning: "text-warning" };

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
      {cards.map(({ label, icon: Icon, value, note, type, view, tone }) => {
        const selected = filters.type === type && filters.view === view;
        const flagged = tone && Number(value) > 0 ? toneClass[tone] : "";
        return (
          <button
            key={label}
            type="button"
            aria-pressed={selected}
            onClick={() =>
              onSelect(selected ? { type: "", view: "" } : { type, view })
            }
            className={`min-w-0 rounded-xl bg-white p-3 text-left transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
              selected ? "ring-2 ring-brand" : "ring-1 ring-line hover:bg-field"
            }`}
          >
            <span className="flex items-center justify-between gap-2 text-[10px] font-semibold text-muted">
              <span className="truncate">{label}</span>
              <Icon
                className={`size-3.5 shrink-0 ${flagged}`}
                aria-hidden="true"
              />
            </span>
            <span
              className={`mt-1 block text-xl font-bold ${flagged || "text-ink"}`}
            >
              {value}
            </span>
            <span className="block truncate text-[10px] text-muted">
              {note}
            </span>
          </button>
        );
      })}
      <div className="min-w-0 rounded-xl bg-white p-3 ring-1 ring-line">
        <p className="flex items-center justify-between gap-2 text-[10px] font-semibold text-muted">
          <span className="truncate">Active Drivers</span>
          <Users className="size-3.5 shrink-0" aria-hidden="true" />
        </p>
        <p className="mt-1 text-xl font-bold text-ink">
          {active} / {drivers.length}
        </p>
        <p className="truncate text-[10px] text-muted">
          {available} currently available
        </p>
      </div>
    </div>
  );
}

// ---------- Schedule feed ----------

export function ScheduleFeed({
  jobs,
  drivers,
  now,
  onOpenJob,
}: {
  jobs: DispatchJob[];
  drivers: Driver[];
  now: number;
  onOpenJob: (id: string) => void;
}) {
  const ordered = [...jobs]
    .filter(({ status }) => status !== "cancelled")
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    );
  const upcoming = ordered.filter((job) => !isClosed(job)).length;

  return (
    <Panel
      title="Today’s Schedule"
      icon={Clock}
      badge={<Badge>{upcoming} upcoming</Badge>}
    >
      {/* Padding keeps the timeline dots clear of the scroll clip */}
      <div className="max-h-80 overflow-y-auto py-1 pr-1 pl-1.5">
        <ol className="space-y-3 border-l border-line pl-4">
          {ordered.map((job) => {
            const closed = isClosed(job);
            const live = job.status === "enRoute" || job.status === "arrived";
            const driver = drivers.find(({ id }) => id === job.driverId);
            return (
              <li
                key={job.id}
                className={`relative text-xs ${closed ? "opacity-60" : ""}`}
              >
                <span
                  className={`absolute top-1 -left-[21px] size-2.5 rounded-full ring-2 ring-white ${
                    job.status === "failed"
                      ? "bg-danger"
                      : closed
                        ? "bg-success"
                        : live
                          ? "bg-brand"
                          : "bg-muted/40"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => onOpenJob(job.id)}
                  className="block w-full rounded-md text-left hover:bg-field focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                >
                  <span className="flex flex-wrap items-center gap-x-2 font-semibold text-ink">
                    <time className="tabular-nums">
                      {formatClock(job.scheduledAt)}
                    </time>
                    {job.type === "pickup" ? "Pickup" : "Delivery"} ·{" "}
                    {job.customer}
                  </span>
                  <span className="block text-[11px] text-muted">
                    {job.zone} · {job.orderId} ·{" "}
                    {driver ? driver.name : "Unassigned"}
                  </span>
                  <span className="mt-1 block">
                    <JobStatusBadge job={job} now={now} />
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </Panel>
  );
}

// ---------- Drivers ----------

export function DriversPanel({
  drivers,
  onShowDriverJobs,
  onAssignToDriver,
  loading = false,
}: {
  loading?: boolean;
  drivers: Driver[];
  onShowDriverJobs: (driverId: string) => void;
  onAssignToDriver: (driverId: string) => void;
}) {
  return (
    <Panel title="Drivers" icon={Truck}>
      {loading ? (
        <div className="animate-pulse space-y-2" aria-busy="true">
          <p className="sr-only" role="status">
            Loading drivers…
          </p>
          <div className="h-12 rounded-md bg-field" />
          {[0, 1, 2].map((key) => (
            <div key={key} className="h-20 rounded-lg bg-field" />
          ))}
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-4 gap-1 text-center">
            {DRIVER_STATUSES.map(({ id, label }) => (
              <div key={id} className="rounded-md bg-field px-1 py-1.5">
                <dt className="truncate text-[9px] font-semibold text-muted">
                  {label}
                </dt>
                <dd className="text-sm font-bold text-ink">
                  {drivers.filter(({ status }) => status === id).length}
                </dd>
              </div>
            ))}
          </dl>
          <ul className="mt-3 space-y-2">
            {drivers.map((driver) => (
              <li key={driver.id} className="rounded-lg bg-field p-2.5">
                <div className="flex items-center gap-2.5">
                  <DriverAvatar driver={driver} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-ink">
                      {driver.name}
                    </p>
                    <p className="truncate text-[11px] text-muted">
                      {driver.vehicle} · {driver.location}
                    </p>
                  </div>
                  <DriverStatusBadge status={driver.status} />
                </div>
                <p className="mt-1.5 text-[11px] text-muted">
                  {driver.stopsTotal > 0 && driver.status === "onRoute"
                    ? `${driver.stopsDone} / ${driver.stopsTotal} stops · ${driver.stopsTotal - driver.stopsDone} remaining · ETA ${driver.etaMin} min`
                    : driver.note}{" "}
                  · Score {driver.score}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => onShowDriverJobs(driver.id)}
                    className={smallButton}
                  >
                    View Route
                  </button>
                  {driver.status !== "offline" && (
                    <button
                      type="button"
                      onClick={() => onAssignToDriver(driver.id)}
                      className={smallButton}
                    >
                      {driver.status === "available"
                        ? "Quick Assign"
                        : "Assign"}
                    </button>
                  )}
                  <a
                    href={`tel:${driver.phone.replace(/[^\d+]/g, "")}`}
                    className={smallButton}
                  >
                    <Phone className="size-3 text-muted" aria-hidden="true" />
                    Contact
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

// ---------- Pipeline ----------

const PIPELINE_HELP: Partial<
  Record<JobStatus, { pickup: string; delivery: string }>
> = {
  requested: { pickup: "Unassigned requests", delivery: "Cleaned & bagged" },
  scheduled: { pickup: "Windows confirmed", delivery: "Customer notified" },
  assigned: {
    pickup: "On a driver manifest",
    delivery: "Loaded onto van/bike",
  },
  enRoute: { pickup: "Driver on the way", delivery: "Active street dispatch" },
  done: { pickup: "In driver transit", delivery: "Proof of delivery closed" },
  received: { pickup: "Intake barcode scanned", delivery: "" },
};

export function LogisticsPipeline({
  jobs,
  filters,
  onSelect,
}: {
  jobs: DispatchJob[];
  filters: LogisticsFilters;
  onSelect: (type: JobType, status: JobStatus) => void;
}) {
  const rows: [string, JobType, JobStatus[]][] = [
    ["Inbound pickups flow", "pickup", PICKUP_FLOW],
    ["Outbound deliveries flow", "delivery", DELIVERY_FLOW],
  ];

  return (
    <Panel
      title="Logistics Stage Pipeline"
      subtitle="Click any stage to filter the dispatch register below"
    >
      <div className="space-y-3">
        {rows.map(([title, type, flow]) => (
          <div key={type}>
            <p className="text-[9px] font-bold tracking-wider text-muted uppercase">
              {title}
            </p>
            <ol className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
              {flow.map((status) => {
                // "Arrived" stops are counted with the en-route stage
                const total = jobs.filter(
                  (job) =>
                    job.type === type &&
                    (job.status === status ||
                      (status === "enRoute" && job.status === "arrived")),
                ).length;
                const selected =
                  filters.type === type && filters.status === status;
                return (
                  <li key={status}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onSelect(type, status)}
                      className={`h-full w-full rounded-lg p-2.5 text-left transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
                        selected
                          ? "bg-brand/5 ring-2 ring-brand"
                          : "bg-field hover:bg-brand/5"
                      }`}
                    >
                      <span className="block text-[10px] font-semibold text-muted">
                        {STATUS_LABELS[status][type]}
                      </span>
                      <span className="block text-lg font-bold text-ink">
                        {total}
                      </span>
                      <span className="block truncate text-[10px] text-muted">
                        {PIPELINE_HELP[status]?.[type]}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ---------- Needs attention ----------

type AttentionProps = {
  jobs: DispatchJob[];
  drivers: Driver[];
  now: number;
  onOpenJob: (id: string) => void;
  onAssign: (jobIds: string[]) => void;
};

export function NeedsAttention({
  jobs,
  drivers,
  now,
  onOpenJob,
  onAssign,
}: AttentionProps) {
  const issues = jobs.flatMap((job) => {
    const delay = getDelayMinutes(job, now);
    const driver = drivers.find(({ id }) => id === job.driverId)?.name;
    if (job.status === "failed") {
      return [
        {
          job,
          severity: "danger",
          title: `Failed attempt ${jobRef(job)}`,
          body: `${job.failure?.reason}. ${job.failure?.notes}`,
          action: "Reschedule",
        },
      ];
    }
    if (delay > 0) {
      return [
        {
          job,
          severity: "warning",
          title: `${job.type === "pickup" ? "Pickup" : "Delivery"} ${jobRef(job)} is ${formatMinutes(delay)} late`,
          body: `Expected ${formatClock(job.scheduledAt)} for ${job.customer}${driver ? `, driver ${driver}` : ", no driver assigned"}.`,
          action: "Reassign Driver",
        },
      ];
    }
    if (isWaitingTooLong(job, now)) {
      return [
        {
          job,
          severity: "warning",
          title: `${job.orderId} ready for ${formatMinutes(getReadyMinutes(job, now))}`,
          body: `${job.customer}’s order is waiting at the branch with no driver.`,
          action: "Assign Driver",
        },
      ];
    }
    if (!isClosed(job) && job.driverId === null && job.priority === "express") {
      return [
        {
          job,
          severity: "warning",
          title: `Express ${jobRef(job)} has no driver`,
          body: `${job.customer}, ${job.zone}. Due ${formatClock(job.scheduledAt)}.`,
          action: "Assign Driver",
        },
      ];
    }
    return [];
  });

  return (
    <Panel
      title="Needs Attention"
      subtitle="Late jobs, failed attempts, unassigned express and orders waiting too long"
      icon={TriangleAlert}
      badge={
        issues.length > 0 && (
          <Badge tone="danger">{issues.length} actionable</Badge>
        )
      }
    >
      {issues.length === 0 ? (
        <PanelEmpty>Nothing needs attention right now.</PanelEmpty>
      ) : (
        <ul className="space-y-2">
          {issues.map(({ job, severity, title, body, action }) => (
            <li
              key={job.id}
              className={`flex flex-wrap items-start gap-3 rounded-lg p-3 ring-1 ${
                severity === "danger"
                  ? "bg-danger/5 text-danger ring-danger/20"
                  : "bg-warning/5 text-warning ring-warning/20"
              }`}
            >
              <TriangleAlert
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <div className="min-w-40 flex-1">
                <p className="text-xs font-semibold text-ink">{title}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-muted">
                  {body}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    action === "Reschedule"
                      ? onOpenJob(job.id)
                      : onAssign([job.id])
                  }
                  className={`${smallButton} font-bold`}
                >
                  {action}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenJob(job.id)}
                  className={smallButton}
                >
                  Open
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ---------- Queues ----------

function QueueCard({
  job,
  now,
  children,
  onOpenJob,
  onAssign,
}: {
  job: DispatchJob;
  now: number;
  children: ReactNode;
  onOpenJob: (id: string) => void;
  onAssign: (jobIds: string[]) => void;
}) {
  return (
    <li className="rounded-lg bg-field p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <JobTypeIcon job={job} />
          <div className="min-w-0">
            <p className="truncate font-bold text-ink">
              {job.orderId} · {job.customer}
            </p>
            <p className="truncate text-[11px] text-muted">
              {job.address}, {job.zone}
            </p>
          </div>
        </div>
        <JobPriorityBadge job={job} />
      </div>
      <div className="mt-2 space-y-0.5 text-[11px] text-muted">{children}</div>
      {job.instructions && (
        <p className="mt-1.5 text-[11px] font-semibold text-warning">
          Instruction: {job.instructions}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <JobStatusBadge job={job} now={now} />
        <span className="ml-auto flex gap-1.5">
          <button
            type="button"
            onClick={() => onAssign([job.id])}
            className={smallButton}
          >
            Assign Driver
          </button>
          <button
            type="button"
            onClick={() => onOpenJob(job.id)}
            className={smallButton}
          >
            View
          </button>
        </span>
      </div>
    </li>
  );
}

export function DispatchQueues({
  jobs,
  now,
  onOpenJob,
  onAssign,
}: Omit<AttentionProps, "drivers">) {
  const waiting = (job: DispatchJob) =>
    job.driverId === null &&
    (job.status === "requested" || job.status === "scheduled");
  const pickups = jobs.filter((job) => job.type === "pickup" && waiting(job));
  const deliveries = jobs.filter(
    (job) => job.type === "delivery" && waiting(job),
  );
  const express = jobs
    .filter((job) => job.priority === "express" && !isClosed(job))
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    );
  const cardProps = { now, onOpenJob, onAssign };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel
        title="Pickup Queue"
        subtitle="Customer laundry waiting for collection"
        badge={<Badge>{pickups.length}</Badge>}
      >
        {pickups.length === 0 ? (
          <PanelEmpty>No pickups waiting for a driver.</PanelEmpty>
        ) : (
          <ul className="space-y-2">
            {pickups.map((job) => (
              <QueueCard key={job.id} job={job} {...cardProps}>
                <p>
                  Pickup: {formatClock(job.scheduledAt)} · {job.packages}{" "}
                  {job.packages === 1 ? "bag" : "bags"} · {job.manifest}
                </p>
              </QueueCard>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Ready for Delivery"
        subtitle="Finished orders not yet on a route"
        badge={<Badge>{deliveries.length}</Badge>}
      >
        {deliveries.length === 0 ? (
          <PanelEmpty>No finished orders waiting for a driver.</PanelEmpty>
        ) : (
          <ul className="space-y-2">
            {deliveries.map((job) => {
              const ready = getReadyMinutes(job, now);
              return (
                <QueueCard key={job.id} job={job} {...cardProps}>
                  <p>
                    Window: {formatClock(job.scheduledAt)} · {job.packages}{" "}
                    {job.packages === 1 ? "package" : "packages"} ·{" "}
                    {formatXaf(job.amount)} · {job.payment}
                  </p>
                  {ready > 0 && (
                    <p
                      className={
                        isWaitingTooLong(job, now)
                          ? "font-bold text-warning"
                          : undefined
                      }
                    >
                      Ready for {formatMinutes(ready)}
                    </p>
                  )}
                </QueueCard>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel
        title="Express Queue"
        subtitle="Urgent jobs by deadline"
        icon={Zap}
        badge={<Badge tone="danger">{express.length}</Badge>}
      >
        {express.length === 0 ? (
          <PanelEmpty>No express jobs in progress.</PanelEmpty>
        ) : (
          <ul className="space-y-2">
            {express.map((job) => {
              const remaining = Math.round(
                (new Date(job.scheduledAt).getTime() - now) / 60_000,
              );
              return (
                <QueueCard key={job.id} job={job} {...cardProps}>
                  <p>
                    Required by {formatClock(job.scheduledAt)} ·{" "}
                    <span
                      className={
                        remaining < 45
                          ? "font-bold text-danger"
                          : "font-semibold text-ink"
                      }
                    >
                      {remaining >= 0
                        ? `${formatMinutes(remaining)} remaining`
                        : `${formatMinutes(-remaining)} overdue`}
                    </span>
                  </p>
                </QueueCard>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

// ---------- Proof of delivery ----------

export function LatestProof({
  jobs,
  onOpenJob,
}: {
  jobs: DispatchJob[];
  onOpenJob: (id: string) => void;
}) {
  const latest = jobs
    .filter((job) => job.proof)
    .sort(
      (a, b) =>
        new Date(b.proof!.at).getTime() - new Date(a.proof!.at).getTime(),
    )[0];

  return (
    <Panel
      title="Latest Proof of Delivery"
      icon={ShieldCheck}
      badge={latest && <Badge tone="success">Verified</Badge>}
    >
      {!latest ? (
        <PanelEmpty>No completed deliveries yet today.</PanelEmpty>
      ) : (
        <>
          <p className="text-xs font-semibold text-ink">
            Delivery {jobRef(latest)} · {latest.orderId}
          </p>
          <dl className="mt-2 space-y-1.5 text-xs">
            {(
              [
                ["Delivered to", latest.proof!.recipient],
                ["At", formatClock(latest.proof!.at)],
                ["Verification", latest.proof!.method],
                ["Packages", `${latest.packages} handed over`],
              ] as [string, string][]
            ).map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-muted">{label}</dt>
                <dd className="text-right font-semibold text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          <button
            type="button"
            onClick={() => onOpenJob(latest.id)}
            className={`${secondaryButton} mt-3 w-full`}
          >
            View Delivery
          </button>
        </>
      )}
    </Panel>
  );
}
