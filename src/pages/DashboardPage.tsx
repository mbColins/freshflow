import { useEffect, useRef, useState } from 'react'
import type { StageId } from '../constants/pipeline'
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
  DashboardViewContext,
  ROLE_SECTIONS,
} from '../components/dashboard/dashboardState'
import type {
  Role,
  SectionId,
  ViewState,
} from '../components/dashboard/dashboardState'

const REFRESH_MS = 800
// Rows whose cards share the width equally, however many the role shows
const rowClass = 'grid gap-4 lg:auto-cols-fr lg:grid-flow-col'

function DashboardPage() {
  const [role, setRole] = useState<Role>('manager')
  const [viewState, setViewState] = useState<ViewState>('normal')
  const [refreshing, setRefreshing] = useState(false)
  const [stageFilter, setStageFilter] = useState<StageId | null>(null)
  const refreshTimer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(refreshTimer.current), [])

  const shows = (section: SectionId) => ROLE_SECTIONS[role].includes(section)

  function handleRefresh() {
    // TODO: refetch dashboard data; for now this only simulates the delay
    setRefreshing(true)
    window.clearTimeout(refreshTimer.current)
    refreshTimer.current = window.setTimeout(
      () => setRefreshing(false),
      REFRESH_MS,
    )
  }

  return (
    <>
          <h1 className="sr-only">Dashboard</h1>

          <QuickActions
            role={role}
            onRoleChange={setRole}
            viewState={viewState}
            onViewStateChange={setViewState}
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />

          <DashboardViewContext
            value={{ viewState, onRetry: () => setViewState('normal') }}
          >
            <div
              className={`space-y-4 transition-opacity ${refreshing ? 'opacity-60' : ''}`}
              aria-busy={refreshing}
            >
              {shows('kpis') && <KpiStrip />}

              {shows('revenue') && (
                <div className="grid gap-4 lg:grid-cols-3">
                  <RevenueChart />
                  <OrderDistribution />
                </div>
              )}

              {shows('pipeline') && (
                <OperationsPipeline
                  selectedStage={stageFilter}
                  onSelectStage={setStageFilter}
                />
              )}

              <div className={rowClass}>
                {shows('attention') && <NeedsAttention />}
                {shows('logistics') && <LogisticsCard />}
              </div>

              {shows('orders') && (
                <OrdersTable
                  stageFilter={stageFilter}
                  onStageFilterChange={setStageFilter}
                />
              )}

              {(shows('equipment') || shows('supplies') || shows('staff')) && (
                <div className={rowClass}>
                  {shows('equipment') && <EquipmentTelemetry />}
                  {shows('supplies') && <SupplyStock />}
                  {shows('staff') && <StaffMetrics />}
                </div>
              )}

              <div className={rowClass}>
                {shows('insights') && <InsightsCard />}
                {shows('events') && <EventStream />}
              </div>
            </div>
          </DashboardViewContext>
    </>
  )
}

export default DashboardPage
