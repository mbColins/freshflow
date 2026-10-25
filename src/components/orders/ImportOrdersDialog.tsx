import { useState } from 'react'
import { useGetBranchDropdownQuery } from '../../services/branchApi'
import { useImportOrdersMutation } from '../../services/orderApi'
import type { OrderImportResult } from '../../services/orderApi'
import { describeError } from '../../utils/apiReasons'
import { fieldClass, labelClass, primaryButton, secondaryButton } from './styles'
import Modal from '../ui/Modal'

const HEADER = 'customerPhone,customerName,service,quantity,unitPrice,promisedDate,notes'

// One order per CSV row. The file is checked as a whole: one bad row and
// nothing is created
function ImportOrdersDialog({ onClose, onDone }: { onClose: () => void; onDone: (created: number) => void }) {
  const branchList = useGetBranchDropdownQuery()
  const branches = branchList.data ?? []
  const [branch, setBranch] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<OrderImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [importOrders, { isLoading }] = useImportOrdersMutation()
  const branchId = branch || branches[0]?.uuid || ''

  async function handleImport() {
    if (!file || !branchId) return
    setError(null)
    setResult(null)
    try {
      const outcome = await importOrders({ file, branch: branchId }).unwrap()
      if (outcome.errors.length === 0) onDone(outcome.created)
      else setResult(outcome)
    } catch (caught) {
      setError(describeError(caught, 'The file wasn’t imported.'))
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      variant="sm"
      title="Import Orders"
      subtitle="A CSV file with one order per row, up to 1000 rows."
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="button" disabled={!file || !branchId || isLoading} onClick={() => void handleImport()} className={primaryButton}>
            {isLoading ? 'Importing…' : 'Import'}
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
        <p className="rounded-lg bg-field p-3 font-mono text-[11px] break-all text-ink">{HEADER}</p>
        <p className="text-[11px] text-muted">
          <span className="font-semibold">promisedDate</span> is yyyy-MM-dd or yyyy-MM-ddTHH:mm. A phone number no customer has yet creates the customer.
        </p>
        <div>
          <label htmlFor="import-branch" className={labelClass}>
            Branch
          </label>
          <select id="import-branch" value={branchId} onChange={(event) => setBranch(event.target.value)} className={fieldClass}>
            {branches.map(({ uuid, name }) => (
              <option key={uuid} value={uuid}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="import-file" className={labelClass}>
            CSV file
          </label>
          <input
            id="import-file"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null)
              setResult(null)
            }}
            className="block w-full text-xs text-ink file:mr-3 file:h-9 file:rounded-md file:border-0 file:bg-field file:px-3 file:text-xs file:font-semibold"
          />
        </div>
        {result && (
          <div role="alert" className="rounded-lg bg-danger/10 p-3 text-xs text-danger">
            <p className="font-semibold">Nothing was imported. Fix these rows and try again:</p>
            <ul className="mt-1 max-h-40 list-disc space-y-0.5 overflow-y-auto pl-4">
              {result.errors.map(({ row, message }) => (
                <li key={row + message}>
                  Row {row}: {message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default ImportOrdersDialog
