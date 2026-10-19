import { SAMPLE_MACHINES } from '../constants/sampleMachines'
import type { Machine } from '../types/machine'
import { createStore } from './createStore'

// In-memory fleet shared by the list and detail pages.
// TODO: replace with the machines API; changes are lost on reload.
const store = createStore<Machine[]>(SAMPLE_MACHINES)

export const machineStore = {
  add(machine: Machine) {
    store.set([machine, ...store.get()])
  },
  update(id: string, change: (machine: Machine) => Machine) {
    store.set(store.get().map((machine) => (machine.id === id ? change(machine) : machine)))
  },
}

const useMachines = store.useValue

export default useMachines
