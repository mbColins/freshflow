import type { ApiResponse } from '../types/api'
import type { MessageTemplate, NotificationCategory } from '../types/notification'
import { api } from './api'
import { CHANNEL_FROM_SERVER, CHANNEL_TO_SERVER } from './notificationCenterApi'

// The business's own message wording (/message-templates). Reading needs NOTIFICATIONS:VIEW,
// creating or changing needs NOTIFICATIONS:MANAGE_TEMPLATES. 409 message_template_name_already_exists,
// 422 for an unknown {{variable}} or a missing name or message

type RawTemplate = {
  uuid?: string
  name?: string
  category?: string
  channel?: string
  language?: string
  active?: boolean
  subject?: string | null
  body?: string
  updatedAt?: string | null
  createdAt?: string | null
}

const LANGUAGE_FROM_SERVER: Record<string, MessageTemplate['language']> = { en: 'English', fr: 'French' }
const LANGUAGE_TO_SERVER: Record<MessageTemplate['language'], string> = { English: 'en', French: 'fr' }

function toTemplate(raw: RawTemplate): MessageTemplate {
  return {
    id: raw.uuid ?? '',
    name: raw.name ?? '',
    category: (raw.category ?? 'system').toLowerCase() as NotificationCategory,
    channel: CHANNEL_FROM_SERVER[raw.channel ?? ''] ?? 'SMS',
    language: LANGUAGE_FROM_SERVER[raw.language ?? ''] ?? 'English',
    active: raw.active ?? true,
    updatedAt: raw.updatedAt ?? raw.createdAt ?? '',
    subject: raw.subject ?? '',
    body: raw.body ?? '',
  }
}

// What the form edits, in the words the server uses
function toBody({ name, category, channel, language, active, subject, body }: Partial<MessageTemplate>) {
  return {
    name,
    category: category?.toUpperCase(),
    channel: channel ? CHANNEL_TO_SERVER[channel] : undefined,
    language: language ? LANGUAGE_TO_SERVER[language] : undefined,
    active,
    subject,
    body,
  }
}

const LIST = { type: 'MessageTemplate' as const, id: 'LIST' }
// A saved template also shows up in the message log (the audit trail)
const AUDIT = { type: 'Audit' as const, id: 'LIST' }

export const messageTemplateApi = api.injectEndpoints({
  endpoints: (build) => ({
    // Newest first
    listMessageTemplates: build.query<MessageTemplate[], void>({
      query: () => '/message-templates',
      transformResponse: (response: ApiResponse<RawTemplate[] | null>) => (response.content ?? []).map(toTemplate),
      providesTags: [LIST],
    }),
    createMessageTemplate: build.mutation<MessageTemplate, Omit<MessageTemplate, 'id' | 'updatedAt'>>({
      query: (template) => ({ url: '/message-templates', method: 'POST', body: toBody(template) }),
      transformResponse: (response: ApiResponse<RawTemplate>) => toTemplate(response.content),
      invalidatesTags: [LIST, AUDIT],
    }),
    // Sends only what is given: `{ id, changes: { active: false } }` just switches it off
    updateMessageTemplate: build.mutation<MessageTemplate, { id: string; changes: Partial<Omit<MessageTemplate, 'id' | 'updatedAt'>> }>({
      query: ({ id, changes }) => ({ url: `/message-templates/${encodeURIComponent(id)}`, method: 'PATCH', body: toBody(changes) }),
      transformResponse: (response: ApiResponse<RawTemplate>) => toTemplate(response.content),
      invalidatesTags: [LIST, AUDIT],
    }),
  }),
})

export const { useListMessageTemplatesQuery, useCreateMessageTemplateMutation, useUpdateMessageTemplateMutation } = messageTemplateApi
