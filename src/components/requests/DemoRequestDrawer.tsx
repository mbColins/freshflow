import { DEMO_ACTION_LABELS, DEMO_BUSINESS_TYPES, DEMO_NEXT_STATUSES, DEMO_REQUEST_STATUSES, DEMO_WINDOWS } from '../../constants/requests'
import { useGetDemoRequestQuery } from '../../services/demoRequestApi'
import type { DemoRequest, DemoRequestStatus } from '../../types/demoRequest'
import { formatDateTime, formatPlainDate } from '../../utils/requests'
import { primaryButton, secondaryButton } from '../orders/styles'
import Badge from '../ui/Badge'
import { DetailBox, DrawerSection } from '../ui/Details'
import Modal from '../ui/Modal'

// Everything the visitor asked for, and the moves the request can make from here
function DemoRequestDrawer({
  request: summary,
  onClose,
  onMove,
}: {
  request: DemoRequest
  onClose: () => void
  onMove: (status: DemoRequestStatus) => void
}) {
  // The list row shows instantly; the full record replaces it once fetched
  const { data } = useGetDemoRequestQuery(summary.uuid)
  const request = data ?? summary
  const status = DEMO_REQUEST_STATUSES[request.status]
  const moves = DEMO_NEXT_STATUSES[request.status]

  return (
    <Modal
      open
      onClose={onClose}
      variant="drawer"
      title={request.company}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono">{request.reference}</span>
          <Badge tone={status.tone}>{status.label}</Badge>
        </span>
      }
      footer={
        moves.length > 0 ? (
          <>
            {moves.map((move, index) => (
              <button
                key={move}
                type="button"
                onClick={() => onMove(move)}
                className={index === moves.length - 1 && move !== 'CANCELLED' ? primaryButton : secondaryButton}
              >
                {DEMO_ACTION_LABELS[move]}
              </button>
            ))}
          </>
        ) : undefined
      }
    >
      <div className="space-y-5">
        <DrawerSection title="Follow-up">
          <DetailBox
            rows={[
              ['Status', status.label],
              ['Scheduled for', formatDateTime(request.scheduledFor)],
              ['Handled by', request.handledBy],
              ['Last change', formatDateTime(request.statusChangedAt)],
              ['Note', request.note],
            ]}
          />
        </DrawerSection>

        <DrawerSection title="Contact">
          <DetailBox
            rows={[
              ['Name', request.name],
              ['Role', request.jobTitle],
              ['Email', request.email],
              ['Phone', request.phone],
            ]}
          />
        </DrawerSection>

        <DrawerSection title="Business">
          <DetailBox
            rows={[
              ['Company', request.company],
              ['Type', DEMO_BUSINESS_TYPES[request.businessType] ?? request.businessType],
              ['Branches', request.branchCount],
              ['What they want to see', request.message],
            ]}
          />
        </DrawerSection>

        <DrawerSection title="When they would like it">
          <DetailBox
            rows={[
              ['Preferred date', formatPlainDate(request.preferredDate)],
              ['Time of day', DEMO_WINDOWS[request.preferredWindow] ?? request.preferredWindow],
              ['Their time zone', request.timezone],
            ]}
          />
        </DrawerSection>

        <DrawerSection title="Submission">
          <DetailBox
            rows={[
              ['Submitted', formatDateTime(request.createdAt)],
              ['Consent given', formatDateTime(request.consentAt)],
              ['From IP', request.submittedFromIp],
            ]}
          />
        </DrawerSection>
      </div>
    </Modal>
  )
}

export default DemoRequestDrawer
