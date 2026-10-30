import type { ApiResponse } from '../types/api'
import type { CustomerFilters } from '../types/customer'
import { api } from './api'

// Saved customer segments (/customer/segments). A segment is a named set of
// the list's filters; the filter names are the same as the list's query
// parameters, so the server can expand a segment to its own filters.

export type SavedSegment = {
  id: string
  name: string
  filters: Partial<CustomerFilters>
  // Visible to everyone in the business, not only its creator
  shared: boolean
  by: string
  // Created by the caller
  mine: boolean
}

type RawSegment = {
  id?: string
  name?: string | null
  filters?: Partial<CustomerFilters> | null
  shared?: boolean
  by?: string | null
  mine?: boolean
}

const SEGMENTS = { type: 'Customer' as const, id: 'SEGMENTS' }

export const customerSegmentsApi = api.injectEndpoints({
  endpoints: (build) => ({
    // The shared ones and the caller's own
    listSegments: build.query<SavedSegment[], void>({
      query: () => '/customer/segments',
      transformResponse: (response: ApiResponse<RawSegment[] | null>) =>
        (response.content ?? []).flatMap((raw) =>
          raw?.id
            ? [
                {
                  id: raw.id,
                  name: raw.name ?? '',
                  filters: raw.filters ?? {},
                  shared: !!raw.shared,
                  by: raw.by ?? '',
                  mine: !!raw.mine,
                },
              ]
            : [],
        ),
      providesTags: [SEGMENTS],
    }),
    // 409 segment_name_taken; 422 name_required, filters_required
    createSegment: build.mutation<void, { name: string; filters: Partial<CustomerFilters>; shared?: boolean }>({
      query: (body) => ({ url: '/customer/segments', method: 'POST', body }),
      transformResponse: () => undefined,
      invalidatesTags: [SEGMENTS],
    }),
    // The creator, or a manager or the owner
    deleteSegment: build.mutation<void, string>({
      query: (id) => ({ url: `/customer/segments/${encodeURIComponent(id)}`, method: 'DELETE' }),
      transformResponse: () => undefined,
      invalidatesTags: [SEGMENTS],
    }),
  }),
})

export const { useListSegmentsQuery, useCreateSegmentMutation, useDeleteSegmentMutation } = customerSegmentsApi
