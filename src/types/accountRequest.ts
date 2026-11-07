// A business asking for a workspace from the public website (GET /account-requests)
export type AccountRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export type AccountRequest = {
  uuid: string
  // Shown to the applicant, e.g. FF-7K2M9QXA
  reference: string
  status: AccountRequestStatus

  legalName: string
  registrationId: string
  industry: string | null
  country: string | null
  address: string
  website: string | null
  establishedYear: number | null
  branchCount: number | null

  adminName: string
  adminTitle: string | null
  adminEmail: string
  adminPhone: string
  // EMAIL, SMS, WHATSAPP, PHONE
  channels: string[]

  userCount: number | null
  monthlyBags: number | null
  currentStack: string | null
  painPoints: string | null
  modules: string[]
  // Plan code the applicant looked at on the pricing page; only a hint
  preferredPlan: string | null

  termsAcceptedAt: string | null
  submittedFromIp: string | null

  reviewedBy: string | null
  reviewedAt: string | null
  rejectionReason: string | null
  // Set on approval
  tenantUuid: string | null

  createdAt: string
  updatedAt: string | null
}

export type AccountRequestFilters = {
  status: AccountRequestStatus | ''
  search: string
}
