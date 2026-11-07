// A visitor asking for a guided demo from the public website (GET /demo-requests)
export type DemoRequestStatus = 'NEW' | 'CONTACTED' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'

// independent, multi-branch, commercial, hotels, industrial or other
export type DemoBusinessType = string

export type DemoWindow = 'ANY' | 'MORNING' | 'AFTERNOON'

export type DemoRequest = {
  uuid: string
  // Shown to the visitor, e.g. DM-7K2M9QXA
  reference: string
  status: DemoRequestStatus

  name: string
  email: string
  phone: string | null
  company: string
  jobTitle: string | null

  businessType: DemoBusinessType
  branchCount: number | null
  message: string | null

  // yyyy-MM-dd
  preferredDate: string | null
  preferredWindow: DemoWindow
  // IANA zone of the visitor, e.g. Africa/Douala
  timezone: string | null

  consentAt: string | null
  submittedFromIp: string | null

  scheduledFor: string | null
  note: string | null
  handledBy: string | null
  statusChangedAt: string | null

  createdAt: string
  updatedAt: string | null
}

export type DemoRequestFilters = {
  status: DemoRequestStatus | ''
  search: string
}
