import { useEffect, useMemo } from 'react'
import { useListMachinesQuery } from '../services/machineApi'
import type { MachineListParams } from '../services/machineApi'
import type { Machine } from '../types/machine'
import { toMachine } from '../utils/machineMapping'
import { createStore } from './createStore'

// TODO: page through the list if a tenant ever has more machines than this
const ALL_MACHINES: MachineListParams = { page: 0, size: 500 }
const NO_MACHINES: Machine[] = []

// Profiles come from GET /machines. The server keeps nothing about what a
// machine is doing (status, jobs, faults, maintenance), so changes to those
// are held here per machine and last until the page is reloaded
const overlay = createStore<Record<string, Machine>>({})
let latest: Machine[] = NO_MACHINES

export const machineStore = {
  update(id: string, change: (machine: Machine) => Machine) {
    const current = latest.find((machine) => machine.id === id)
    if (current) overlay.set({ ...overlay.get(), [id]: change(current) })
  },
}

// The stored profile always wins over the held runtime state
function merge(profile: Machine, held: Machine | undefined): Machine {
  if (!held) return profile
  const { id, uuid, name, type, manufacturer, model, serial, yearPurchased, description, branchId, area, zone, specs, capabilities, purchaseCost, maintenanceEveryDays } = profile
  return { ...held, id, uuid, name, type, manufacturer, model, serial, yearPurchased, description, branchId, area, zone, specs, capabilities, purchaseCost, maintenanceEveryDays }
}

// The fleet with its loading and error state, for the pages that show them
export function useMachineList() {
  const query = useListMachinesQuery(ALL_MACHINES)
  const held = overlay.useValue()
  const machines = useMemo(
    () => (query.data ? query.data.items.map((server) => merge(toMachine(server), held[server.code])) : NO_MACHINES),
    [query.data, held],
  )
  useEffect(() => {
    latest = machines
  })
  return {
    machines,
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  }
}

// Just the machines; empty until GET /machines answers
function useMachines() {
  return useMachineList().machines
}

export default useMachines
