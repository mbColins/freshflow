import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
  FetchBaseQueryMeta,
} from '@reduxjs/toolkit/query'
import { logout, PRE_AUTH, setCredentials } from '../store/slices/authSlice'
import type { ApiResponse } from '../types/api'
import type { RefreshResponse } from '../types/auth'

type StateWithAuth = {
  auth: {
    token: string | null
    refreshToken: string | null
    tokenType: string | null
  }
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_URL,
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as StateWithAuth).auth.token
    // A request may bring its own token (e.g. the set-password call)
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`)
    }
    return headers
  },
})

// Login, OTP and password-reset calls answer 401 for bad input, not for an
// expired session, so they never trigger a refresh or a logout
function isAuthFlowRequest(args: string | FetchArgs) {
  const url = typeof args === 'string' ? args : args.url
  return url.startsWith('/auth/') || url.startsWith('/otp/')
}

// Shared so that parallel 401s wait for a single refresh call
let refreshing: Promise<boolean> | null = null

async function refreshSession(
  api: Parameters<BaseQueryFn>[1],
  extraOptions: object,
) {
  const { refreshToken } = (api.getState() as StateWithAuth).auth
  if (!refreshToken) return false
  // TODO: confirm the method with the backend
  const result = await rawBaseQuery(
    {
      url: `/auth/refresh/${encodeURIComponent(refreshToken)}`,
      method: 'POST',
    },
    api,
    extraOptions,
  )
  if (!result.data) return false
  const { content } = result.data as ApiResponse<RefreshResponse>
  api.dispatch(
    setCredentials({
      token: content.access_token,
      // Keep the current refresh token if the API doesn't rotate it
      refreshToken: content.refresh_token ?? refreshToken,
      tokenType: content.token_type,
    }),
  )
  return true
}

// On a 401 from the app's own data, refresh the access token once and retry;
// if that fails, the session is over
const baseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError,
  object,
  FetchBaseQueryMeta
> = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions)
  if (result.error?.status !== 401 || isAuthFlowRequest(args)) return result

  const { tokenType } = (api.getState() as StateWithAuth).auth
  if (tokenType !== PRE_AUTH) {
    refreshing ??= refreshSession(api, extraOptions).finally(() => {
      refreshing = null
    })
    if (await refreshing) {
      result = await rawBaseQuery(args, api, extraOptions)
      if (result.error?.status !== 401) return result
    }
  }
  api.dispatch(logout())
  // Don't leave the previous user's data cached for whoever signs in next
  api.dispatch(resetApiCache())
  return result
}

// Single API slice for the whole app. Each feature adds its endpoints from its
// own file with api.injectEndpoints (see services/authApi.ts).
export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: [
    'Branch',
    'Customer',
    'DeliveryZone',
    'Driver',
    'Inventory',
    'Logistics',
    'Machine',
    'Notification',
    'Order',
    'Payment',
    'PlatformPlan',
    'Pricing',
    'Promotion',
    'Role',
    'Service',
    'Staff',
    'Subscription',
    'TenantConfig',
    'Domain',
    'AppConfig',
    'Audit',
    'Operations',
    'Tenant',
    'User',
  ],
  endpoints: () => ({}),
})

// Module-level so baseQuery (whose `api` parameter shadows this slice) can use it
function resetApiCache() {
  return api.util.resetApiState()
}
