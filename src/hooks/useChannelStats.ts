import { useGetChannelStatsQuery } from '../services/notificationCenterApi'
import type { ChannelStats } from '../types/notification'

const NO_STATS: ChannelStats[] = []

// Per-channel delivery figures for the last 30 days. Only owners and managers
// may read them; for anyone else the list stays empty
function useChannelStats() {
  const query = useGetChannelStatsQuery(30)
  return { stats: query.data ?? NO_STATS, isLoading: query.isLoading }
}

export default useChannelStats
