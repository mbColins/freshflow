import { useSyncExternalStore } from 'react'
import { SAMPLE_SERVICES } from '../constants/sampleServices'
import type { LaundryService } from '../types/service'

// In-memory service catalog shared by the list and detail pages.
// TODO: replace with the services API; changes are lost on reload.
let services = SAMPLE_SERVICES
const listeners = new Set<() => void>()

function setServices(next: LaundryService[]) {
  services = next
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const serviceStore = {
  // Adds the service, or replaces the one with the same code
  save(service: LaundryService) {
    setServices(
      services.some(({ id }) => id === service.id)
        ? services.map((current) => (current.id === service.id ? service : current))
        : [service, ...services],
    )
  },
  update(ids: string[], change: (service: LaundryService) => LaundryService) {
    setServices(
      services.map((service) =>
        ids.includes(service.id) ? change(service) : service,
      ),
    )
  },
}

function useServices() {
  return useSyncExternalStore(subscribe, () => services)
}

export default useServices
