import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import {
  Building2,
  Gift,
  Lightbulb,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  Search,
  ShoppingCart,
  Star,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import {
  LAUNDRY_OPTIONS,
  LOYALTY_TIERS,
  REWARDS,
} from '../../constants/customers'
import type { CustomerPermissions } from '../../constants/customers'
import { MESSAGE_TEMPLATES } from '../../constants/orders'
import useCustomerOrders from '../../hooks/useCustomerOrders'
import {
  useDeleteCustomerNoteMutation,
  useGetCustomerActivityQuery,
  useGetLoyaltyLedgerQuery,
  useListCommunicationsQuery,
  useLogCommunicationMutation,
  useSendCustomerMessageMutation,
} from '../../services/customerApi'
import type { MessageChannel } from '../../services/customerApi'
import type { Address, Consent, CrmCustomer } from '../../types/customer'
import type { FulfilmentMethod } from '../../types/order'
import {
  daysSince,
  formatDate,
  getAverageOrder,
  getHealth,
  getInsights,
  getTier,
} from '../../utils/customers'
import {
  formatWhen,
  formatXaf,
  getItemCount,
  getPrimaryService,
  getTotal,
} from '../../utils/orders'
import { whatsappHref } from '../../utils/contact'
import { NETWORK_ERROR_MESSAGE, errorMessage, serverMessage } from '../../utils/apiErrors'
import { PaymentBadge, StatusBadge } from '../orders/OrderBadges'
import {
  fieldClass,
  iconButton,
  labelClass,
  primaryButton,
  secondaryButton,
} from '../orders/styles'
import Badge from '../ui/Badge'
import CustomerActivityChart from './CustomerActivityChart'
import { HealthBadge, TierBadge } from './CustomerBits'
import { PanelEmpty } from '../ui/Panel'
import { DetailGrid } from '../ui/Details'

type Change = (change: (customer: CrmCustomer) => CrmCustomer) => void

export type TabProps = {
  customer: CrmCustomer
  now: number
  permissions: CustomerPermissions
  canCreateOrder: boolean
  onChange: Change
  onRecordPayment: () => void
  onAddNote: () => void
  onEditAddress: (address?: Address) => void
  onAdjustPoints: () => void
}

function Panel({
  title,
  action,
  children,
  className = '',
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`min-w-0 rounded-xl bg-white p-4 ring-1 ring-line ${className}`}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-ink">{title}</h2>
        {action}
      </header>
      <div className="mt-3">{children}</div>
    </section>
  )
}

const linkButton = `${secondaryButton} h-8`
const textLink =
  'rounded-sm text-[11px] font-semibold text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none'

function OutstandingBanner({
  customer,
  onRecordPayment,
}: Pick<TabProps, 'customer' | 'onRecordPayment'>) {
  if (customer.outstanding <= 0) return null
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-danger/5 p-4 ring-1 ring-danger/20">
      <TriangleAlert className="size-5 shrink-0 text-danger" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold tracking-wider text-danger uppercase">
          Outstanding balance
        </p>
        <p className="text-lg font-bold text-ink">
          {formatXaf(customer.outstanding)}
        </p>
        <p className="text-[11px] text-muted">
          Orders affected: {customer.outstandingOrders}
        </p>
      </div>
      <button type="button" onClick={onRecordPayment} className={primaryButton}>
        Record Payment
      </button>
    </div>
  )
}

function RecentOrders({
  customer,
  now,
  showFinancials,
  limit,
  query = '',
}: {
  customer: CrmCustomer
  now: number
  showFinancials: boolean
  limit?: number
  query?: string
}) {
  const needle = query.trim().toLowerCase().replace(/^#/, '')
  const orders = useCustomerOrders(customer.id)
    .orders.filter(
      (order) =>
        !needle ||
        order.id.toLowerCase().includes(needle) ||
        order.items.some(({ service }) => service.toLowerCase().includes(needle)),
    )
    .slice(0, limit)

  if (orders.length === 0) return null
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[620px] text-left text-xs">
        <thead>
          <tr className="text-[9px] font-bold tracking-wider text-muted uppercase">
            <th scope="col" className="py-1.5 pr-3">Order ID</th>
            <th scope="col" className="py-1.5 pr-3">Date</th>
            <th scope="col" className="py-1.5 pr-3">Services</th>
            <th scope="col" className="py-1.5 pr-3">Items</th>
            {showFinancials && <th scope="col" className="py-1.5 pr-3 text-right">Amount</th>}
            {showFinancials && <th scope="col" className="py-1.5 pr-3">Payment</th>}
            <th scope="col" className="py-1.5 pr-3">Status</th>
            <th scope="col" className="py-1.5 pr-3">Delivery</th>
            <th scope="col" className="py-1.5 text-right">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-t border-line">
              <td className="py-2 pr-3 font-bold whitespace-nowrap text-brand">
                #{order.id}
              </td>
              <td className="py-2 pr-3 whitespace-nowrap">
                {formatWhen(order.createdAt, now)}
              </td>
              <td className="py-2 pr-3">{getPrimaryService(order)}</td>
              <td className="py-2 pr-3 whitespace-nowrap">
                {getItemCount(order)} items
              </td>
              {showFinancials && (
                <td className="py-2 pr-3 text-right font-semibold whitespace-nowrap tabular-nums">
                  {formatXaf(getTotal(order))}
                </td>
              )}
              {showFinancials && (
                <td className="py-2 pr-3">
                  <PaymentBadge order={order} />
                </td>
              )}
              <td className="py-2 pr-3">
                <StatusBadge order={order} />
              </td>
              <td className="py-2 pr-3 capitalize">{order.method}</td>
              <td className="py-2 text-right">
                <Link to={`/orders?order=${order.id}`} className={textLink}>
                  View Order
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function OverviewTab({
  customer,
  now,
  permissions,
  onRecordPayment,
  onAddNote,
}: TabProps) {
  const orderCount = useCustomerOrders(customer.id).orders.length
  const [deleteNote] = useDeleteCustomerNoteMutation()
  const health = getHealth(customer, now)
  const insights = getInsights(customer, now, permissions.financials)
  const tenureDays = daysSince(customer.registeredAt, now) ?? 0
  const lastYearSpend = customer.monthlySpend.reduce((sum, value) => sum + value, 0)
  const defaultAddress = customer.addresses.find(({ isDefault }) => isDefault)

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="min-w-0 space-y-4 lg:col-span-2">
        {permissions.financials && (
          <OutstandingBanner customer={customer} onRecordPayment={onRecordPayment} />
        )}

        <Panel title="Customer activity">
          <CustomerActivityChart
            monthlyOrders={customer.monthlyOrders}
            monthlySpend={customer.monthlySpend}
            now={now}
            showFinancials={permissions.financials}
          />
        </Panel>

        <Panel
          title="Recent orders"
          action={
            <span className="text-[11px] text-muted">
              {customer.orders} orders in total
            </span>
          }
        >
          {orderCount === 0 ? (
            <PanelEmpty>No recent orders to show.</PanelEmpty>
          ) : (
            <RecentOrders
              customer={customer}
              now={now}
              showFinancials={permissions.financials}
              limit={3}
            />
          )}
        </Panel>

        {customer.corporate && (
          <Panel
            title="Corporate account"
            action={
              <Badge tone="brand">
                <Building2 className="size-3" aria-hidden="true" />
                {customer.corporate.terms}
              </Badge>
            }
          >
            <DetailGrid
              rows={[
                ['Company name', customer.name],
                ['Contact person', customer.corporate.contact],
                ['Tax / business ID', customer.corporate.taxId],
                ['Billing address', customer.corporate.billingAddress],
                ['Contract', customer.corporate.contract],
                ['Services used', customer.preferredService],
                ...(permissions.financials
                  ? ([
                      ['Credit limit', formatXaf(customer.corporate.creditLimit)],
                      ['Outstanding balance', formatXaf(customer.outstanding)],
                    ] as [string, ReactNode][])
                  : []),
              ]}
            />
          </Panel>
        )}
      </div>

      <div className="min-w-0 space-y-4">
        <Panel title="Customer health" action={<HealthBadge health={health} />}>
          <p className="text-xs leading-relaxed text-muted">{health.detail}</p>
        </Panel>

        {insights.length > 0 && (
          <Panel title="Customer insights">
            <ul className="space-y-2">
              {insights.map((insight) => (
                <li key={insight} className="flex items-start gap-2 text-xs text-ink">
                  <Lightbulb
                    className="mt-px size-3.5 shrink-0 text-warning"
                    aria-hidden="true"
                  />
                  {insight}
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {permissions.financials && (
          <Panel title="Customer lifetime value">
            <p className="text-xl font-bold text-ink">{formatXaf(customer.spent)}</p>
            <p className="text-[11px] text-muted">
              Total revenue over the relationship
            </p>
            <div className="mt-3">
              <DetailGrid
                rows={[
                  ['Number of orders', customer.orders],
                  ['Average order value', formatXaf(getAverageOrder(customer))],
                  [
                    'Customer tenure',
                    tenureDays < 60
                      ? `${tenureDays} days`
                      : `${Math.round(tenureDays / 30)} months`,
                  ],
                  ['Est. next 12 months', formatXaf(lastYearSpend)],
                ]}
              />
            </div>
            <p className="mt-2 text-[10px] text-muted">
              Estimate assumes the last 12 months repeat.
            </p>
          </Panel>
        )}

        <Panel title="Laundry preferences">
          <DetailGrid
            rows={[
              ['Detergent', customer.laundry.detergent],
              ['Fabric softener', customer.laundry.softener],
              ['Folding', customer.laundry.folding],
              ['Packaging', customer.laundry.packaging],
              ['Ironing', customer.laundry.ironing ? 'Yes' : 'No'],
              ['Handover', customer.delivery.method === 'delivery' ? 'Delivery' : 'Customer pickup'],
            ]}
          />
          {customer.laundry.instructions && (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-warning/10 p-3 text-xs font-semibold text-warning">
              <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              {customer.laundry.instructions}
            </p>
          )}
          {defaultAddress && (
            <p className="mt-3 flex items-start gap-2 text-xs text-muted">
              <MapPin className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              <span>
                <span className="font-semibold text-ink">{defaultAddress.label}:</span>{' '}
                {defaultAddress.street}, {defaultAddress.city}
              </span>
            </p>
          )}
        </Panel>

        <Panel
          title="Customer notes"
          action={
            permissions.edit && (
              <button type="button" onClick={onAddNote} className={textLink}>
                + Add Note
              </button>
            )
          }
        >
          {customer.notes.length === 0 ? (
            <PanelEmpty>No notes yet.</PanelEmpty>
          ) : (
            <ul className="space-y-2">
              {customer.notes.map((note) => (
                <li key={note.id} className="flex items-start justify-between gap-2 rounded-lg bg-field p-3 text-xs text-ink">
                  <span>
                    “{note.text}”
                    <span className="mt-1 block text-[10px] text-muted">
                      {note.by} · {formatDate(note.at)}
                    </span>
                  </span>
                  {permissions.edit && (
                    <button
                      type="button"
                      onClick={() => void deleteNote({ id: customer.id, noteId: note.id })}
                      aria-label="Delete note"
                      className={`${iconButton} size-7 shrink-0`}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}

export function OrdersTab({ customer, now, permissions, canCreateOrder }: TabProps) {
  const [query, setQuery] = useState('')
  const { orders: customerOrders, isLoading: ordersLoading } = useCustomerOrders(customer.id)
  const sampleCount = customerOrders.length

  return (
    <Panel
      title="Order history"
      action={
        sampleCount > 0 && (
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Search this customer's orders"
              placeholder="Search order ID or service…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={`${fieldClass} h-8 w-56 pl-8`}
            />
          </div>
        )
      }
    >
      {ordersLoading ? (
        <div className="space-y-2" aria-busy="true">
          <p className="sr-only" role="status">Loading orders…</p>
          {[0, 1, 2].map((key) => (
            <div key={key} className="h-9 animate-pulse rounded-md bg-field" />
          ))}
        </div>
      ) : sampleCount === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg bg-field px-3 py-8 text-center">
          <p className="text-xs text-muted">This customer has not placed any orders yet.</p>
          {canCreateOrder && (
            <Link
              to={`/orders?new=1&customer=${customer.id}`}
              className={primaryButton}
            >
              <ShoppingCart className="size-4" aria-hidden="true" />
              Create Order
            </Link>
          )}
        </div>
      ) : (
        <>
          <RecentOrders
            customer={customer}
            now={now}
            showFinancials={permissions.financials}
            query={query}
          />
          <p className="mt-3 text-[11px] text-muted">
            {sampleCount} {sampleCount === 1 ? 'order' : 'orders'} on file for this customer.
          </p>
        </>
      )}
    </Panel>
  )
}

export function PaymentsTab({ customer, now, onRecordPayment }: TabProps) {
  const amounts = customer.payments.map(({ amount }) => amount)
  return (
    <div className="min-w-0 space-y-4">
      <OutstandingBanner customer={customer} onRecordPayment={onRecordPayment} />
      <Panel title="Spending">
        <DetailGrid
          rows={[
            ['Total spent', formatXaf(customer.spent)],
            ['Average order value', formatXaf(getAverageOrder(customer))],
            ['Highest payment on file', amounts.length ? formatXaf(Math.max(...amounts)) : '—'],
            ['Last payment', amounts.length ? formatXaf(amounts[0]) : '—'],
          ]}
        />
      </Panel>
      <Panel title="Payment history">
        {customer.payments.length === 0 ? (
          <PanelEmpty>No payments recorded yet.</PanelEmpty>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead>
                <tr className="text-[9px] font-bold tracking-wider text-muted uppercase">
                  <th scope="col" className="py-1.5 pr-3">Payment ID</th>
                  <th scope="col" className="py-1.5 pr-3">Date</th>
                  <th scope="col" className="py-1.5 pr-3">Order</th>
                  <th scope="col" className="py-1.5 pr-3 text-right">Amount</th>
                  <th scope="col" className="py-1.5 pr-3">Method</th>
                  <th scope="col" className="py-1.5 pr-3">Reference</th>
                  <th scope="col" className="py-1.5 pr-3">Status</th>
                  <th scope="col" className="py-1.5">Recorded by</th>
                </tr>
              </thead>
              <tbody>
                {customer.payments.map((payment) => (
                  <tr key={payment.id + payment.at} className="border-t border-line">
                    <td className="py-2 pr-3 font-mono text-[11px]">{payment.id}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{formatWhen(payment.at, now)}</td>
                    <td className="py-2 pr-3">{payment.order}</td>
                    <td className="py-2 pr-3 text-right font-semibold whitespace-nowrap tabular-nums">
                      {formatXaf(payment.amount)}
                    </td>
                    <td className="py-2 pr-3">{payment.method}</td>
                    <td className="py-2 pr-3 font-mono text-[11px]">{payment.reference || '—'}</td>
                    <td className="py-2 pr-3">
                      <Badge tone="success">{payment.status}</Badge>
                    </td>
                    <td className="py-2">{payment.by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}

export function AddressesTab({
  customer,
  permissions,
  onChange,
  onEditAddress,
}: TabProps) {
  return (
    <Panel
      title="Addresses"
      action={
        permissions.edit && (
          <button
            type="button"
            onClick={() => onEditAddress()}
            className={linkButton}
          >
            <Plus className="size-3.5 text-muted" aria-hidden="true" />
            Add Address
          </button>
        )
      }
    >
      {customer.addresses.length === 0 ? (
        <PanelEmpty>No addresses saved yet.</PanelEmpty>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {customer.addresses.map((address) => (
            <li key={address.id} className="rounded-lg bg-field p-3 text-xs">
              <div className="flex items-start justify-between gap-2">
                <p className="flex items-center gap-2 font-bold text-ink">
                  {address.label}
                  {address.isDefault && <Badge tone="brand">Default</Badge>}
                </p>
                {permissions.edit && (
                  <div className="flex">
                    <button
                      type="button"
                      onClick={() => onEditAddress(address)}
                      aria-label={`Edit ${address.label} address`}
                      className={`${iconButton} size-7`}
                    >
                      <Pencil className="size-3.5" aria-hidden="true" />
                    </button>
                    {!address.isDefault && (
                      <button
                        type="button"
                        onClick={() =>
                          onChange((current) => ({
                            ...current,
                            addresses: current.addresses.filter(
                              ({ id }) => id !== address.id,
                            ),
                          }))
                        }
                        aria-label={`Delete ${address.label} address`}
                        className={`${iconButton} size-7 hover:text-danger`}
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                )}
              </div>
              <p className="mt-1 text-ink">
                {address.street}
                <br />
                {[address.city, address.region].filter(Boolean).join(', ')}
              </p>
              {address.landmark && (
                <p className="mt-1 text-muted">Landmark: {address.landmark}</p>
              )}
              {address.instructions && (
                <p className="mt-1 text-muted">Note: {address.instructions}</p>
              )}
              {permissions.edit && !address.isDefault && (
                <button
                  type="button"
                  onClick={() =>
                    onChange((current) => ({
                      ...current,
                      addresses: current.addresses.map((item) => ({
                        ...item,
                        isDefault: item.id === address.id,
                      })),
                    }))
                  }
                  className={`${textLink} mt-2`}
                >
                  Set as Default
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export function PreferencesTab({ customer, permissions, onChange }: TabProps) {
  const disabled = !permissions.edit
  const setLaundry = (patch: Partial<CrmCustomer['laundry']>) =>
    onChange((current) => ({
      ...current,
      laundry: { ...current.laundry, ...patch },
    }))
  const setDelivery = (patch: Partial<CrmCustomer['delivery']>) =>
    onChange((current) => ({
      ...current,
      delivery: { ...current.delivery, ...patch },
    }))

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Laundry preferences">
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(LAUNDRY_OPTIONS) as (keyof typeof LAUNDRY_OPTIONS)[]).map(
            (key) => (
              <div key={key}>
                <label htmlFor={`pref-${key}`} className={`${labelClass} capitalize`}>
                  {key === 'softener' ? 'Fabric softener' : key}
                </label>
                <select
                  id={`pref-${key}`}
                  disabled={disabled}
                  value={customer.laundry[key]}
                  onChange={(event) => setLaundry({ [key]: event.target.value })}
                  className={fieldClass}
                >
                  {LAUNDRY_OPTIONS[key].map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </div>
            ),
          )}
          <label className="flex items-center gap-2 text-xs font-semibold text-ink sm:col-span-2">
            <input
              type="checkbox"
              disabled={disabled}
              checked={customer.laundry.ironing}
              onChange={(event) => setLaundry({ ironing: event.target.checked })}
              className="size-4 accent-brand"
            />
            Iron garments
          </label>
          <div className="sm:col-span-2">
            <label htmlFor="pref-instructions" className={labelClass}>
              Special instructions
            </label>
            <textarea
              id="pref-instructions"
              rows={2}
              disabled={disabled}
              placeholder="e.g. Do not use bleach."
              value={customer.laundry.instructions}
              onChange={(event) => setLaundry({ instructions: event.target.value })}
              className={`${fieldClass} h-auto py-2`}
            />
          </div>
        </div>
        <p className="mt-3 text-[11px] text-muted">
          Special instructions are carried into the handling notes of new orders
          started from this profile.
        </p>
      </Panel>

      <div className="min-w-0 space-y-4">
        <Panel title="Pickup & delivery preferences">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="pref-method" className={labelClass}>
                Preferred method
              </label>
              <select
                id="pref-method"
                disabled={disabled}
                value={customer.delivery.method}
                onChange={(event) =>
                  setDelivery({ method: event.target.value as FulfilmentMethod })
                }
                className={fieldClass}
              >
                <option value="pickup">Customer pickup</option>
                <option value="delivery">Delivery</option>
              </select>
            </div>
            <div>
              <label htmlFor="pref-window" className={labelClass}>
                Preferred time
              </label>
              <input
                id="pref-window"
                disabled={disabled}
                placeholder="e.g. 17:00–19:00"
                value={customer.delivery.window}
                onChange={(event) => setDelivery({ window: event.target.value })}
                className={fieldClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="pref-delivery-notes" className={labelClass}>
                Delivery instructions
              </label>
              <input
                id="pref-delivery-notes"
                disabled={disabled}
                placeholder="e.g. Call before arriving."
                value={customer.delivery.instructions}
                onChange={(event) =>
                  setDelivery({ instructions: event.target.value })
                }
                className={fieldClass}
              />
            </div>
          </div>
        </Panel>

        <Panel title="Communication consent">
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ['sms', 'SMS'],
                ['email', 'Email'],
                ['whatsapp', 'WhatsApp'],
                ['marketing', 'Marketing messages'],
              ] as [keyof Consent, string][]
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex items-center gap-2 rounded-md bg-field px-3 py-2 text-xs font-medium text-ink"
              >
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={customer.consent[key]}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      consent: { ...current.consent, [key]: event.target.checked },
                    }))
                  }
                  className="size-4 accent-brand"
                />
                {label}
              </label>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}

const LEDGER_REASONS: Record<string, string> = {
  ORDER_COMPLETED: 'Order completed',
  REDEEMED: 'Redeemed on an order',
  ADJUSTMENT: 'Adjustment',
  EXPIRED: 'Expired',
  REFERRAL: 'Referral',
  PROMOTION: 'Promotion',
}

export function LoyaltyTab({
  customer,
  permissions,
  onAdjustPoints,
}: TabProps) {
  const { tier, next, progress } = getTier(customer.points)
  const ledger = useGetLoyaltyLedgerQuery({ id: customer.id })
  const history = ledger.data ?? []
  const nextReward = REWARDS.find(({ cost }) => cost > customer.points)

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="min-w-0 space-y-4">
        <Panel
          title={`${tier.label} Member`}
          action={
            permissions.manage && (
              <button type="button" onClick={onAdjustPoints} className={linkButton}>
                Adjust Points
              </button>
            )
          }
        >
          <div className="flex items-center justify-between gap-2 text-xs">
            <TierBadge points={customer.points} />
            <span className="font-bold text-ink tabular-nums">
              {customer.points.toLocaleString('en-US')}
              {next && ` / ${next.min.toLocaleString('en-US')}`} pts
            </span>
          </div>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-brand/15"
            role="meter"
            aria-label="Progress to next tier"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-muted">
            {next
              ? `${(next.min - customer.points).toLocaleString('en-US')} points to ${next.label}.`
              : 'Top tier reached.'}
            {nextReward &&
              ` Next reward: ${nextReward.name} at ${nextReward.cost.toLocaleString('en-US')} points.`}
          </p>
        </Panel>

        <Panel title="Loyalty tiers">
          <ul className="space-y-1.5 text-xs">
            {LOYALTY_TIERS.map(({ id, label, min }, index) => {
              const upper = LOYALTY_TIERS[index + 1]?.min
              return (
                <li
                  key={id}
                  className={`flex items-center justify-between rounded-md px-3 py-2 ${
                    id === tier.id ? 'bg-brand/5 font-bold ring-1 ring-brand/30' : 'bg-field'
                  }`}
                >
                  <span className="flex items-center gap-2 text-ink">
                    {id === tier.id && (
                      <Star className="size-3.5 text-brand" aria-hidden="true" />
                    )}
                    {label}
                  </span>
                  <span className="text-muted tabular-nums">
                    {min.toLocaleString('en-US')}
                    {upper ? `–${(upper - 1).toLocaleString('en-US')}` : '+'} points
                  </span>
                </li>
              )
            })}
          </ul>
        </Panel>
      </div>

      <div className="min-w-0 space-y-4">
        <Panel title="Rewards">
          <ul className="space-y-2">
            {REWARDS.map(({ name, cost }) => {
              const available = customer.points >= cost
              return (
                <li
                  key={name}
                  className="flex items-center gap-3 rounded-lg bg-field p-3 text-xs"
                >
                  <Gift
                    className={`size-4 shrink-0 ${available ? 'text-brand' : 'text-muted/50'}`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{name}</p>
                    <p className="text-[11px] text-muted">
                      {cost.toLocaleString('en-US')} points ·{' '}
                      {available ? 'Available' : 'Not enough points yet'}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="mt-3 text-[11px] text-muted">
            Points are redeemed against an open order, when it is created or edited.
          </p>
        </Panel>

        <Panel title="Loyalty history">
          {ledger.isLoading ? (
            <PanelEmpty>Loading the points history…</PanelEmpty>
          ) : ledger.isError && !ledger.data ? (
            <PanelEmpty>{requestFailure(ledger.error, 'Couldn’t load the points history.')}</PanelEmpty>
          ) : history.length === 0 ? (
            <PanelEmpty>No loyalty activity yet.</PanelEmpty>
          ) : (
            <ul className="space-y-2 text-xs">
              {history.map((entry) => (
                <li key={entry.id} className="flex justify-between gap-3">
                  <span className="min-w-0 text-ink">
                    <span className={`font-bold tabular-nums ${entry.points < 0 ? 'text-danger' : 'text-success'}`}>
                      {entry.points > 0 ? '+' : ''}
                      {entry.points.toLocaleString('en-US')}
                    </span>{' '}
                    {LEDGER_REASONS[entry.reason] ?? entry.reason}
                    {entry.reference && ` · ${entry.reference}`}
                    <span className="block text-[10px] text-muted">
                      Balance {entry.balanceAfter.toLocaleString('en-US')}
                      {entry.by && ` · ${entry.by}`}
                    </span>
                  </span>
                  <time className="shrink-0 text-muted">{formatDate(entry.at)}</time>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}

export function ActivityTab({ customer }: TabProps) {
  const timeline = useGetCustomerActivityQuery({ id: customer.id })
  const entries = timeline.data ?? []

  return (
    <Panel title="Customer timeline">
      {timeline.isLoading ? (
        <PanelEmpty>Loading the timeline…</PanelEmpty>
      ) : timeline.isError && !timeline.data ? (
        <PanelEmpty>{requestFailure(timeline.error, 'Couldn’t load the timeline.')}</PanelEmpty>
      ) : entries.length === 0 ? (
        <PanelEmpty>Nothing has happened for this customer yet.</PanelEmpty>
      ) : (
        <ol className="space-y-3 border-l border-line pl-4">
          {entries.map((entry, index) => (
            <li key={entry.at + index} className="relative text-xs">
              <span className="absolute top-1 -left-[21px] size-2.5 rounded-full bg-brand ring-2 ring-white" />
              <time className="block text-[10px] text-muted">
                {formatDate(entry.at)}
                {entry.by && ` · ${entry.by}`}
              </time>
              <p className="font-semibold text-ink">
                {entry.text}
                {entry.related?.kind === 'ORDER' && (
                  <>
                    {' '}
                    <Link to={`/orders?search=${encodeURIComponent(entry.related.id)}`} className="font-normal text-brand hover:underline">
                      {entry.related.id}
                    </Link>
                  </>
                )}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}

// The channel a customer chose, if any: the dispatcher only sends on that one
function chosenChannel(consent: Consent): 'SMS' | 'WHATSAPP' | 'EMAIL' | null {
  if (consent.sms) return 'SMS'
  if (consent.whatsapp) return 'WHATSAPP'
  if (consent.email) return 'EMAIL'
  return null
}

const CHANNEL_LABELS: Record<MessageChannel, string> = { SMS: 'SMS', WHATSAPP: 'WhatsApp', EMAIL: 'Email', CALL: 'Call' }

const STATUS_TONES = { DELIVERED: 'success', FAILED: 'danger', QUEUED: 'warning', LOGGED: 'neutral' } as const

const requestFailure = (error: unknown, rejected: string) =>
  serverMessage(error) ?? errorMessage(error as Parameters<typeof errorMessage>[0], rejected) ?? NETWORK_ERROR_MESSAGE

export function CommunicationTab({ customer, permissions }: TabProps) {
  const history = useListCommunicationsQuery({ id: customer.id })
  const [sendMessage, sending] = useSendCustomerMessageMutation()
  const [logContact, logging] = useLogCommunicationMutation()
  const chosen = chosenChannel(customer.consent)
  const [template, setTemplate] = useState(MESSAGE_TEMPLATES[0])
  const [body, setBody] = useState(MESSAGE_TEMPLATES[0])
  const [marketing, setMarketing] = useState(false)
  const [logChannel, setLogChannel] = useState<MessageChannel>('CALL')
  const [logText, setLogText] = useState('')
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const phone = customer.phone.replace(/[^\d+]/g, '')
  const entries = history.data ?? []

  async function handleSend() {
    if (!chosen) return
    setNotice(null)
    try {
      await sendMessage({ id: customer.id, channel: chosen, message: body.trim(), marketing }).unwrap()
      setNotice({ tone: 'ok', text: `Message sent by ${CHANNEL_LABELS[chosen]}.` })
    } catch (error) {
      setNotice({ tone: 'error', text: requestFailure(error, 'The message wasn’t sent.') })
    }
  }

  async function handleLog() {
    setNotice(null)
    try {
      await logContact({ id: customer.id, channel: logChannel, message: logText.trim() }).unwrap()
      setLogText('')
      setNotice({ tone: 'ok', text: 'Contact logged.' })
    } catch (error) {
      setNotice({ tone: 'error', text: requestFailure(error, 'The contact wasn’t logged.') })
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="min-w-0 space-y-4">
        <Panel title="Send a message">
          {chosen ? (
            <>
              <p className="mb-2 text-[11px] text-muted">
                Goes out by <span className="font-semibold text-ink">{CHANNEL_LABELS[chosen]}</span>, the channel
                this customer chose.
              </p>
              <label htmlFor="contact-template" className={labelClass}>
                Message template
              </label>
              <select
                id="contact-template"
                value={template}
                onChange={(event) => {
                  setTemplate(event.target.value)
                  setBody(event.target.value)
                }}
                className={fieldClass}
              >
                {MESSAGE_TEMPLATES.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
              <label htmlFor="contact-body" className={`${labelClass} mt-3 block`}>
                Message
              </label>
              <textarea
                id="contact-body"
                rows={3}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                className={`${fieldClass} h-auto py-2`}
              />
              <label className="mt-2 flex items-center gap-2 text-[11px] text-muted">
                <input
                  type="checkbox"
                  checked={marketing}
                  onChange={(event) => setMarketing(event.target.checked)}
                  className="size-4 accent-brand"
                />
                Promotional message (needs marketing consent)
              </label>
              <button
                type="button"
                disabled={!permissions.edit || !body.trim() || sending.isLoading}
                onClick={() => void handleSend()}
                className={`${primaryButton} mt-3`}
              >
                {sending.isLoading ? 'Sending…' : 'Send Message'}
              </button>
            </>
          ) : (
            <p className="text-xs text-muted">
              This customer has not chosen a channel to be reached on. Set one under Preferences to send messages.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
            <a href={`tel:${phone}`} className={linkButton}>
              <Phone className="size-3.5 text-muted" aria-hidden="true" />
              Call
            </a>
            <a href={`sms:${phone}?body=${encodeURIComponent(template)}`} className={linkButton}>
              <MessageSquare className="size-3.5 text-muted" aria-hidden="true" />
              SMS app
            </a>
            <a href={whatsappHref(phone, template)} target="_blank" rel="noreferrer" className={linkButton}>
              <MessageCircle className="size-3.5 text-muted" aria-hidden="true" />
              WhatsApp
            </a>
            {customer.email && (
              <a href={`mailto:${customer.email}?body=${encodeURIComponent(template)}`} className={linkButton}>
                <Mail className="size-3.5 text-muted" aria-hidden="true" />
                Email app
              </a>
            )}
          </div>
        </Panel>

        {permissions.edit && (
          <Panel title="Log a contact">
            <p className="mb-2 text-[11px] text-muted">Note a call or a message you made outside the app.</p>
            <div className="grid gap-2 sm:grid-cols-[8rem_1fr]">
              <select
                aria-label="Contact channel"
                value={logChannel}
                onChange={(event) => setLogChannel(event.target.value as MessageChannel)}
                className={fieldClass}
              >
                {(Object.keys(CHANNEL_LABELS) as MessageChannel[]).map((channel) => (
                  <option key={channel} value={channel}>
                    {CHANNEL_LABELS[channel]}
                  </option>
                ))}
              </select>
              <input
                aria-label="What was said"
                placeholder="What was said"
                value={logText}
                onChange={(event) => setLogText(event.target.value)}
                className={fieldClass}
              />
            </div>
            <button
              type="button"
              disabled={!logText.trim() || logging.isLoading}
              onClick={() => void handleLog()}
              className={`${secondaryButton} mt-3`}
            >
              {logging.isLoading ? 'Saving…' : 'Log Contact'}
            </button>
          </Panel>
        )}

        {notice && (
          <p
            role={notice.tone === 'error' ? 'alert' : 'status'}
            className={`rounded-lg p-3 text-xs font-semibold ${notice.tone === 'error' ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}
          >
            {notice.text}
          </p>
        )}
      </div>

      <Panel title="Communication history">
        {history.isLoading ? (
          <PanelEmpty>Loading the history…</PanelEmpty>
        ) : history.isError && !history.data ? (
          <PanelEmpty>{requestFailure(history.error, 'Couldn’t load the history.')}</PanelEmpty>
        ) : entries.length === 0 ? (
          <PanelEmpty>No messages sent yet.</PanelEmpty>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li key={entry.id} className="rounded-lg bg-field p-3 text-xs">
                <p className="flex items-center justify-between gap-2 text-[10px] text-muted">
                  <span>
                    {formatDate(entry.at)} · {CHANNEL_LABELS[entry.channel]}{' '}
                    {entry.direction === 'INBOUND' ? 'received' : entry.status === 'LOGGED' ? 'logged' : 'sent'}
                    {entry.by && ` by ${entry.by}`}
                  </span>
                  <Badge tone={STATUS_TONES[entry.status as keyof typeof STATUS_TONES] ?? 'neutral'}>{entry.status}</Badge>
                </p>
                <p className="mt-1 text-ink">“{entry.message}”</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
