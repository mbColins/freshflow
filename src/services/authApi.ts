import {
  logout,
  restartVerification,
  setCredentials,
  setPasswordReset,
  setVerification,
} from '../store/slices/authSlice'
import type { RootState } from '../store'
import type { ApiResponse } from '../types/api'
import { needsNewPassword } from '../types/auth'
import type {
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  LoginRequest,
  LoginResponse,
  OtpVerification,
  ResetPasswordRequest,
  SetPasswordRequest,
  ValidateOtpRequest,
  ValidateOtpResponse,
} from '../types/auth'
import { api } from './api'

// Forgot password doesn't say how long its code is valid; assumed to match
// the 10 minutes login reports
// TODO: confirm with the backend
const DEFAULT_OTP_TTL_MS = 30_000

function pendingVerification(verification: OtpVerification, expiresIn: number) {
  return { ...verification, expiresIn, expiresAt: Date.now() + expiresIn }
}

// For endpoints whose response isn't confirmed: they may answer with an empty
// body or plain text instead of the usual envelope, which must not count as
// a failure
function contentOf<T>(response: unknown): T | undefined {
  return response !== null &&
    typeof response === 'object' &&
    'content' in response
    ? (response as ApiResponse<T>).content
    : undefined
}

// TODO: confirm with the backend that every /auth call below is a POST
export const authApi = api.injectEndpoints({
  endpoints: (build) => ({
    // `remember` stays in the app; only the credentials go to the API
    login: build.mutation<LoginResponse, LoginRequest & { remember: boolean }>({
      query: ({ username, password }) => ({
        url: '/auth/login',
        method: 'POST',
        body: { username, password },
      }),
      transformResponse: (response: ApiResponse<LoginResponse>) =>
        response.content,
      async onQueryStarted({ remember }, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(
            setCredentials({
              token: data.access_token,
              refreshToken: data.refresh_token,
              tokenType: data.token_type,
              remember,
            }),
          )
          dispatch(
            setVerification(
              data.verification &&
                pendingVerification(data.verification, data.expires_in),
            ),
          )
        } catch {
          // The component reads the error from the mutation result
        }
      },
    }),
    // POST /auth/logout/{refresh_token}
    logout: build.mutation<void, void>({
      queryFn: async (_arg, { getState }, _extra, baseQuery) => {
        const { refreshToken } = (getState() as RootState).auth
        if (!refreshToken) return { data: undefined }
        const result = await baseQuery({
          url: `/auth/logout/${encodeURIComponent(refreshToken)}`,
          method: 'POST',
        })
        return result.error ? { error: result.error } : { data: undefined }
      },
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled
        } catch {
          // Sign out locally even if the server call fails
        } finally {
          dispatch(logout())
          dispatch(api.util.resetApiState())
        }
      },
    }),
    // POST /otp/validate_otp/{uuid}
    // The form clears the pending verification once it no longer needs it
    validateOtp: build.mutation<ValidateOtpResponse, ValidateOtpRequest>({
      query: ({ uuid, ...body }) => ({
        url: `/otp/validate_otp/${encodeURIComponent(uuid)}`,
        method: 'POST',
        body,
      }),
      transformResponse: (response: ApiResponse<ValidateOtpResponse>) =>
        response.content,
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          if (needsNewPassword(data)) {
            // The set-password call needs the user's uuid and this token
            dispatch(
              setPasswordReset({ uuid: data.uuid, token: data.access_token }),
            )
          } else if (data.access_token) {
            // Replace the PRE_AUTH token with the full session
            dispatch(
              setCredentials({
                token: data.access_token,
                refreshToken: data.refresh_token,
                tokenType: data.token_type,
              }),
            )
          }
        } catch {
          // The component reads the error from the mutation result
        }
      },
    }),
    // POST /otp/resend_otp/{uuid}
    // TODO: confirm the /otp prefix and method with the backend
    resendOtp: build.mutation<unknown, string>({
      query: (uuid) => ({
        url: `/otp/resend_otp/${encodeURIComponent(uuid)}`,
        method: 'POST',
        responseHandler: 'content-type',
      }),
      transformResponse: (response: unknown) => contentOf(response),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled
          dispatch(restartVerification(Date.now()))
        } catch {
          // The component reads the error from the mutation result
        }
      },
    }),
    // POST /auth/forgot_password
    forgotPassword: build.mutation<
      ForgotPasswordResponse,
      ForgotPasswordRequest
    >({
      query: (body) => ({ url: '/auth/forgot_password', method: 'POST', body }),
      transformResponse: (response: ApiResponse<ForgotPasswordResponse>) =>
        response.content,
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          // The response has no expiry, so the countdown uses the default
          dispatch(
            setVerification(pendingVerification(data, DEFAULT_OTP_TTL_MS)),
          )
        } catch {
          // The component reads the error from the mutation result
        }
      },
    }),
    // First login: POST /auth/set_password/{userUuid} with the token from OTP validation
    setPassword: build.mutation<unknown, SetPasswordRequest>({
      query: ({ uuid, token, ...body }) => ({
        url: `/auth/set_password/${encodeURIComponent(uuid)}`,
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body,
        responseHandler: 'content-type',
      }),
      transformResponse: (response: unknown) => contentOf(response),
    }),
    // Forgot password: POST /auth/reset_password/{otpUuid} with { otp, newPassword }
    resetPassword: build.mutation<unknown, ResetPasswordRequest>({
      query: ({ uuid, ...body }) => ({
        url: `/auth/reset_password/${encodeURIComponent(uuid)}`,
        method: 'POST',
        body,
        responseHandler: 'content-type',
      }),
      transformResponse: (response: unknown) => contentOf(response),
    }),
  }),
})

export const {
  useLoginMutation,
  useLogoutMutation,
  useValidateOtpMutation,
  useResendOtpMutation,
  useForgotPasswordMutation,
  useSetPasswordMutation,
  useResetPasswordMutation,
} = authApi
