import type { ApiResponse } from '../types/api'
import { api } from './api'

export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'PAST_DUE' | 'CANCELLED'

// A tenant has one subscription per period and keeps the history
export type Subscription = {
  id: string
  // The tenant's name and the plan's code
  tenant: string
  plan: string
  status: SubscriptionStatus
  startsAt: string
  endsAt: string
  trialEndsAt: string
  createdBy: string
  createdAt: string
}

type RawSubscription = {
  uuid?: string
  tenant?: string | null
  plan?: string | null
  status?: string | null
  subscriptionStartDate?: string | null
  subscriptionEndDate?: string | null
  trialEndsAt?: string | null
  createdBy?: string | null
  createdAt?: string | null
}

export type SubscriptionPage = { items: Subscription[]; total: number }

const toSubscription = (raw: RawSubscription): Subscription[] =>
  raw?.uuid
    ? [
        {
          id: raw.uuid,
          tenant: raw.tenant ?? '',
          plan: raw.plan ?? '',
          status: (raw.status ?? 'EXPIRED') as SubscriptionStatus,
          startsAt: raw.subscriptionStartDate ?? '',
          endsAt: raw.subscriptionEndDate ?? '',
          trialEndsAt: raw.trialEndsAt ?? '',
          createdBy: raw.createdBy ?? '',
          createdAt: raw.createdAt ?? '',
        },
      ]
    : []

const LIST = { type: 'Subscription' as const, id: 'LIST' }

export const subscriptionApi = api.injectEndpoints({
  endpoints: (build) => ({
    // Newest first. A platform admin sees every tenant's, anyone else their own
    // tenant's history
    listSubscriptions: build.query<SubscriptionPage, { page?: number; size?: number } | void>({
      query: (params) => ({ url: '/subscriptions', params: params ?? undefined }),
      transformResponse: (response: ApiResponse<{ data?: RawSubscription[]; totalElements?: number }>) => {
        const items = (response.content?.data ?? []).flatMap(toSubscription)
        return { items, total: response.content?.totalElements ?? items.length }
      },
      providesTags: [LIST],
    }),
    // Tenant owner only (the body's `tenant` is ignored for them). The outcome
    // depends on what runs: a first subscription starts a trial, a renewal is
    // active at once, and while one is running the new one is scheduled to
    // start when it ends. 409 while another is already scheduled; 400
    // subscription_plan_inactive
    subscribe: build.mutation<string, { plan: string }>({
      query: (body) => ({ url: '/subscriptions', method: 'POST', body }),
      transformResponse: (response: ApiResponse<unknown>) => response.message,
      invalidatesTags: [LIST, { type: 'User', id: 'ME' }, { type: 'Tenant', id: 'LIST' }],
    }),
    // Platform admin only: set a status directly
    setSubscriptionStatus: build.mutation<void, { id: string; status: SubscriptionStatus }>({
      query: ({ id, status }) => ({
        url: `/subscriptions/${encodeURIComponent(id)}/${encodeURIComponent(status)}`,
        method: 'PATCH',
      }),
      transformResponse: () => undefined,
      invalidatesTags: [LIST, { type: 'Tenant', id: 'LIST' }],
    }),
  }),
})

export const { useListSubscriptionsQuery, useSubscribeMutation, useSetSubscriptionStatusMutation } = subscriptionApi
