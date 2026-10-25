import { useMemo } from 'react'
import { useListAuditQuery } from '../services/auditApi'
import { useGetMachineQuery, useListMachinesQuery } from '../services/machineApi'
import type { MachineListParams } from '../services/machineApi'
import type { Machine } from '../types/machine'
import { toMachine } from '../utils/machineMapping'

// TODO: page through the list if a tenant ever has more machines than this
const ALL_MACHINES: MachineListParams = { page: 0, size: 500 }
const NO_MACHINES: Machine[] = []

// The fleet with its loading and error state, runtime included (status, job,
// queue, metrics). The list leaves out costs, logs and transfers
export function useMachineList() {
  const query = useListMachinesQuery(ALL_MACHINES)
  const machines = useMemo(() => (query.data ? query.data.items.map(toMachine) : NO_MACHINES), [query.data])
  return {
    machines,
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  }
}

// One machine in full: costs, maintenance log, faults and transfers from the
// single read, and its activity from the audit trail
export function useMachineDetail(uuid: string) {
  const query = useGetMachineQuery(uuid, { skip: !uuid })
  const audit = useListAuditQuery({ entityType: 'MACHINE', entity: uuid, page: 0, size: 50 }, { skip: !uuid })
  const machine = useMemo(() => {
    if (!query.data) return undefined
    return {
      ...toMachine(query.data),
      activity: (audit.data?.items ?? []).map((entry) => ({ at: entry.at, text: entry.summary || entry.action, by: entry.actor || 'System' })),
    }
  }, [query.data, audit.data])
  return { machine, isLoading: query.isLoading }
}

// Just the machines; empty until GET /machines answers
function useMachines() {
  return useMachineList().machines
}

export default useMachines
