import { CURRENT_USER } from '../constants/orders'
import {
  SAMPLE_NOTIFICATIONS,
  SAMPLE_NOTIFICATION_LOG,
  SAMPLE_RULES,
  SAMPLE_TEMPLATES,
} from '../constants/sampleNotifications'
import type {
  AppNotification,
  AutomationRule,
  MessageTemplate,
  NotificationLogEntry,
} from '../types/notification'
import { createStore } from './createStore'

// In-memory notification centre shared by the page, the bell in the top bar and the menu badge.
// TODO: replace with the notifications API and a live connection; changes are lost on reload.
type State = {
  notifications: AppNotification[]
  rules: AutomationRule[]
  templates: MessageTemplate[]
  log: NotificationLogEntry[]
}

const store = createStore<State>({
  notifications: SAMPLE_NOTIFICATIONS,
  rules: SAMPLE_RULES,
  templates: SAMPLE_TEMPLATES,
  log: SAMPLE_NOTIFICATION_LOG,
})

function setState(next: Partial<State>, logged?: [action: string, entity: string]) {
  const state = store.get()
  store.set({
    ...state,
    ...next,
    log: logged
      ? [{ at: new Date().toISOString(), user: CURRENT_USER, action: logged[0], entity: logged[1] }, ...(next.log ?? state.log)]
      : (next.log ?? state.log),
  })
}

export const notificationStore = {
  // Changes the given notifications; pass a log entry for anything worth auditing
  update(ids: string[], change: (notification: AppNotification) => AppNotification, logged?: [string, string]) {
    setState({ notifications: store.get().notifications.map((item) => (ids.includes(item.id) ? change(item) : item)) }, logged)
  },
  add(notification: AppNotification, logged: [string, string]) {
    setState({ notifications: [notification, ...store.get().notifications] }, logged)
  },
  saveRule(rule: AutomationRule, logged: [string, string]) {
    const { rules } = store.get()
    const exists = rules.some(({ id }) => id === rule.id)
    setState({ rules: exists ? rules.map((item) => (item.id === rule.id ? rule : item)) : [rule, ...rules] }, logged)
  },
  saveTemplate(template: MessageTemplate, logged: [string, string]) {
    const { templates } = store.get()
    const exists = templates.some(({ id }) => id === template.id)
    setState({ templates: exists ? templates.map((item) => (item.id === template.id ? template : item)) : [template, ...templates] }, logged)
  },
  log(action: string, entity: string) {
    setState({}, [action, entity])
  },
}

const useNotifications = store.useValue

export default useNotifications
