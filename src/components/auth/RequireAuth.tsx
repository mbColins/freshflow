import { Navigate, Outlet, useLocation } from 'react-router'
import { useAppSelector } from '../../store/hooks'
import { selectIsAuthenticated } from '../../store/slices/authSlice'

// Wraps every page that needs a signed-in session. Remembers where the user
// was going so LoginForm can send them back after signing in.
function RequireAuth() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const location = useLocation()

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    )
  }
  return <Outlet />
}

export default RequireAuth
