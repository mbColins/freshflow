import { configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import { api } from '../services/api'
import authReducer, { logout, TOKEN_STORAGE_KEY } from './slices/authSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    [api.reducerPath]: api.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(api.middleware),
})

// Refetch on window focus / reconnect for queries that opt in
setupListeners(store.dispatch)

// Signing out in one tab signs out every other tab of a remembered session
// (sessionStorage is per tab, so it raises no event)
window.addEventListener('storage', (event) => {
  if (event.key === TOKEN_STORAGE_KEY && event.newValue === null) {
    if (store.getState().auth.token !== null) {
      store.dispatch(logout())
      store.dispatch(api.util.resetApiState())
    }
  }
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
