import { Fragment } from 'react'
import { PIPELINE_STATUSES } from '../../constants/orders'
import type { Order, OrderStatus } from '../../types/order'

type OrderPipelineProps = {
  orders: Order[]
  selected: OrderStatus | ''
  onSelect: (status: OrderStatus | '') => void
}

const stageClass =
  'flex shrink-0 flex-col rounded-lg px-3 py-2 text-left transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none'

function OrderPipeline({ orders, selected, onSelect }: OrderPipelineProps) {
  const active = orders.filter(({ status }) => status !== 'cancelled')

  return (
    <nav
      aria-label="Order status pipeline"
      className="flex items-center overflow-x-auto rounded-xl bg-white p-2 ring-1 ring-line"
    >
      <button
        type="button"
        aria-pressed={selected === ''}
        onClick={() => onSelect('')}
        className={`${stageClass} ${selected === '' ? 'bg-brand text-white' : 'bg-field text-ink hover:bg-brand/10'}`}
      >
        <span className="text-[9px] font-bold tracking-wider uppercase opacity-80">
          All
        </span>
        <span className="text-base font-bold">{active.length}</span>
      </button>

      {PIPELINE_STATUSES.map(({ id, label, color }) => {
        const isSelected = selected === id
        return (
          <Fragment key={id}>
            <span
              className="h-px w-4 shrink-0 bg-line sm:w-6 xl:flex-1"
              aria-hidden="true"
            />
            <button
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(isSelected ? '' : id)}
              className={`${stageClass} ${isSelected ? 'bg-brand/5 ring-2 ring-brand' : 'bg-field hover:bg-brand/10'}`}
            >
              <span className="flex items-center gap-1.5 text-[9px] font-bold tracking-wider whitespace-nowrap text-muted uppercase">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: color }}
                />
                {label}
              </span>
              <span className="text-base font-bold text-ink">
                {orders.filter(({ status }) => status === id).length}
              </span>
            </button>
          </Fragment>
        )
      })}
    </nav>
  )
}

export default OrderPipeline
