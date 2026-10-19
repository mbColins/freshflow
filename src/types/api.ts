// Envelope the backend wraps every response in.
// `isSuccess` is not reliable (it comes back false on success); use the HTTP status.
export type ApiResponse<T> = {
  message: string
  content: T
  timestamp: string
  status: number
  isSuccess: boolean
}
