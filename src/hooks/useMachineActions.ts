import { useMachineActionMutation } from '../services/machineApi'

type Priority = 'NORMAL' | 'HIGH'

// The machine's runtime calls, by name. Each resolves when the server accepted
// it and rejects with the error the server sent. Machines are addressed by uuid
function useMachineActions() {
  const [run] = useMachineActionMutation()
  const call = (id: string, path: string, body?: unknown, method: 'POST' | 'PATCH' | 'PUT' | 'DELETE' = 'POST') =>
    run({ id, path, method, body }).unwrap()
  return {
    // Only OFFLINE and AVAILABLE can be set by hand; 409 machine_busy with a job on it
    setStatus: (id: string, status: 'OFFLINE' | 'AVAILABLE', note: string) => call(id, '/status', { status, note }, 'PATCH'),
    // Starts at once on a free machine, otherwise queues. 409 machine_not_operational, machine_over_capacity
    assignJob: (id: string, job: { order?: string; service: string; loadKg: number; priority: Priority; cycle?: string }) => call(id, '/jobs', job),
    pause: (id: string) => call(id, '/job/pause'),
    resume: (id: string) => call(id, '/job/resume'),
    stop: (id: string, reason: string) => call(id, '/job/stop', { reason }),
    complete: (id: string) => call(id, '/job/complete'),
    // Exactly the queued jobs' uuids, in their new order
    reorderQueue: (id: string, jobs: string[]) => call(id, '/queue', { jobs }, 'PUT'),
    removeQueued: (id: string, jobUuid: string) => call(id, `/queue/${encodeURIComponent(jobUuid)}`, undefined, 'DELETE'),
    // HIGH and CRITICAL stop the machine
    reportFault: (id: string, fault: { type: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; description: string; technician?: string; downtimeMin?: number }) =>
      call(id, '/faults', fault),
    resolveFault: (id: string, faultUuid: string, resolution: string, repairCost?: number) =>
      call(id, `/faults/${encodeURIComponent(faultUuid)}/resolve`, { resolution, ...(repairCost ? { repairCost } : {}) }),
    scheduleMaintenance: (id: string, entry: { date: string; time: string; type: string; technician: string; durationMin: number; cost: number; description: string }) =>
      call(id, '/maintenance', entry),
    startMaintenance: (id: string, entryUuid: string) => call(id, `/maintenance/${encodeURIComponent(entryUuid)}/start`),
    completeMaintenance: (id: string, entryUuid: string, cost?: number) =>
      call(id, `/maintenance/${encodeURIComponent(entryUuid)}/complete`, cost === undefined ? {} : { cost }),
    cancelMaintenance: (id: string, entryUuid: string) => call(id, `/maintenance/${encodeURIComponent(entryUuid)}/cancel`),
    transfer: (id: string, branch: string, reason: string) => call(id, '/transfer', { branch, reason }),
    retire: (id: string, reason: string, condition: string) => call(id, '/retire', { reason, condition }),
  }
}

export default useMachineActions
