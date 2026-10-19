import { Navigate, Outlet } from 'react-router'
import useSettings from '../../hooks/useSettings'
import { useAppSelector } from '../../store/hooks'
import { selectIsAuthenticated } from '../../store/slices/authSlice'

// Wraps the sign-in and recovery pages: a signed-in user goes to the app
function GuestOnly() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const { startPage } = useSettings()

  if (isAuthenticated) return <Navigate to={startPage} replace />
  return <Outlet />
}

export default GuestOnly
