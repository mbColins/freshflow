import useCurrentUser from './useCurrentUser'
import { useSendInAppNotificationMutation } from '../services/inAppNotificationApi'
import { useLazyListBranchUsersQuery, useLazyListTenantUsersQuery } from '../services/userApi'
import type { ComposeInput } from '../types/notification'
import type { AppUser, UserType } from '../types/user'
import { fillVariables, getUsedVariables } from '../utils/notifications'

// The same people the notification centre's audiences mean on the server
const STAFF: UserType[] = ['STAFF_MEMBER', 'WASHER', 'DRY_CLEANER', 'FRONT_DESK', 'DELIVERY_AGENT', 'STORE_MANAGER', 'MANAGER']
const MANAGERS: UserType[] = ['MANAGER', 'STORE_MANAGER']
const AUDIENCES: Record<string, (user: AppUser) => boolean> = {
  STAFF_ALL: ({ userType }) => userType !== null && STAFF.includes(userType),
  BRANCH_MANAGERS: ({ userType }) => userType !== null && MANAGERS.includes(userType),
  OWNER: ({ userType }) => userType === 'TENANT',
}

// The server takes at most this many recipients in one call
const MAX_PER_CALL = 500

const fullName = (user: AppUser) => `${user.firstName} ${user.lastName}`.trim() || user.username

export type InAppSendResult = {
  // Staff who now have it in their bell
  created: number
  // Sends that were refused after others went through (only possible when each person gets their own text)
  failed: number
}

// Sends an In-App message now, through POST /notifications. The audience (All staff, Branch
// managers, Business owner) is turned into staff accounts here, since that endpoint takes users.
// Rejects with the server's error; a 403 means someone was outside what the sender may reach
function useSendInApp() {
  const { user } = useCurrentUser()
  const [send] = useSendInAppNotificationMutation()
  const [loadTenantUsers] = useLazyListTenantUsersQuery()
  const [loadBranchUsers] = useLazyListBranchUsersQuery()

  async function recipientsOf(input: ComposeInput) {
    const matches = AUDIENCES[input.audience]
    if (!matches) return []
    // The owner has no branch, so that audience is looked up business-wide. Otherwise the branch the
    // message is limited to, else the sender's own, else the whole business (the owner)
    const branch = input.audience === 'OWNER' ? '' : input.branchId || user?.branchUuid || ''
    const people = branch ? await loadBranchUsers(branch).unwrap() : await loadTenantUsers().unwrap()
    return people.filter((person) => person.active && matches(person))
  }

  return async function sendInApp(input: ComposeInput): Promise<InAppSendResult> {
    const people = await recipientsOf(input)
    if (people.length === 0) return { created: 0, failed: 0 }
    const category = input.audience === 'CUSTOMERS' ? 'CUSTOMERS' : 'STAFF'
    const body = { title: input.title || 'Message', message: input.message, category }

    // {{customerName}} and {{branchName}} get their own text per person, as for the other channels
    if (getUsedVariables(`${body.title} ${body.message}`).length > 0) {
      const results = await Promise.allSettled(
        people.map((person) => {
          const values = { customerName: fullName(person), branchName: person.branch || person.tenant }
          return send({ ...body, title: fillVariables(body.title, values), message: fillVariables(body.message, values), userUuids: [person.uuid] }).unwrap()
        }),
      )
      const created = results.reduce((sum, result) => sum + (result.status === 'fulfilled' ? result.value : 0), 0)
      const firstError = results.find((result) => result.status === 'rejected')
      if (created === 0 && firstError?.status === 'rejected') throw firstError.reason
      return { created, failed: results.filter((result) => result.status === 'rejected').length }
    }

    let created = 0
    for (let start = 0; start < people.length; start += MAX_PER_CALL) {
      created += await send({ ...body, userUuids: people.slice(start, start + MAX_PER_CALL).map(({ uuid }) => uuid) }).unwrap()
    }
    return { created, failed: 0 }
  }
}

export default useSendInApp
