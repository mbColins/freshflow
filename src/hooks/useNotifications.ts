import { SAMPLE_NOTIFICATION_LOG, SAMPLE_RULES } from '../constants/sampleNotifications'
import type { AutomationRule, NotificationLogEntry } from '../types/notification'
import { createStore } from './createStore'

// Automation rules have no backend yet, so they live here and last until the
// page is reloaded. The inbox, its channel figures, preferences and message
// templates come from the API
type State = {
  rules: AutomationRule[]
  log: NotificationLogEntry[]
}

const store = createStore<State>({
  rules: SAMPLE_RULES,
  log: SAMPLE_NOTIFICATION_LOG,
})

function setState(next: Partial<State>, logged: [action: string, entity: string] | undefined, by: string) {
  const state = store.get()
  store.set({
    ...state,
    ...next,
    log: logged ? [{ at: new Date().toISOString(), user: by, action: logged[0], entity: logged[1] }, ...state.log] : state.log,
  })
}

export const notificationStore = {
  saveRule(rule: AutomationRule, logged: [string, string], by: string) {
    const { rules } = store.get()
    const exists = rules.some(({ id }) => id === rule.id)
    setState({ rules: exists ? rules.map((item) => (item.id === rule.id ? rule : item)) : [rule, ...rules] }, logged, by)
  },
  log(action: string, entity: string, by: string) {
    setState({}, [action, entity], by)
  },
}

const useNotifications = store.useValue

export default useNotifications
