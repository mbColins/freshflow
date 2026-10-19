export type OtpRole = 'FIRST_LOGIN' | 'FORGOT_PASSWORD'

// Role returned by OTP validation when the user must set a password next
export const SET_PASSWORD_ROLE = 'Set_Pass_word'

// A code the user has to enter, sent by login or forgot password
export type OtpVerification = {
  role: OtpRole
  uuid: string
  // Masked, e.g. me***@gmail.com
  email: string
}

// Token fields shared by the login and refresh responses
export type AuthTokens = {
  access_token: string
  refresh_token: string
  // Milliseconds
  expires_in: number
  // PRE_AUTH until the OTP is validated
  token_type: string | null
}

// POST /auth/login (LoginRequest on the backend)
export type LoginRequest = {
  username: string
  password: string
}

export type LoginResponse = AuthTokens & {
  step: { step: string }
  lastLoginTime: string
  // Present when the user must enter a code before getting a full session
  verification: OtpVerification | null
}

// TODO: confirm the shape with the backend; assumed to match login
export type RefreshResponse = AuthTokens

export type ValidateOtpRequest = {
  // verification.uuid from the login or forgot-password response
  uuid: string
  otp: string
  otpRole: OtpRole
}

// Steps the backend reports after login and OTP validation
export const STEP_SIGNED_IN = 'STEP_TWO'
export const STEP_SET_PASSWORD = 'STEP_THREE'

// Flat content of POST /otp/validate_otp/{uuid}
export type ValidateOtpResponse = AuthTokens & {
  // STEP_SIGNED_IN: the tokens are the session. STEP_SET_PASSWORD: the user
  // must set a password first, using `uuid` and `access_token`
  step: { step: string }
  // The user's uuid (not the one the code was sent with)
  uuid: string
  // Masked, e.g. me***@gmail.com
  email: string
  // SET_PASSWORD_ROLE, only on STEP_SET_PASSWORD
  role?: string
  isValidOtp: boolean
  // Only on STEP_SIGNED_IN
  message?: string
}

export function needsNewPassword(response: ValidateOtpResponse) {
  return (
    response.step?.step === STEP_SET_PASSWORD ||
    response.role === SET_PASSWORD_ROLE
  )
}

// POST /auth/forgot_password (ForgotPasswordRequest on the backend)
export type ForgotPasswordRequest = {
  email: string
}

// The code to enter next; role is FORGOT_PASSWORD
export type ForgotPasswordResponse = OtpVerification

// First login: POST /auth/set_password/{uuid} (ResetPasswordDto on the backend).
// The backend checks that the token's user matches the uuid.
export type SetPasswordRequest = {
  // The user's uuid from the OTP validation response; sent in the URL
  uuid: string
  // access_token from the OTP validation response
  token?: string
  newPassword: string
}

// Forgot password: POST /auth/reset_password/{uuid} (ForgotPasswordResetDto).
// The code is checked and used up here, together with the new password, so
// it must NOT be validated through /otp/validate_otp first.
export type ResetPasswordRequest = {
  // The code's uuid from the forgot-password response; sent in the URL
  uuid: string
  otp: string
  newPassword: string
}
