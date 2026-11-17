import { Navigate, Outlet } from 'react-router'
import useCurrentUser from '../../hooks/useCurrentUser'

// Wraps the pages of one permission menu. Typing the URL of a page the user
// can't open sends them to the dashboard, the same rule the sidebar uses to
// hide the link. This is only a convenience: the API must refuse the calls.
function RequireMenu({ menu }: { menu: string }) {
  const { canOpen, isLoading } = useCurrentUser()

  // Don't flash a page (or bounce the user) before the profile is known
  if (isLoading) return null
  if (!canOpen(menu)) return <Navigate to="/" replace />
  return <Outlet />
}

export default RequireMenu
