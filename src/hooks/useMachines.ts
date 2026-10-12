import { useSyncExternalStore } from 'react'
import { SAMPLE_MACHINES } from '../constants/sampleMachines'
import type { Machine } from '../types/machine'

// In-memory fleet shared by the list and detail pages.
// TODO: replace with the machines API; changes are lost on reload.
let machines = SAMPLE_MACHINES
const listeners = new Set<() => void>()

function setMachines(next: Machine[]) {
  machines = next
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const machineStore = {
  add(machine: Machine) {
    setMachines([machine, ...machines])
  },
  update(id: string, change: (machine: Machine) => Machine) {
    setMachines(machines.map((machine) => (machine.id === id ? change(machine) : machine)))
  },
}

function useMachines() {
  return useSyncExternalStore(subscribe, () => machines)
}

export default useMachines
