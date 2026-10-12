import type { JobEvent, OpsJob, StageId } from '../types/operations'
import { OPS_STAFF, STAGES } from './operations'

// Sample jobs, relative to page-load time so the floor always looks mid-shift
const NOW = Date.now()
const MINUTE = 60_000
const ago = (minutes: number) => new Date(NOW - minutes * MINUTE).toISOString()

// Smooth pseudo-random value in [0, 1) so the jobs vary without Math.random
const vary = (seed: number, salt: number) => {
  const value = Math.sin(seed * 12.9898 + salt * 78.233) * 43_758.5453
  return value - Math.floor(value)
}

const CUSTOMERS = [
  'Grand Imperial Hotel', 'Dr. Aris Clinic', 'Apex Financial Corp', 'Equinox Fitness Club', 'Sophie Laurent',
  'John Doe', 'Sarah K.', 'Amina Bello', 'Joseph Tabi', 'Hôtel La Falaise', 'Nadia Fotso', 'Résidence Bastos',
  'Beatrice Eboa', 'Claire Ondoa', 'Clinique du Littoral',
]
const SERVICES = ['Wash & Fold', 'Bedding & Duvet', 'Dry Cleaning', 'Sanitize 60°C', 'Ironing Only', 'Wash & Fold']
const INSTRUCTIONS = [
  ['Do not use bleach.'],
  ['Customer requested cold water.', 'Separate white garments.'],
  ['Handle delicate fabric carefully.'],
  ['Hypoallergenic detergent only.'],
]

// How many jobs sit in each stage, and how many of those are being worked on
const FLOOR: [stage: StageId, total: number, active: number][] = [
  ['received', 6, 0],
  ['sorting', 4, 3],
  ['washing', 7, 5],
  ['drying', 7, 3],
  ['ironing', 6, 4],
  ['qc', 4, 1],
  ['packaging', 3, 2],
  ['ready', 8, 0],
]

// Jobs past their due time, and a count that came up short at intake
const LATE = [9, 15, 19, 22, 27]
const SHORT_COUNT = 13

function buildHistory(index: number, stage: StageId, staff: string, sinceMin: number): JobEvent[] {
  const reached = STAGES.findIndex(({ id }) => id === stage)
  const events: JobEvent[] = []
  let minutes = sinceMin
  for (let position = reached; position >= 0; position -= 1) {
    const { label, id } = STAGES[position]
    const by = position === 0 ? 'Aisha Tamba' : OPS_STAFF[(index + position) % OPS_STAFF.length]
    events.push({
      at: ago(minutes),
      text: id === 'received' ? 'Received at the counter' : id === 'ready' ? 'Marked ready' : `${label} started`,
      by: position === reached && staff ? staff : by,
    })
    minutes += STAGES[Math.max(position - 1, 0)].expectedMin + 6 + Math.round(vary(index, position) * 14)
  }
  return events
}

let counter = 0

// TODO: replace with the operations API
export const SAMPLE_JOBS: OpsJob[] = FLOOR.flatMap(([stage, total, activeCount]) =>
  Array.from({ length: total }, (_, position): OpsJob => {
    const index = counter
    counter += 1
    const meta = STAGES.find(({ id }) => id === stage)!
    const active = position < activeCount
    const late = LATE.includes(index)
    const stagesLeft = STAGES.length - 1 - STAGES.findIndex(({ id }) => id === stage)
    const service = SERVICES[index % SERVICES.length]
    const items = service === 'Bedding & Duvet' ? 4 + (index % 9) : 5 + Math.round(vary(index, 1) * 22)
    const weightKg = Number((3 + vary(index, 2) * 14).toFixed(1))
    // One washer and one dryer are deliberately over their expected time
    const sinceMin = active
      ? Math.round(meta.expectedMin * (index === 12 || index === 18 ? 1.5 : 0.15 + vary(index, 3) * 0.75))
      : stage === 'ready'
        ? 20 + Math.round(vary(index, 3) * 160)
        : stage === 'drying'
          ? 28 + Math.round(vary(index, 3) * 30)
          : 4 + Math.round(vary(index, 3) * 26)
    const staff = active || stage === 'ready' ? OPS_STAFF[(index * 5 + 1) % OPS_STAFF.length] : stage === 'received' ? '' : index % 3 === 0 ? '' : OPS_STAFF[index % OPS_STAFF.length]
    const machine = active && meta.machineType ? `${meta.machineType === 'Dryer' ? 'Dryer' : 'Washer'} #0${(position % 5) + 1}` : ''
    return {
      id: `ORD-${10_428 + index}`,
      customer: CUSTOMERS[index % CUSTOMERS.length],
      service,
      items,
      itemsFound: index === SHORT_COUNT ? items - 1 : items,
      weightKg,
      postWashKg: stagesLeft <= 4 && service !== 'Ironing Only' ? Number((weightKg * 0.97).toFixed(1)) : null,
      stage,
      active,
      staff,
      machine,
      stageSince: ago(sinceMin),
      dueAt: new Date(NOW + (late ? -(25 + index * 3) : stage === 'ready' ? 180 : stagesLeft * 45 + 30 + Math.round(vary(index, 4) * 120)) * MINUTE).toISOString(),
      priority: index % 5 === 2 || late ? 'Express' : 'Normal',
      method: index % 3 === 0 ? 'Delivery' : 'Pickup',
      instructions: index % 4 === 1 ? INSTRUCTIONS[index % INSTRUCTIONS.length] : [],
      qcFailures: index === 22 ? 1 : 0,
      customerNotified: stage === 'ready' && position < 5,
      history: buildHistory(index, stage, staff, sinceMin),
    }
  }),
)

export const SAMPLE_FLOOR_EVENTS: JobEvent[] = [
  { at: ago(18), text: 'Drying queue reached 4 waiting loads', by: 'System' },
  { at: ago(64), text: 'Quality control queue cleared', by: 'Priya Patel' },
  { at: ago(140), text: 'Express queue increased to 6 orders', by: 'System' },
  { at: ago(215), text: 'First washing cycle started', by: 'Jean Mbarga' },
  { at: ago(250), text: 'Operations started', by: 'Marcus Vance' },
]
