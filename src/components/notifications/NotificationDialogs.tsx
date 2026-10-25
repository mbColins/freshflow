import { useState } from 'react'
import { ArrowLeft, ArrowRight, Plus, Send, Trash2, TriangleAlert } from 'lucide-react'
import {
  COMPOSE_AUDIENCES,
  CATEGORIES,
  CHANNELS,
  RULE_FIELDS,
  RULE_RECIPIENTS,
  RULE_TRIGGERS,
  TEMPLATE_VARIABLES,
} from '../../constants/notifications'
import type {
  AutomationRule,
  ComposeInput,
  MessageTemplate,
  NotificationCategory,
  NotificationChannel,
} from '../../types/notification'
import {
  describeRule,
  formatStamp,
  getUnknownVariables,
  renderTemplate,
} from '../../utils/notifications'
import { fieldClass, iconButton, primaryButton, secondaryButton, sectionTitle } from '../orders/styles'
import Modal from '../ui/Modal'
import FormField from '../ui/FormField'

function ChannelPicker({ value, onChange }: { value: NotificationChannel[]; onChange: (channels: NotificationChannel[]) => void }) {
  return (
    <div role="group" aria-label="Channels" className="flex flex-wrap gap-1.5">
      {CHANNELS.map((channel) => {
        const on = value.includes(channel)
        return (
          <button
            key={channel}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((item) => item !== channel) : CHANNELS.filter((item) => item === channel || value.includes(item)))}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
              on ? 'bg-brand text-white' : 'bg-field text-ink hover:bg-line'
            }`}
          >
            {channel}
          </button>
        )
      })}
    </div>
  )
}

// How the message looks on the chosen channel
function MessagePreview({ channel, title, body }: { channel: NotificationChannel; title: string; body: string }) {
  const text = body || 'Your message appears here.'
  if (channel === 'Email') {
    return (
      <div className="overflow-hidden rounded-lg ring-1 ring-line">
        <p className="border-b border-line bg-field px-3 py-2 text-xs font-bold text-ink">{title || 'Subject'}</p>
        <p className="px-3 py-3 text-xs leading-relaxed whitespace-pre-line text-ink">{text}</p>
      </div>
    )
  }
  if (channel === 'SMS' || channel === 'WhatsApp') {
    return (
      <div className="rounded-lg bg-field p-3">
        <p className="mb-1 text-[10px] font-semibold text-muted">{channel} · FreshFlow</p>
        <p className={`w-fit max-w-full rounded-2xl rounded-bl-sm px-3 py-2 text-xs leading-relaxed whitespace-pre-line ${channel === 'WhatsApp' ? 'bg-success/15 text-ink' : 'bg-white text-ink ring-1 ring-line'}`}>
          {text}
        </p>
        {channel === 'SMS' && <p className="mt-1 text-[10px] text-muted tabular-nums">{text.length} characters · {Math.max(1, Math.ceil(text.length / 160))} SMS</p>}
      </div>
    )
  }
  return (
    <div className="flex gap-3 rounded-lg bg-white p-3 shadow-md ring-1 ring-line">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand text-[10px] font-bold text-white" aria-hidden="true">FF</span>
      <div className="min-w-0">
        <p className="text-xs font-bold text-ink">{title || 'Notification title'}</p>
        <p className="text-xs whitespace-pre-line text-muted">{text}</p>
      </div>
    </div>
  )
}

// ---------- Create notification ----------

const COMPOSE_STEPS = ['Audience', 'Channel', 'Message', 'Delivery', 'Review']

export function ComposeDialog({
  branches,
  now,
  onClose,
  onSend,
}: {
  branches: { id: string; name: string }[]
  now: number
  onClose: () => void
  onSend: (input: ComposeInput) => void
}) {
  const [step, setStep] = useState(0)
  const [later, setLater] = useState(false)
  const [input, setInput] = useState<ComposeInput>({ audience: COMPOSE_AUDIENCES[0].value, channels: ['In-App'], title: '', message: '', branchId: '', scheduledFor: '' })
  const patch = (change: Partial<ComposeInput>) => setInput({ ...input, ...change })
  const last = COMPOSE_STEPS.length - 1
  const problems = [
    ...(input.channels.length === 0 ? ['Choose at least one channel (Channel).'] : []),
    ...(!input.title.trim() ? ['Add a title (Message).'] : []),
    ...(!input.message.trim() ? ['Write the message (Message).'] : []),
    ...(later && !input.scheduledFor ? ['Pick the date and time to send (Delivery).'] : []),
    ...(later && input.scheduledFor && new Date(input.scheduledFor).getTime() <= now ? ['The scheduled time must be in the future (Delivery).'] : []),
  ]

  return (
    <Modal
      open
      onClose={onClose}
      variant="lg"
      title="Create Notification"
      subtitle={`Step ${step + 1} of ${COMPOSE_STEPS.length}: ${COMPOSE_STEPS[step]}`}
      footer={
        <>
          {step > 0 && (
            <button type="button" onClick={() => setStep(step - 1)} className={`${secondaryButton} mr-auto`}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back
            </button>
          )}
          {step < last ? (
            <button type="button" onClick={() => setStep(step + 1)} className={primaryButton}>
              Continue
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              disabled={problems.length > 0}
              onClick={() => onSend({ ...input, title: input.title.trim(), message: input.message.trim(), scheduledFor: later ? input.scheduledFor : '' })}
              className={primaryButton}
            >
              <Send className="size-4" aria-hidden="true" />
              {later ? 'Schedule Notification' : 'Send Notification'}
            </button>
          )}
        </>
      }
    >
      <ol className="mb-5 flex gap-1" aria-label="Wizard steps">
        {COMPOSE_STEPS.map((label, index) => (
          <li key={label} className="min-w-0 flex-1">
            <button type="button" aria-current={index === step ? 'step' : undefined} onClick={() => setStep(index)} className="block w-full rounded-sm text-left focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
              <span className={`block h-1 rounded-full ${index <= step ? 'bg-brand' : 'bg-field'}`} />
              <span className={`mt-1 block truncate text-[10px] font-semibold ${index === step ? 'text-brand' : 'text-muted'}`}>{index + 1} {label}</span>
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="space-y-3">
          <div role="radiogroup" aria-label="Audience" className="grid gap-2 sm:grid-cols-2">
            {COMPOSE_AUDIENCES.map(({ value, label, kind, help }) => {
              const selected = input.audience === value
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => patch({ audience: value })}
                  className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-xs transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
                    selected ? 'bg-brand/10 ring-2 ring-brand' : 'bg-field hover:bg-line'
                  }`}
                >
                  <span>
                    <span className="block font-bold text-ink">{label}</span>
                    <span className="text-[11px] text-muted">{kind === 'customer' ? 'Customers' : 'Employees'} · {help}</span>
                  </span>
                </button>
              )
            })}
          </div>
          <FormField label="Limit to a branch" htmlFor="compose-branch">
            <select id="compose-branch" value={input.branchId} onChange={(event) => patch({ branchId: event.target.value })} className={`${fieldClass} sm:w-72!`}>
              <option value="">All branches</option>
              {branches.map(({ id, name }) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </FormField>
          <p className="text-[11px] text-muted">A manager always sends within their own branch. Platform admins must pick one.</p>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <p className="text-xs text-muted">Choose one or more channels. The same message goes out on each.</p>
          <ChannelPicker value={input.channels} onChange={(channels) => patch({ channels })} />
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <FormField label="Title" htmlFor="compose-title">
              <input id="compose-title" autoComplete="off" placeholder="e.g. Holiday opening hours" value={input.title} onChange={(event) => patch({ title: event.target.value })} className={fieldClass} />
            </FormField>
            <FormField label="Message" htmlFor="compose-message">
              <textarea id="compose-message" rows={5} value={input.message} onChange={(event) => patch({ message: event.target.value })} className={`${fieldClass} h-auto py-2`} />
            </FormField>
          </div>
          <div>
            <p className={sectionTitle}>Preview: {input.channels[0] ?? 'In-App'}</p>
            <div className="mt-2">
              <MessagePreview channel={input.channels[0] ?? 'In-App'} title={input.title} body={input.message} />
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <div role="radiogroup" aria-label="Delivery" className="grid gap-2 sm:grid-cols-2">
            {(
              [
                [false, 'Send now', 'Goes out as soon as you confirm.'],
                [true, 'Schedule', 'Pick a date and time; it waits in the Scheduled tab.'],
              ] as const
            ).map(([value, label, help]) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={later === value}
                onClick={() => setLater(value)}
                className={`rounded-lg px-3 py-2.5 text-left text-xs transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${later === value ? 'bg-brand/10 ring-2 ring-brand' : 'bg-field hover:bg-line'}`}
              >
                <span className="block font-bold text-ink">{label}</span>
                <span className="text-[11px] text-muted">{help}</span>
              </button>
            ))}
          </div>
          {later && (
            <FormField label="Send at" htmlFor="compose-when">
              <input id="compose-when" type="datetime-local" value={input.scheduledFor} onChange={(event) => patch({ scheduledFor: event.target.value })} className={`${fieldClass} sm:w-64!`} />
            </FormField>
          )}
        </div>
      )}

      {step === last && (
        <div className="space-y-3">
          <dl className="divide-y divide-line rounded-lg bg-field px-3 text-xs">
            {(
              [
                ['Audience', `${COMPOSE_AUDIENCES.find(({ value }) => value === input.audience)?.label ?? input.audience}${input.branchId ? ` · ${branches.find(({ id }) => id === input.branchId)?.name}` : ''}`],
                ['Channels', input.channels.join(' + ') || 'None'],
                ['Delivery', later ? (input.scheduledFor ? `Scheduled for ${formatStamp(new Date(input.scheduledFor).toISOString())}` : 'Scheduled (no time set)') : 'Immediately'],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="flex gap-3 py-2">
                <dt className="w-24 shrink-0 font-semibold text-ink">{label}</dt>
                <dd className="min-w-0 text-muted">{value}</dd>
              </div>
            ))}
          </dl>
          <MessagePreview channel={input.channels[0] ?? 'In-App'} title={input.title} body={input.message} />
          {problems.length > 0 ? (
            <ul className="space-y-1 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger" role="alert">
              {problems.map((problem) => (
                <li key={problem} className="flex items-start gap-1.5">
                  <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                  {problem}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-ink">
              No messaging provider is connected yet: the notification is recorded in the inbox, but no SMS, WhatsApp, push or email actually leaves the system.
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}

// ---------- Automation rule builder ----------

export function RuleDialog({ rule, onClose, onSave }: { rule: AutomationRule; onClose: () => void; onSave: (rule: AutomationRule) => void }) {
  const [draft, setDraft] = useState(rule)
  const patch = (change: Partial<AutomationRule>) => setDraft({ ...draft, ...change })
  const fields = Object.keys(RULE_FIELDS)
  const setCondition = (index: number, change: Partial<AutomationRule['conditions'][number]>) =>
    patch({ conditions: draft.conditions.map((condition, position) => (position === index ? { ...condition, ...change } : condition)) })
  const valid = draft.name.trim() !== '' && draft.channels.length > 0
  const block = 'rounded px-1.5 py-0.5 text-[10px] font-bold'

  return (
    <Modal
      open
      onClose={onClose}
      variant="lg"
      title={rule.name ? `Edit rule: ${rule.name}` : 'New Automation Rule'}
      subtitle="Describe what should be sent, to whom, when something happens."
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="button" disabled={!valid} onClick={() => onSave({ ...draft, name: draft.name.trim(), active: false })} className={secondaryButton}>
            Save as Off
          </button>
          <button type="button" disabled={!valid} onClick={() => onSave({ ...draft, name: draft.name.trim(), active: true })} className={primaryButton}>
            Save and Activate
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Rule name" htmlFor="rule-name">
          <input id="rule-name" autoComplete="off" placeholder="e.g. Order ready" value={draft.name} onChange={(event) => patch({ name: event.target.value })} className={`${fieldClass} sm:w-80!`} />
        </FormField>

        <div className="space-y-2 rounded-lg bg-field p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`${block} bg-white text-muted ring-1 ring-line`}>WHEN</span>
            <select aria-label="Trigger" value={draft.trigger} onChange={(event) => patch({ trigger: event.target.value })} className={`${fieldClass} w-auto! bg-white`}>
              {RULE_TRIGGERS.map((trigger) => (
                <option key={trigger}>{trigger}</option>
              ))}
            </select>
          </div>
          {draft.conditions.map((condition, index) => (
            <div key={index} className="flex flex-wrap items-center gap-2">
              {index === 0 ? (
                <span className={`${block} bg-white text-muted ring-1 ring-line`}>IF</span>
              ) : (
                <select aria-label="Combine conditions with" value={draft.logic} onChange={(event) => patch({ logic: event.target.value as AutomationRule['logic'] })} className={`${fieldClass} h-7 w-auto! bg-white text-[10px] font-bold`}>
                  <option>AND</option>
                  <option>OR</option>
                </select>
              )}
              <select aria-label={`Condition ${index + 1} field`} value={condition.field} onChange={(event) => setCondition(index, { field: event.target.value, value: RULE_FIELDS[event.target.value][0] })} className={`${fieldClass} w-auto! bg-white`}>
                {fields.map((field) => (
                  <option key={field}>{field}</option>
                ))}
              </select>
              <span className="text-xs text-muted">is</span>
              <select aria-label={`Condition ${index + 1} value`} value={condition.value} onChange={(event) => setCondition(index, { value: event.target.value })} className={`${fieldClass} w-auto! bg-white`}>
                {(RULE_FIELDS[condition.field] ?? []).map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
              <button type="button" aria-label={`Remove condition ${index + 1}`} onClick={() => patch({ conditions: draft.conditions.filter((_, position) => position !== index) })} className={iconButton}>
                <Trash2 className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => patch({ conditions: [...draft.conditions, { field: fields[0], value: RULE_FIELDS[fields[0]][0] }] })} className={`${secondaryButton} h-8`}>
            <Plus className="size-3.5 text-muted" aria-hidden="true" />
            Add condition
          </button>
        </div>

        <div className="space-y-2 rounded-lg bg-field p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`${block} bg-brand/10 text-brand`}>THEN SEND</span>
            <ChannelPicker value={draft.channels} onChange={(channels) => patch({ channels })} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`${block} bg-brand/10 text-brand`}>TO</span>
            <select aria-label="Recipient" value={draft.audience} onChange={(event) => patch({ audience: event.target.value })} className={`${fieldClass} w-auto! bg-white`}>
              {RULE_RECIPIENTS.map((recipient) => (
                <option key={recipient}>{recipient}</option>
              ))}
            </select>
          </div>
        </div>

        <p className="rounded-lg bg-brand/5 px-3 py-2 text-xs text-ink ring-1 ring-brand/20" aria-live="polite">
          <span className="font-bold">In plain words:</span> {describeRule(draft)}
        </p>
      </div>
    </Modal>
  )
}

// ---------- Template editor ----------

export function TemplateDialog({ template, onClose, onSave }: { template: MessageTemplate; onClose: () => void; onSave: (template: MessageTemplate) => void }) {
  const [draft, setDraft] = useState(template)
  const patch = (change: Partial<MessageTemplate>) => setDraft({ ...draft, ...change })
  const unknown = getUnknownVariables(`${draft.subject} ${draft.body}`)
  const valid = draft.name.trim() !== '' && draft.body.trim() !== '' && unknown.length === 0
  return (
    <Modal
      open
      onClose={onClose}
      variant="lg"
      title={template.name ? `Edit template: ${template.name}` : 'New Template'}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="button" disabled={!valid} onClick={() => onSave({ ...draft, name: draft.name.trim(), updatedAt: new Date().toISOString() })} className={primaryButton}>
            Save Template
          </button>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid content-start gap-3 sm:grid-cols-2">
          <FormField label="Template name" htmlFor="template-name" wide>
            <input id="template-name" autoComplete="off" value={draft.name} onChange={(event) => patch({ name: event.target.value })} className={fieldClass} />
          </FormField>
          <FormField label="Category" htmlFor="template-category">
            <select id="template-category" value={draft.category} onChange={(event) => patch({ category: event.target.value as NotificationCategory })} className={fieldClass}>
              {CATEGORIES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Channel" htmlFor="template-channel">
            <select id="template-channel" value={draft.channel} onChange={(event) => patch({ channel: event.target.value as NotificationChannel })} className={fieldClass}>
              {CHANNELS.map((channel) => (
                <option key={channel}>{channel}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Language" htmlFor="template-language">
            <select id="template-language" value={draft.language} onChange={(event) => patch({ language: event.target.value as MessageTemplate['language'] })} className={fieldClass}>
              <option>English</option>
              <option>French</option>
            </select>
          </FormField>
          <FormField label={draft.channel === 'Email' ? 'Subject' : 'Title'} htmlFor="template-subject">
            <input id="template-subject" autoComplete="off" value={draft.subject} onChange={(event) => patch({ subject: event.target.value })} className={fieldClass} />
          </FormField>
          <FormField label="Message" htmlFor="template-body" wide>
            <textarea id="template-body" rows={5} value={draft.body} onChange={(event) => patch({ body: event.target.value })} className={`${fieldClass} h-auto py-2 font-mono text-[11px]`} />
          </FormField>
          <div className="sm:col-span-2">
            <p className={sectionTitle}>Insert a variable</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {Object.keys(TEMPLATE_VARIABLES).map((name) => (
                <button key={name} type="button" onClick={() => patch({ body: `${draft.body}{{${name}}}` })} className="rounded bg-field px-1.5 py-1 font-mono text-[10px] text-ink hover:bg-line focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
                  {`{{${name}}}`}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <p className={sectionTitle}>Live preview with sample values</p>
          <div className="mt-2">
            <MessagePreview channel={draft.channel} title={renderTemplate(draft.subject)} body={renderTemplate(draft.body)} />
          </div>
          {unknown.length > 0 && (
            <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger" role="alert">
              <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              Unknown {unknown.length === 1 ? 'variable' : 'variables'}: {unknown.map((name) => `{{${name}}}`).join(', ')}. They would be sent as written.
            </p>
          )}
        </div>
      </div>
    </Modal>
  )
}
