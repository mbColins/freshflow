import { useState } from 'react'
import { dangerButton, fieldClass, labelClass, secondaryButton } from './styles'
import Modal from '../ui/Modal'

type CancelOrderDialogProps = {
  orders: string[]
  // Rejects with an Error whose message says why the server refused
  onConfirm: (reason: string) => Promise<void>
  onClose: () => void
}

// Cancelling needs a reason, which the server keeps with the order
function CancelOrderDialog({ orders, onConfirm, onClose }: CancelOrderDialogProps) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <Modal
      open
      onClose={onClose}
      variant="sm"
      title={orders.length === 1 ? `Cancel order #${orders[0]}?` : `Cancel ${orders.length} orders?`}
      subtitle="Cancelled orders leave the pipeline. Money already paid stays recorded and has to be refunded from Payments."
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Keep {orders.length === 1 ? 'Order' : 'Orders'}
          </button>
          <button
            type="button"
            disabled={!reason.trim() || saving}
            onClick={async () => {
              setSaving(true)
              setError(null)
              try {
                await onConfirm(reason.trim())
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : 'The cancellation wasn’t saved.')
              } finally {
                setSaving(false)
              }
            }}
            className={dangerButton}
          >
            {saving ? 'Cancelling…' : orders.length === 1 ? 'Cancel Order' : 'Cancel Orders'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 p-3 text-xs font-semibold text-danger">
            {error}
          </p>
        )}
        <div>
          <label htmlFor="cancel-reason" className={labelClass}>
            Reason (required)
          </label>
          <textarea
            id="cancel-reason"
            rows={3}
            autoFocus
            placeholder="e.g. Customer changed their mind"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className={`${fieldClass} h-auto py-2`}
          />
        </div>
      </div>
    </Modal>
  )
}

export default CancelOrderDialog
