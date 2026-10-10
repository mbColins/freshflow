import type { OrderFilters } from '../../types/order'
import Modal from '../ui/Modal'
import FilterSelect from './OrderFilterFields'
import {
  fieldClass,
  labelClass,
  primaryButton,
  secondaryButton,
  sectionTitle,
} from './styles'

type MoreFiltersDialogProps = {
  open: boolean
  onClose: () => void
  filters: OrderFilters
  onChange: (patch: Partial<OrderFilters>) => void
  onReset: () => void
  showFinancials: boolean
  resultCount: number
}

function MoreFiltersDialog({
  open,
  onClose,
  filters,
  onChange,
  onReset,
  showFinancials,
  resultCount,
}: MoreFiltersDialogProps) {
  const select = (name: Parameters<typeof FilterSelect>[0]['name']) => (
    <FilterSelect name={name} filters={filters} onChange={onChange} />
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Filters"
      subtitle="Filters combine: an order must match all of them."
      footer={
        <>
          <button type="button" onClick={onReset} className={secondaryButton}>
            Reset Filters
          </button>
          <button type="button" onClick={onClose} className={primaryButton}>
            Show {resultCount} {resultCount === 1 ? 'order' : 'orders'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <section>
          <h3 className={sectionTitle}>Order</h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {select('status')}
            {select('due')}
            {select('priority')}
          </div>
        </section>

        <section>
          <h3 className={sectionTitle}>Customer</h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {select('customerType')}
          </div>
        </section>

        {showFinancials && (
          <section>
            <h3 className={sectionTitle}>Financial</h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {select('payment')}
              <div>
                <label htmlFor="filter-min-amount" className="sr-only">
                  Minimum amount (XAF)
                </label>
                <input
                  id="filter-min-amount"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  placeholder="Min amount (XAF)"
                  value={filters.minAmount}
                  onChange={(event) =>
                    onChange({ minAmount: event.target.value })
                  }
                  className={fieldClass}
                />
              </div>
              <div>
                <label htmlFor="filter-max-amount" className="sr-only">
                  Maximum amount (XAF)
                </label>
                <input
                  id="filter-max-amount"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  placeholder="Max amount (XAF)"
                  value={filters.maxAmount}
                  onChange={(event) =>
                    onChange({ maxAmount: event.target.value })
                  }
                  className={fieldClass}
                />
              </div>
            </div>
          </section>
        )}

        <section>
          <h3 className={sectionTitle}>Operations</h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {select('service')}
            {select('staff')}
          </div>
        </section>

        <section>
          <h3 className={sectionTitle}>Logistics & branch</h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {select('method')}
            {select('branch')}
          </div>
        </section>

        <p className={`${labelClass} font-normal text-muted`}>
          Not available yet: machine, driver, counter and date-created filters
          need data the sample orders don’t carry.
        </p>
      </div>
    </Modal>
  )
}

export default MoreFiltersDialog
