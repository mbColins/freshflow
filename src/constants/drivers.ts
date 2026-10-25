import type { BadgeTone } from '../components/ui/Badge'
import type { DriverAvailability } from '../types/driver'

export const DRIVER_AVAILABILITY: { id: DriverAvailability; label: string; tone: BadgeTone }[] = [
  { id: 'AVAILABLE', label: 'Available', tone: 'success' },
  { id: 'ON_ROUTE', label: 'On Route', tone: 'brand' },
  { id: 'OFF_DUTY', label: 'Off Duty', tone: 'neutral' },
]

// Suggestions only; the backend takes any text
export const VEHICLE_TYPES = ['Motorbike', 'Car', 'Van', 'Tricycle', 'Bicycle']
