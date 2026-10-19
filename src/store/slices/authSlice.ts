import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import type { OtpVerification } from '../../types/auth'
import { isTokenExpired } from '../../utils/jwt'

export const TOKEN_STORAGE_KEY = 'freshflow.token'
const REFRESH_TOKEN_STORAGE_KEY = 'freshflow.refreshToken'

// A PRE_AUTH token only allows OTP verification; it is not a signed-in session
export const PRE_AUTH = 'PRE_AUTH'

// The code the user has to enter after login or forgot password
export type PendingVerification = OtpVerification & {
  // How long a code stays valid, in ms
  expiresIn: number
  // Epoch ms when the current code stops being valid
  expiresAt: number
  // Issued by OTP validation when the user must set a password next
  resetUuid?: string
  // Bearer token for the set-password call. Kept here, not as the session,
  // so the user isn't treated as signed in before the password is set
  resetToken?: string
  // Forgot password: the code the user typed, sent with the new password
  resetCode?: string
}

type AuthState = {
  token: string | null
  refreshToken: string | null
  tokenType: string | null
  // "Remember this workstation": keep the session after the browser closes
  remember: boolean
  verification: PendingVerification | null
}

function storages() {
  try {
    return { local: window.localStorage, session: window.sessionStorage }
  } catch {
    // Storage can be blocked (private mode); the session lasts until reload
    return null
  }
}

// A remembered session lives in localStorage; otherwise in sessionStorage,
// which the browser clears when the tab or window closes
function loadSession() {
  const store = storages()
  const local = store?.local.getItem(TOKEN_STORAGE_KEY)
  const session = store?.session.getItem(TOKEN_STORAGE_KEY)
  const remember = Boolean(local)
  const area = remember ? store?.local : store?.session
  const token = local ?? session ?? null
  const refreshToken = area?.getItem(REFRESH_TOKEN_STORAGE_KEY) ?? null
  return { token, refreshToken, remember }
}

function saveSession(
  token: string | null,
  refreshToken: string | null,
  remember: boolean,
) {
  const store = storages()
  if (!store) return
  try {
    for (const area of [store.local, store.session]) {
      area.removeItem(TOKEN_STORAGE_KEY)
      area.removeItem(REFRESH_TOKEN_STORAGE_KEY)
    }
    if (!token) return
    const area = remember ? store.local : store.session
    area.setItem(TOKEN_STORAGE_KEY, token)
    if (refreshToken) area.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken)
  } catch {
    // Quota or blocked storage; the session still works until reload
  }
}

const initialState: AuthState = {
  ...loadSession(),
  tokenType: null,
  verification: null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(
      state,
      action: PayloadAction<{
        token: string
        refreshToken: string | null
        tokenType: string | null
        // Omitted on refresh, which keeps the current choice
        remember?: boolean
      }>,
    ) {
      const { token, refreshToken, tokenType, remember } = action.payload
      state.token = token
      state.refreshToken = refreshToken
      state.tokenType = tokenType
      if (remember !== undefined) state.remember = remember
      // Pre-auth tokens are short-lived, so they are kept in memory only
      if (tokenType === PRE_AUTH) saveSession(null, null, false)
      else saveSession(token, refreshToken, state.remember)
    },
    setVerification(state, action: PayloadAction<PendingVerification | null>) {
      state.verification = action.payload
    },
    setPasswordReset(
      state,
      action: PayloadAction<{ uuid: string; token?: string }>,
    ) {
      if (!state.verification) return
      state.verification.resetUuid = action.payload.uuid
      state.verification.resetToken = action.payload.token
    },
    // Forgot password: keep the typed code for the reset call
    setResetCode(state, action: PayloadAction<string>) {
      if (state.verification) state.verification.resetCode = action.payload
    },
    // After a new code is sent
    restartVerification(state, action: PayloadAction<number>) {
      if (state.verification) {
        state.verification.expiresAt =
          action.payload + state.verification.expiresIn
      }
    },
    logout(state) {
      state.token = null
      state.refreshToken = null
      state.tokenType = null
      state.remember = false
      state.verification = null
      saveSession(null, null, false)
    },
  },
  selectors: {
    selectToken: (state) => state.token,
    selectRefreshToken: (state) => state.refreshToken,
    selectRemember: (state) => state.remember,
    // An expired access token still counts while a refresh token can renew it;
    // the API layer refreshes on the first 401
    selectIsAuthenticated: (state) =>
      state.token !== null &&
      state.tokenType !== PRE_AUTH &&
      (state.refreshToken !== null || !isTokenExpired(state.token)),
    selectVerification: (state) => state.verification,
  },
})

export const {
  setCredentials,
  setVerification,
  setPasswordReset,
  setResetCode,
  restartVerification,
  logout,
} = authSlice.actions
export const {
  selectToken,
  selectRefreshToken,
  selectRemember,
  selectIsAuthenticated,
  selectVerification,
} = authSlice.selectors
export default authSlice.reducer
