// A notification addressed to the signed-in user, shown under the bell
export type InAppNotification = {
  // The uuid the API addresses it by
  id: string
  title: string
  message: string
  // Backend InAppNotificationType, e.g. SUBSCRIPTION_EXPIRED; kept as text so
  // new types still show
  type: string
  read: boolean
  readAt: string
  createdAt: string
}
