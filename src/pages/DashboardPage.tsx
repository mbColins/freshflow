import { useState } from 'react'
import type { StageId } from '../constants/pipeline'
import { USER_TYPES } from '../constants/users'
import useCurrentUser from '../hooks/useCurrentUser'
import { useGetBranchDropdownQuery } from '../services/branchApi'
import { api } from '../services/api'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import EquipmentTelemetry from '../components/dashboard/EquipmentTelemetry'
import EventStream from '../components/dashboard/EventStream'
import InsightsCard from '../components/dashboard/InsightsCard'
import KpiStrip from '../components/dashboard/KpiStrip'
import LogisticsCard from '../components/dashboard/LogisticsCard'
import NeedsAttention from '../components/dashboard/NeedsAttention'
import OperationsPipeline from '../components/dashboard/OperationsPipeline'
import OrderDistribution from '../components/dashboard/OrderDistribution'
import OrdersTable from '../components/dashboard/OrdersTable'
import QuickActions from '../components/dashboard/QuickActions'
import RevenueChart from '../components/dashboard/RevenueChart'
import StaffMetrics from '../components/dashboard/StaffMetrics'
import SupplyStock from '../components/dashboard/SupplyStock'
import {
  ROLE_SECTIONS,
  roleForUserType,
} from '../components/dashboard/dashboardState'
import type { SectionId } from '../components/dashboard/dashboardState'

const DASHBOARD_QUERIES = new Set([
  'getKpis',
  'getRevenueOverview',
  'getOrderDistribution',
  'getPipeline',
  'getAttention',
  'getDashboardLogistics',
  'getDashboardSupplies',
  'getDashboardStaff',
  'getInsights',
  'getDashboardEvents',
])
// Rows whose cards share the width equally, however many the role shows
const rowClass = 'grid gap-4 lg:auto-cols-fr lg:grid-flow-col'

function DashboardPage() {
  const { user, isPlatformAdmin } = useCurrentUser()
  // A tenant owner (or platform admin) can narrow the dashboard to one branch;
  // everyone else only ever sees their own branch
  const seesAllBranches = user?.userType === 'TENANT' || isPlatformAdmin
  const { data: branchOptions } = useGetBranchDropdownQuery(undefined, { skip: !seesAllBranches })
  const [branch, setBranch] = useState('')
  // The connected user's type decides which sections show
  const role = roleForUserType(user?.userType)
  const userTypeLabel = user?.userType ? USER_TYPES[user.userType] : ''
  const [stageFilter, setStageFilter] = useState<StageId | null>(null)
  const dispatch = useAppDispatch()
  // True while any card's request is in flight
  const refreshing = useAppSelector((state) =>
    Object.values(state.api.queries).some((query) => query?.status === 'pending' && DASHBOARD_QUERIES.has(query.endpointName ?? '')),
  )

  const shows = (section: SectionId) => ROLE_SECTIONS[role].includes(section)

  function handleRefresh() {
    dispatch(api.util.invalidateTags(['Dashboard', { type: 'Payment', id: 'REVENUE' }, { type: 'Order', id: 'LIST' }]))
  }

  return (
    <>
          <h1 className="sr-only">Dashboard</h1>

          <QuickActions
            userTypeLabel={userTypeLabel}
            branches={seesAllBranches ? (branchOptions ?? []).map(({ uuid, name }) => ({ id: uuid, name })) : undefined}
            branch={branch}
            onBranchChange={setBranch}
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />

            <div
              className={`space-y-4 transition-opacity ${refreshing ? 'opacity-60' : ''}`}
              aria-busy={refreshing}
            >
              {shows('kpis') && <KpiStrip branch={branch} />}

              {shows('revenue') && (
                <div className="grid gap-4 lg:grid-cols-3">
                  <RevenueChart branch={branch} />
                  <OrderDistribution branch={branch} />
                </div>
              )}

              {shows('pipeline') && (
                <OperationsPipeline
                  branch={branch}
                  selectedStage={stageFilter}
                  onSelectStage={setStageFilter}
                />
              )}

              <div className={rowClass}>
                {shows('attention') && <NeedsAttention branch={branch} />}
                {shows('logistics') && <LogisticsCard branch={branch} />}
              </div>

              {shows('orders') && (
                <OrdersTable
                  branch={branch}
                  stageFilter={stageFilter}
                  onStageFilterChange={setStageFilter}
                />
              )}

              {(shows('equipment') || shows('supplies') || shows('staff')) && (
                <div className={rowClass}>
                  {shows('equipment') && <EquipmentTelemetry branch={branch} />}
                  {shows('supplies') && <SupplyStock branch={branch} />}
                  {shows('staff') && <StaffMetrics branch={branch} />}
                </div>
              )}

              <div className={rowClass}>
                {shows('insights') && <InsightsCard branch={branch} />}
                {shows('events') && <EventStream branch={branch} />}
              </div>
            </div>
    </>
  )
}

export default DashboardPage
