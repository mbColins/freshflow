import { useSyncExternalStore } from 'react'
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

// In-memory notification centre shared by the page, the bell in the top bar and the menu badge.
// TODO: replace with the notifications API and a live connection; changes are lost on reload.
type State = {
  notifications: AppNotification[]
  rules: AutomationRule[]
  templates: MessageTemplate[]
  log: NotificationLogEntry[]
}

let state: State = {
  notifications: SAMPLE_NOTIFICATIONS,
  rules: SAMPLE_RULES,
  templates: SAMPLE_TEMPLATES,
  log: SAMPLE_NOTIFICATION_LOG,
}
const listeners = new Set<() => void>()

function setState(next: Partial<State>, logged?: [action: string, entity: string]) {
  state = {
    ...state,
    ...next,
    log: logged
      ? [{ at: new Date().toISOString(), user: CURRENT_USER, action: logged[0], entity: logged[1] }, ...(next.log ?? state.log)]
      : (next.log ?? state.log),
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const notificationStore = {
  // Changes the given notifications; pass a log entry for anything worth auditing
  update(ids: string[], change: (notification: AppNotification) => AppNotification, logged?: [string, string]) {
    setState({ notifications: state.notifications.map((item) => (ids.includes(item.id) ? change(item) : item)) }, logged)
  },
  add(notification: AppNotification, logged: [string, string]) {
    setState({ notifications: [notification, ...state.notifications] }, logged)
  },
  saveRule(rule: AutomationRule, logged: [string, string]) {
    const exists = state.rules.some(({ id }) => id === rule.id)
    setState({ rules: exists ? state.rules.map((item) => (item.id === rule.id ? rule : item)) : [rule, ...state.rules] }, logged)
  },
  saveTemplate(template: MessageTemplate, logged: [string, string]) {
    const exists = state.templates.some(({ id }) => id === template.id)
    setState({ templates: exists ? state.templates.map((item) => (item.id === template.id ? template : item)) : [template, ...state.templates] }, logged)
  },
  log(action: string, entity: string) {
    setState({}, [action, entity])
  },
}

function useNotifications() {
  return useSyncExternalStore(subscribe, () => state)
}

export default useNotifications
