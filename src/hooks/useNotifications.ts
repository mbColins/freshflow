import { SAMPLE_NOTIFICATION_LOG, SAMPLE_RULES, SAMPLE_TEMPLATES } from '../constants/sampleNotifications'
import type { AutomationRule, MessageTemplate, NotificationLogEntry } from '../types/notification'
import { createStore } from './createStore'

// Automation rules and message templates have no backend yet, so they live
// here and last until the page is reloaded. The inbox itself, its channel
// figures and preferences come from the notification centre API
type State = {
  rules: AutomationRule[]
  templates: MessageTemplate[]
  log: NotificationLogEntry[]
}

const store = createStore<State>({
  rules: SAMPLE_RULES,
  templates: SAMPLE_TEMPLATES,
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
  saveTemplate(template: MessageTemplate, logged: [string, string], by: string) {
    const { templates } = store.get()
    const exists = templates.some(({ id }) => id === template.id)
    setState({ templates: exists ? templates.map((item) => (item.id === template.id ? template : item)) : [template, ...templates] }, logged, by)
  },
  log(action: string, entity: string, by: string) {
    setState({}, [action, entity], by)
  },
}

const useNotifications = store.useValue

export default useNotifications
