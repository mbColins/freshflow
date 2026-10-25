import type { MachinePermissions } from '../constants/machines'
import useCurrentUser from './useCurrentUser'

// What the signed-in person may do with machines, from their role's permissions
function useMachinePermissions(): MachinePermissions {
  const { can } = useCurrentUser()
  const manage = can('MACHINES:MANAGE')
  return { manage, administer: manage, maintain: can('MACHINES:MAINTAIN') || manage, financials: manage }
}

export default useMachinePermissions
