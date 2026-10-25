import type { BadgeTone } from '../components/ui/Badge'
import type {
  DispatchJob,
  Driver,
  JobPriority,
  JobStatus,
  JobType,
} from '../types/logistics'
import { DELIVERY_FLOW, PICKUP_FLOW, STATUS_LABELS, ZONES } from './logistics'

// Sample dispatch data until the logistics API exists. Times are relative to
// page load so delays and "ready for" timers stay meaningful.
const MINUTE_MS = 60_000
const loadedAt = Date.now()
const at = (minutes: number) => new Date(loadedAt + minutes * MINUTE_MS).toISOString()

export const SAMPLE_DRIVERS: Driver[] = [
  { id: 'jean', name: 'Jean Mbarga', vehicle: 'Motorbike · MC-234-AB', phone: '+237 677 100 201', status: 'onRoute', routeId: 'DLV-024', location: 'Bonapriso', stopsDone: 5, stopsTotal: 8, etaMin: 45, score: 96, note: '3 stops left', x: 215, y: 250 },
  { id: 'carlos', name: 'Carlos Mendez', vehicle: 'Van #1 · Toyota HiAce', phone: '+237 677 100 202', status: 'onRoute', routeId: 'DLV-021', location: 'Akwa Boulevard', stopsDone: 3, stopsTotal: 9, etaMin: 70, score: 88, note: 'Running late', x: 300, y: 135 },
  { id: 'samuel', name: 'Samuel Eto’o N.', vehicle: 'Van #2 · Renault Master', phone: '+237 677 100 203', status: 'available', routeId: '', location: 'In depot', stopsDone: 0, stopsTotal: 0, etaMin: null, score: 93, note: 'Ready to dispatch', x: 332, y: 226 },
  { id: 'patrice', name: 'Patrice Alima', vehicle: 'Motorbike · MC-189-CD', phone: '+237 677 100 204', status: 'break', routeId: '', location: 'In depot', stopsDone: 6, stopsTotal: 6, etaMin: null, score: 91, note: 'On a 30-minute break', x: 268, y: 228 },
  { id: 'aline', name: 'Aline Biya', vehicle: 'Motorbike · MC-311-EF', phone: '+237 677 100 205', status: 'offline', routeId: '', location: 'Off shift', stopsDone: 0, stopsTotal: 0, etaMin: null, score: 90, note: 'Shift starts 14:00', x: 0, y: 0 },
]

type Seed = {
  id: string
  type: JobType
  order: number
  customer: string
  phone: string
  address: string
  zone: string
  manifest: string
  packages: number
  amount: number
  payment: string
  paymentTone: BadgeTone
  priority?: JobPriority
  status: JobStatus
  driver?: string
  // Minutes from now
  scheduled: number
  ready?: number
  eta?: number
  km: number
  instructions?: string
  offset: [number, number]
}

const SEEDS: Seed[] = [
  { id: 'DLV-00241', type: 'delivery', order: 10482, customer: 'Sarah Mbarga', phone: '+237 655 321 884', address: 'Rue des Palmiers #14', zone: 'Bonapriso', manifest: '3 silk dresses, 1 tuxedo jacket', packages: 2, amount: 18_000, payment: 'MoMo paid', paymentTone: 'success', priority: 'express', status: 'enRoute', driver: 'jean', scheduled: 10, eta: 12, km: 3.2, instructions: 'Call before arrival.', offset: [18, -22] },
  { id: 'DLV-00192', type: 'delivery', order: 10428, customer: 'Alain Foning', phone: '+237 699 440 118', address: 'Boulevard de la Liberté', zone: 'Deido', manifest: '4 duvets, 6 pillowcases', packages: 3, amount: 14_800, payment: 'COD due', paymentTone: 'warning', status: 'failed', driver: 'carlos', scheduled: -50, km: 5.6, offset: [-14, -18] },
  { id: 'DLV-00239', type: 'delivery', order: 10440, customer: 'Grand Imperial Hotel', phone: '+237 699 120 441', address: 'Presidential Quarter, concierge desk', zone: 'Bonanjo', manifest: '40 linens, 20 bath robes', packages: 6, amount: 96_000, payment: 'Invoiced', paymentTone: 'neutral', status: 'done', driver: 'carlos', scheduled: -120, km: 2.4, offset: [-20, 16] },
  { id: 'DLV-00244', type: 'delivery', order: 10499, customer: 'Marcelle Nguemo', phone: '+237 671 689 102', address: 'Saint-Tropez Villa 4B', zone: 'Makepe', manifest: '2 wool suits, 5 pressed shirts', packages: 1, amount: 21_500, payment: 'Card paid', paymentTone: 'success', priority: 'sameDay', status: 'requested', scheduled: 180, ready: -342, km: 8.4, instructions: 'Leave with security if absent.', offset: [12, 20] },
  { id: 'DLV-00245', type: 'delivery', order: 10447, customer: 'Marc Belle', phone: '+237 655 001 928', address: 'Rue Franqueville 22', zone: 'Akwa', manifest: '2 pairs sneakers', packages: 1, amount: 17_888, payment: 'Card paid', paymentTone: 'success', status: 'scheduled', scheduled: 90, ready: -40, km: 4.1, offset: [22, 18] },
  { id: 'DLV-00246', type: 'delivery', order: 10444, customer: 'Paul Etoa', phone: '+237 698 214 667', address: 'Carrefour Maçon, Apt 3', zone: 'Bonamoussadi', manifest: '4 trousers, 4 shirts', packages: 1, amount: 12_200, payment: 'MoMo paid', paymentTone: 'success', status: 'assigned', driver: 'samuel', scheduled: 60, ready: -75, km: 9.3, offset: [-18, 14] },
  { id: 'DLV-00247', type: 'delivery', order: 10450, customer: 'Grand Palace Hotel', phone: '+237 699 120 441', address: 'Boulevard de la Liberté, service entrance', zone: 'Bonanjo', manifest: '40 bedsheets, 12 duvet covers', packages: 8, amount: 144_600, payment: 'On account', paymentTone: 'neutral', priority: 'express', status: 'enRoute', driver: 'carlos', scheduled: -48, eta: 20, km: 2.9, instructions: 'Deliver to concierge desk #1.', offset: [20, -14] },
  { id: 'DLV-00248', type: 'delivery', order: 10445, customer: 'Grace Ndi', phone: '+237 652 778 340', address: 'Rue Alfred Saker 9', zone: 'Deido', manifest: '6 pressed shirts', packages: 1, amount: 4_293, payment: 'Cash paid', paymentTone: 'success', status: 'arrived', driver: 'jean', scheduled: -5, eta: 0, km: 5.1, offset: [16, 16] },
  { id: 'DLV-00238', type: 'delivery', order: 10443, customer: 'Linda Fotso', phone: '+237 675 903 221', address: 'Immeuble Kassap, 2nd floor', zone: 'Akwa', manifest: '2 duvet covers', packages: 1, amount: 11_925, payment: 'MoMo paid', paymentTone: 'success', status: 'done', driver: 'jean', scheduled: -200, km: 4.0, offset: [-22, -14] },
  { id: 'DLV-00249', type: 'delivery', order: 10449, customer: 'Dr. Aris', phone: '+237 655 332 901', address: 'Clinic annex, Rue Koloko', zone: 'Bonapriso', manifest: '18 lab coats', packages: 2, amount: 32_198, payment: 'Cash paid', paymentTone: 'success', priority: 'express', status: 'requested', scheduled: 42, ready: -65, km: 3.0, offset: [-20, 14] },
  { id: 'PCK-00189', type: 'pickup', order: 10495, customer: 'Equinox Fitness Club', phone: '+237 699 300 772', address: 'Akwa Commercial Center, Bay 2', zone: 'Akwa', manifest: 'Commercial intake: 60 gym towels', packages: 4, amount: 0, payment: 'Corporate monthly', paymentTone: 'neutral', priority: 'express', status: 'assigned', driver: 'samuel', scheduled: 35, km: 4.6, offset: [-6, 24] },
  { id: 'PCK-00190', type: 'pickup', order: 10521, customer: 'Grace N.', phone: '+237 652 778 340', address: 'Cité des Palmiers, Block C', zone: 'Makepe', manifest: 'Wash & fold', packages: 2, amount: 0, payment: 'Pay on delivery', paymentTone: 'neutral', priority: 'express', status: 'requested', scheduled: 120, km: 8.0, instructions: 'Call customer before arrival.', offset: [-16, -18] },
  { id: 'PCK-00191', type: 'pickup', order: 10522, customer: 'Ibrahim Sali', phone: '+237 691 556 030', address: 'Rond-point Maetur', zone: 'Bonamoussadi', manifest: 'Dry cleaning: 2 suits', packages: 1, amount: 0, payment: 'Pay on delivery', paymentTone: 'neutral', status: 'scheduled', scheduled: 150, km: 9.8, offset: [16, -12] },
  { id: 'PCK-00187', type: 'pickup', order: 10510, customer: 'Dr. Aris Clinic', phone: '+237 655 332 901', address: 'Rue Koloko 42', zone: 'Bonapriso', manifest: '12 scrubs', packages: 2, amount: 0, payment: 'Account', paymentTone: 'neutral', status: 'done', driver: 'carlos', scheduled: -150, km: 3.1, offset: [24, 4] },
  { id: 'PCK-00186', type: 'pickup', order: 10505, customer: 'Akwa Palace Hotel', phone: '+237 699 300 772', address: 'Dock bay 3', zone: 'Akwa', manifest: '25 beddings', packages: 5, amount: 0, payment: 'Account', paymentTone: 'neutral', status: 'received', driver: 'carlos', scheduled: -240, km: 4.3, offset: [26, -8] },
  { id: 'PCK-00192', type: 'pickup', order: 10523, customer: 'Fatima Bello', phone: '+237 653 119 874', address: 'Rue Tokoto 5', zone: 'Deido', manifest: 'Wash & fold', packages: 1, amount: 0, payment: 'Pay on delivery', paymentTone: 'neutral', status: 'enRoute', driver: 'jean', scheduled: 15, eta: 9, km: 5.9, offset: [-24, 6] },
]

function buildJob(seed: Seed): DispatchJob {
  const zone = ZONES.find(({ name }) => name === seed.zone)!
  const flow = seed.type === 'pickup' ? PICKUP_FLOW : DELIVERY_FLOW
  const reached = Math.max(0, flow.indexOf(seed.status === 'arrived' ? 'enRoute' : seed.status))
  const start = Math.min(seed.scheduled - 60, -90)
  const end = Math.min(seed.scheduled, -2)
  const timeline = flow.slice(0, reached + 1).map((status, index) => ({
    at: at(start + ((end - start) * index) / Math.max(1, reached)),
    text: STATUS_LABELS[status][seed.type],
  }))
  const finishedAt = at(Math.min(seed.scheduled + 8, -3))

  return {
    id: seed.id,
    type: seed.type,
    orderId: `ORD-${seed.order}`,
    customer: seed.customer,
    phone: seed.phone,
    address: seed.address,
    zone: seed.zone,
    instructions: seed.instructions ?? '',
    manifest: seed.manifest,
    packages: seed.packages,
    amount: seed.amount,
    payment: seed.payment,
    paymentTone: seed.paymentTone,
    priority: seed.priority ?? 'standard',
    status: seed.status,
    driverId: seed.driver ?? null,
    scheduledAt: at(seed.scheduled),
    readyAt: seed.ready === undefined ? null : at(seed.ready),
    etaMin: seed.eta ?? null,
    distanceKm: seed.km,
    timeline:
      seed.status === 'failed'
        ? [...timeline, { at: finishedAt, text: 'Delivery attempt failed' }]
        : timeline,
    proof:
      seed.type === 'delivery' && seed.status === 'done'
        ? { recipient: seed.customer, method: 'OTP Verified', at: finishedAt }
        : undefined,
    failure:
      seed.status === 'failed'
        ? {
            reason: 'Customer unavailable',
            notes: 'Driver waited 14 minutes at the gate; two calls went unanswered.',
            nextAction: 'Reschedule',
            at: finishedAt,
          }
        : undefined,
    x: zone.x + seed.offset[0],
    y: zone.y + seed.offset[1],
  }
}

export const SAMPLE_JOBS: DispatchJob[] = SEEDS.map(buildJob)
