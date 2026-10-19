import { serviceApi, serviceErrorMessage, useListServicesQuery } from '../services/serviceApi'
import type { ServiceListParams } from '../services/serviceApi'
import { store } from '../store'
import type { LaundryService } from '../types/service'
import { toServiceRequest } from '../utils/serviceMapping'

// One shared argument so every page reads the same cached list
// TODO: page through the list once there are more services than this
const ALL_SERVICES: ServiceListParams = { page: 0, size: 100 }
const NO_SERVICES: LaundryService[] = []

// The service list with its loading / error state, for pages that show them
export function useServicesQuery() {
  return useListServicesQuery(ALL_SERVICES)
}

const cached = () => serviceApi.endpoints.listServices.select(ALL_SERVICES)(store.getState()).data?.items ?? NO_SERVICES

// Shows a change in the cached list at once; undo() puts it back
function patchList(change: (services: LaundryService[]) => LaundryService[]) {
  return store.dispatch(
    serviceApi.util.updateQueryData('listServices', ALL_SERVICES, (page) => {
      page.items = change(page.items)
    }),
  )
}

// Saving services. Each call resolves to null when the server accepted the
// change, or to the reason it didn't (and the change is undone).
export const serviceStore = {
  // Creates the service (no uuid yet) or saves every field of an existing one
  async save(service: LaundryService): Promise<string | null> {
    const request = toServiceRequest(service, cached())
    try {
      if (service.uuid) {
        await store.dispatch(serviceApi.endpoints.updateService.initiate({ uuid: service.uuid, changes: request })).unwrap()
      } else {
        await store.dispatch(serviceApi.endpoints.createService.initiate(request)).unwrap()
      }
      return null
    } catch (error) {
      return serviceErrorMessage(error)
    }
  },
  // Applies `change` to each service. Only changes the API stores are sent;
  // the rest (promotions, the local audit trail) stay in the cached list until
  // it reloads. TODO: drop that once promotions and audit come from the API
  async update(ids: string[], change: (service: LaundryService) => LaundryService): Promise<string | null> {
    for (const id of ids) {
      const all = cached()
      const current = all.find((service) => service.id === id)
      if (!current) continue
      const next = change(current)
      const local = patchList((services) => services.map((service) => (service.id === id ? next : service)))
      const request = toServiceRequest(next, all)
      if (JSON.stringify(request) === JSON.stringify(toServiceRequest(current, all))) continue
      if (!current.uuid) {
        local.undo()
        return `${current.name} isn’t saved on the server, so it can’t be changed.`
      }
      try {
        await store.dispatch(serviceApi.endpoints.updateService.initiate({ uuid: current.uuid, changes: request })).unwrap()
      } catch (error) {
        local.undo()
        return serviceErrorMessage(error)
      }
    }
    return null
  },
}

// Just the services; empty until GET /service answers
function useServices() {
  return useServicesQuery().data?.items ?? NO_SERVICES
}

export default useServices
