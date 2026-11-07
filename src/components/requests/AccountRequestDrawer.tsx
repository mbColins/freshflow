import { Check, X } from 'lucide-react'
import { ACCOUNT_REQUEST_STATUSES, CHANNEL_LABELS } from '../../constants/requests'
import { useGetAccountRequestQuery } from '../../services/accountRequestApi'
import type { AccountRequest } from '../../types/accountRequest'
import { formatDateTime } from '../../utils/requests'
import { primaryButton, secondaryButton } from '../orders/styles'
import Badge from '../ui/Badge'
import { DetailBox, DrawerSection } from '../ui/Details'
import Modal from '../ui/Modal'

const number = (value: number | null) => (value === null ? null : value.toLocaleString('en-US'))

// Everything the applicant submitted, plus the decision once there is one
function AccountRequestDrawer({
  request: summary,
  onClose,
  onApprove,
  onReject,
}: {
  request: AccountRequest
  onClose: () => void
  onApprove: () => void
  onReject: () => void
}) {
  // The list row shows instantly; the full record replaces it once fetched
  const { data } = useGetAccountRequestQuery(summary.uuid)
  const request = data ?? summary
  const status = ACCOUNT_REQUEST_STATUSES[request.status]
  const pending = request.status === 'PENDING'

  return (
    <Modal
      open
      onClose={onClose}
      variant="drawer"
      title={request.legalName}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono">{request.reference}</span>
          <Badge tone={status.tone}>{status.label}</Badge>
        </span>
      }
      footer={
        pending ? (
          <>
            <button type="button" onClick={onReject} className={secondaryButton}>
              <X className="size-4" aria-hidden="true" />
              Reject
            </button>
            <button type="button" onClick={onApprove} className={primaryButton}>
              <Check className="size-4" aria-hidden="true" />
              Approve
            </button>
          </>
        ) : undefined
      }
    >
      <div className="space-y-5">
        {!pending && (
          <DrawerSection title="Decision">
            <DetailBox
              rows={[
                ['Decision', status.label],
                ['By', request.reviewedBy],
                ['On', formatDateTime(request.reviewedAt)],
                ['Tenant', request.tenantUuid ? <span className="font-mono text-[11px]">{request.tenantUuid}</span> : null],
                ...(request.rejectionReason ? ([['Reason', request.rejectionReason]] as [string, string][]) : []),
              ]}
            />
          </DrawerSection>
        )}

        <DrawerSection title="Business">
          <DetailBox
            rows={[
              ['Legal name', request.legalName],
              ['Registration ID', request.registrationId],
              ['Industry', request.industry],
              ['Country / region', request.country],
              ['Address', request.address],
              ['Website', request.website],
              ['Established', request.establishedYear],
              ['Branches', request.branchCount],
            ]}
          />
        </DrawerSection>

        <DrawerSection title="Proposed administrator">
          <DetailBox
            rows={[
              ['Name', request.adminName],
              ['Title', request.adminTitle],
              ['Email', request.adminEmail],
              ['Phone', request.adminPhone],
              ['Preferred channels', request.channels.map((c) => CHANNEL_LABELS[c] ?? c).join(', ')],
            ]}
          />
        </DrawerSection>

        <DrawerSection title="Scope">
          <DetailBox
            rows={[
              ['Operator licenses', number(request.userCount)],
              ['Monthly bags', number(request.monthlyBags)],
              ['Preferred plan', request.preferredPlan],
              ['Current tools', request.currentStack],
              ['Pain points', request.painPoints],
              ['Modules', request.modules.join(', ')],
            ]}
          />
        </DrawerSection>

        <DrawerSection title="Submission">
          <DetailBox
            rows={[
              ['Submitted', formatDateTime(request.createdAt)],
              ['Terms accepted', formatDateTime(request.termsAcceptedAt)],
              ['From IP', request.submittedFromIp],
            ]}
          />
        </DrawerSection>
      </div>
    </Modal>
  )
}

export default AccountRequestDrawer
