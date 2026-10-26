import {
  BOTTLENECK_WAITING,
  DAILY_CAPACITY_KG,
  OVERRUN_RATIO,
  STAFF_JOB_CAPACITY,
  STAGES,
} from '../constants/operations'
import type {
  OpsFilters,
  OpsHealth,
  OpsJob,
  QcResult,
  StageId,
} from '../types/operations'
import { csvCell } from './csv'

const MINUTE = 60_000

export function getStage(id: StageId) {
  return STAGES.find((stage) => stage.id === id)!
}

const stageIndex = (id: StageId) => STAGES.findIndex((stage) => stage.id === id)

export function isDelayed(job: OpsJob, now: number) {
  return job.stage !== 'ready' && new Date(job.dueAt).getTime() < now
}

// Minutes in the current stage: time being worked on, or time waiting
export function getStageMinutes(job: OpsJob, now: number) {
  return Math.max(0, Math.round((now - new Date(job.stageSince).getTime()) / MINUTE))
}

export function isRunningLong(job: OpsJob, now: number) {
  const { expectedMin } = getStage(job.stage)
  return job.active && expectedMin > 0 && getStageMinutes(job, now) > expectedMin * OVERRUN_RATIO
}

export function getProgress(job: OpsJob, now: number) {
  const { expectedMin } = getStage(job.stage)
  if (!job.active || expectedMin === 0) return null
  const elapsed = getStageMinutes(job, now)
  return { percent: Math.min(100, Math.round((elapsed / expectedMin) * 100)), remaining: Math.max(0, expectedMin - elapsed), over: Math.max(0, elapsed - expectedMin) }
}

export function hasCountMismatch(job: OpsJob) {
  return job.itemsFound !== job.items
}

// Minutes until due; negative once late
export function getDueMinutes(job: OpsJob, now: number) {
  return Math.round((new Date(job.dueAt).getTime() - now) / MINUTE)
}

export function formatMinutes(minutes: number) {
  const value = Math.abs(Math.round(minutes))
  return value < 60 ? `${value} min` : `${Math.floor(value / 60)}h ${String(value % 60).padStart(2, '0')}m`
}

// ---------- What happens next ----------

export type NextAction = {
  label: string
  kind: 'start' | 'complete' | 'inspect' | 'notify' | 'none'
  // A washer or dryer has to be chosen first
  needsMachine: boolean
}

export function getNextAction(job: OpsJob): NextAction {
  const stage = getStage(job.stage)
  if (job.stage === 'ready') {
    return job.customerNotified
      ? { label: 'Customer notified', kind: 'none', needsMachine: false }
      : { label: 'Notify Customer', kind: 'notify', needsMachine: false }
  }
  if (job.stage === 'qc') return { label: 'Inspect', kind: 'inspect', needsMachine: false }
  if (job.stage === 'received') return { label: 'Start Sorting', kind: 'start', needsMachine: false }
  if (job.active) return { label: `Complete ${stage.verb}`, kind: 'complete', needsMachine: false }
  return { label: `Start ${stage.verb}`, kind: 'start', needsMachine: stage.machineType !== null }
}

const stamp = (job: OpsJob, by: string, text: string, change: Partial<OpsJob>): OpsJob => {
  const at = new Date().toISOString()
  return { ...job, ...change, stageSince: change.stage || change.active !== undefined ? at : job.stageSince, history: [{ at, text, by }, ...job.history] }
}

// Starts work on a waiting job, or completes it and queues it for the next stage
export function advanceJob(job: OpsJob, by: string, machine = ''): OpsJob {
  const action = getNextAction(job)
  const staff = job.staff || by
  if (job.stage === 'received') {
    return stamp(job, by, 'Sorting started', { stage: 'sorting', active: true, staff })
  }
  if (action.kind === 'start') {
    return stamp(job, by, `${getStage(job.stage).label} started${machine ? ` on ${machine}` : ''}`, { active: true, staff, machine })
  }
  if (action.kind === 'complete') {
    const next = STAGES[stageIndex(job.stage) + 1]
    return stamp(job, by, `${getStage(job.stage).label} completed`, {
      stage: next.id,
      active: false,
      machine: '',
      // The next stage is picked up by whoever is free, except the last hand-off
      staff: next.id === 'ready' ? staff : '',
      ...(job.stage === 'washing' && job.postWashKg === null ? { postWashKg: Number((job.weightKg * 0.97).toFixed(1)) } : {}),
    })
  }
  return job
}

// Puts a job into any stage's queue (Kanban moves and manager overrides)
export function moveJob(job: OpsJob, stage: StageId, by: string): OpsJob {
  if (stage === job.stage) return job
  return stamp(job, by, `Moved from ${getStage(job.stage).label} to ${getStage(stage).label}`, { stage, active: false, machine: '', staff: stage === 'received' ? '' : job.staff })
}

export function applyQc(job: OpsJob, result: QcResult, by: string): OpsJob {
  if (result.passed) return stamp(job, by, 'Quality check passed', { stage: 'packaging', active: false, staff: '', machine: '' })
  return stamp(job, by, `Quality check failed: ${result.reason}. Sent back to ${getStage(result.sendTo).label}`, {
    stage: result.sendTo,
    active: false,
    staff: '',
    machine: '',
    qcFailures: job.qcFailures + 1,
  })
}

export function assignStaff(job: OpsJob, staff: string, by: string): OpsJob {
  return { ...job, staff, history: [{ at: new Date().toISOString(), text: job.staff ? `Reassigned from ${job.staff} to ${staff}` : `Assigned to ${staff}`, by }, ...job.history] }
}

// ---------- Views ----------

export function matchesOpsFilters(job: OpsJob, filters: OpsFilters, now: number) {
  if (filters.stage && job.stage !== filters.stage) return false
  if (filters.staff && job.staff !== filters.staff) return false
  if (filters.service && job.service !== filters.service) return false
  if (filters.method && job.method !== filters.method) return false
  if (filters.view === 'delayed' && !isDelayed(job, now)) return false
  if (filters.view === 'express' && job.priority !== 'Express') return false
  if (filters.view === 'waiting' && (job.active || job.stage === 'ready')) return false
  if (filters.view === 'special' && job.instructions.length === 0) return false
  const query = filters.query.trim().toLowerCase()
  if (!query) return true
  return [job.id, job.customer, job.staff, job.machine, job.service].some((value) => value.toLowerCase().includes(query))
}

// Late and express work first, then whatever is due soonest
export function compareJobs(a: OpsJob, b: OpsJob) {
  return (
    Number(b.priority === 'Express') - Number(a.priority === 'Express') ||
    new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
  )
}

export function getStageStats(jobs: OpsJob[], now: number) {
  return STAGES.map((stage) => {
    const inStage = jobs.filter((job) => job.stage === stage.id)
    const waiting = inStage.filter((job) => !job.active)
    return {
      ...stage,
      jobs: inStage.length,
      active: inStage.length - waiting.length,
      waiting: waiting.length,
      items: inStage.reduce((sum, job) => sum + job.items, 0),
      kg: Math.round(inStage.reduce((sum, job) => sum + job.weightKg, 0)),
      // Longest any job has been waiting in this stage
      longestWait: Math.max(0, ...waiting.map((job) => getStageMinutes(job, now))),
      averageWait: waiting.length ? Math.round(waiting.reduce((sum, job) => sum + getStageMinutes(job, now), 0) / waiting.length) : 0,
    }
  })
}

// Stages where work is piling up, worst first. Received and Ready are queues by nature.
export function getBottlenecks(jobs: OpsJob[], now: number) {
  return getStageStats(jobs, now)
    .filter(({ id, waiting }) => id !== 'received' && id !== 'ready' && waiting >= BOTTLENECK_WAITING)
    .sort((a, b) => b.waiting * b.averageWait - a.waiting * a.averageWait)
}

export function getCapacity(jobs: OpsJob[]) {
  const workload = Math.round(jobs.reduce((sum, job) => sum + job.weightKg, 0))
  const finished = Math.round(jobs.filter(({ stage }) => stage === 'ready').reduce((sum, job) => sum + job.weightKg, 0))
  return {
    workload,
    finished,
    inProcess: workload - finished,
    remaining: Math.max(0, DAILY_CAPACITY_KG - workload),
    percent: Math.min(100, (workload / DAILY_CAPACITY_KG) * 100),
  }
}

export function getHealth(jobs: OpsJob[], machinesDown: number, now: number): { level: OpsHealth; onSchedule: number; reasons: string[] } {
  const open = jobs.filter(({ stage }) => stage !== 'ready')
  const delayed = open.filter((job) => isDelayed(job, now)).length
  const onSchedule = open.length ? Math.round(((open.length - delayed) / open.length) * 100) : 100
  const bottlenecks = getBottlenecks(jobs, now)
  const capacity = getCapacity(jobs)
  const reasons = [
    ...(delayed > 0 ? [`${delayed} ${delayed === 1 ? 'order is' : 'orders are'} past due`] : []),
    ...(bottlenecks.length > 0 ? [`${bottlenecks[0].label} has ${bottlenecks[0].waiting} loads waiting`] : []),
    ...(machinesDown > 0 ? [`${machinesDown} ${machinesDown === 1 ? 'machine is' : 'machines are'} out of service`] : []),
    ...(capacity.percent >= 90 ? [`Capacity is ${capacity.percent.toFixed(0)}% used`] : []),
  ]
  const level: OpsHealth = onSchedule < 80 || machinesDown >= 4 ? 'Critical' : onSchedule < 92 || reasons.length >= 2 ? 'Warning' : 'Good'
  return { level, onSchedule, reasons }
}

export function getStaffLoad(jobs: OpsJob[], names: string[]) {
  return names.map((name) => {
    const mine = jobs.filter((job) => job.staff === name)
    const open = mine.filter(({ stage }) => stage !== 'ready')
    const current = open.find(({ active }) => active)
    return {
      name,
      activeJobs: open.length,
      completed: mine.length - open.length + jobs.filter((job) => job.history.some(({ by, text }) => by === name && text.endsWith('completed'))).length,
      stage: current ? getStage(current.stage).label : open[0] ? getStage(open[0].stage).label : '—',
      load: Math.min(100, Math.round((open.length / STAFF_JOB_CAPACITY) * 100)),
    }
  }).sort((a, b) => b.load - a.load)
}

// Whoever has the fewest jobs in hand
export function recommendStaff(jobs: OpsJob[], names: string[]) {
  return [...getStaffLoad(jobs, names)].sort((a, b) => a.activeJobs - b.activeJobs)[0]
}

export function jobsToCsv(jobs: OpsJob[], now: number) {
  const header = ['Order', 'Customer', 'Service', 'Items', 'Weight (kg)', 'Stage', 'State', 'Staff', 'Machine', 'In stage (min)', 'Due', 'Priority', 'Method', 'Delayed', 'Special instructions']
  const rows = jobs.map((job) => [
    job.id, job.customer, job.service, job.items, job.weightKg, getStage(job.stage).label,
    job.stage === 'ready' ? 'Ready' : job.active ? 'In progress' : 'Waiting', job.staff, job.machine,
    getStageMinutes(job, now), job.dueAt, job.priority, job.method, isDelayed(job, now) ? 'yes' : 'no',
    job.instructions.join(' '),
  ])
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
}
