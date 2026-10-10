import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import {
  Archive,
  ArrowLeft,
  Banknote,
  Ban,
  Ellipsis,
  FileDown,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  ShoppingCart,
  Star,
  StickyNote,
  UserCheck,
  X,
} from 'lucide-react'
import {
  Avatar,
  CustomerStatusBadge,
  TierBadge,
} from '../components/customers/CustomerBits'
import {
  AddressDialog,
  CustomerPaymentDialog,
  NoteDialog,
  PointsDialog,
} from '../components/customers/CustomerDialogs'
import CustomerFormDialog from '../components/customers/CustomerFormDialog'
import {
  ActivityTab,
  AddressesTab,
  CommunicationTab,
  LoyaltyTab,
  OrdersTab,
  OverviewTab,
  PaymentsTab,
  PreferencesTab,
} from '../components/customers/CustomerProfileTabs'
import type { TabProps } from '../components/customers/CustomerProfileTabs'
import { ConfirmDialog } from '../components/orders/OrderDialogs'
import type { ConfirmRequest } from '../components/orders/OrderDialogs'
import { primaryButton, secondaryButton } from '../components/orders/styles'
import Menu, { MenuItem } from '../components/ui/Menu'
import { CUSTOMER_PERMISSIONS, CUSTOMER_TAGS } from '../constants/customers'
import { CURRENT_USER, PERMISSIONS } from '../constants/orders'
import useCustomers, { customerStore } from '../hooks/useCustomers'
import useLocalStorage from '../hooks/useLocalStorage'
import useNow from '../hooks/useNow'
import type { Address, CrmCustomer } from '../types/customer'
import type { OrderRole } from '../types/order'
import {
  applyPayment,
  customersToCsv,
  formatDate,
  formatLastOrder,
  getAverageOrder,
} from '../utils/customers'
import { downloadFile, formatXaf } from '../utils/orders'

const TABS = [
  { id: 'overview', label: 'Overview', panel: OverviewTab, financial: false },
  { id: 'orders', label: 'Orders', panel: OrdersTab, financial: false },
  { id: 'payments', label: 'Payments', panel: PaymentsTab, financial: true },
  { id: 'addresses', label: 'Addresses', panel: AddressesTab, financial: false },
  { id: 'preferences', label: 'Preferences', panel: PreferencesTab, financial: false },
  { id: 'loyalty', label: 'Loyalty', panel: LoyaltyTab, financial: false },
  { id: 'activity', label: 'Activity', panel: ActivityTab, financial: false },
  { id: 'communication', label: 'Communication', panel: CommunicationTab, financial: false },
]

const TOAST_MS = 4000

type DialogState =
  | { name: 'edit' | 'payment' | 'note' | 'points' }
  | { name: 'address'; address?: Address }

function CustomerProfilePage() {
  const { customerId } = useParams()
  const navigate = useNavigate()
  const now = useNow()
  const customer = useCustomers().find(({ id }) => id === customerId)
  const [role] = useLocalStorage<OrderRole>('customers.role', 'manager')
  const [tab, setTab] = useState('overview')
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const permissions = CUSTOMER_PERMISSIONS[role]
  const canCreateOrder = PERMISSIONS[role].create

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toast])

  if (!customer || customer.archived) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line">
        <h1 className="text-sm font-bold text-ink">Customer not found</h1>
        <p className="text-xs text-muted">
          This profile doesn’t exist or has been archived.
        </p>
        <Link to="/customers" className={`${primaryButton} mt-2`}>
          Back to Customers
        </Link>
      </div>
    )
  }

  const change = (update: (current: CrmCustomer) => CrmCustomer) =>
    customerStore.update([customer.id], update)
  const logged = (current: CrmCustomer, text: string): CrmCustomer => ({
    ...current,
    activity: [{ at: new Date().toISOString(), text }, ...current.activity],
  })
  const suspended = customer.status === 'suspended'
  const tabs = TABS.filter(({ financial }) => permissions.financials || !financial)
  const activeTab = tabs.find(({ id }) => id === tab) ?? tabs[0]
  const ActivePanel = activeTab.panel
  const availableTags = CUSTOMER_TAGS.filter((tag) => !customer.tags.includes(tag))

  const tabProps: TabProps = {
    customer,
    now,
    permissions,
    canCreateOrder,
    onChange: change,
    onRecordPayment: () => setDialog({ name: 'payment' }),
    onAddNote: () => setDialog({ name: 'note' }),
    onEditAddress: (address) => setDialog({ name: 'address', address }),
    onAdjustPoints: () => setDialog({ name: 'points' }),
  }

  const summary: [string, string][] = [
    ['Total Orders', String(customer.orders)],
    ...(permissions.financials
      ? ([
          ['Total Spent', formatXaf(customer.spent)],
          ['Average Order', formatXaf(getAverageOrder(customer))],
          ['Outstanding', formatXaf(customer.outstanding)],
        ] as [string, string][])
      : []),
    ['Last Order', formatLastOrder(customer.lastOrderAt, now)],
    ['Loyalty Points', customer.points.toLocaleString('en-US')],
  ]

  function requestSuspend() {
    setConfirm({
      title: `Suspend ${customer!.name}?`,
      body: 'Suspended accounts cannot place new orders until management reactivates them.',
      confirmLabel: 'Suspend Customer',
      destructive: true,
      onConfirm: () => {
        change((current) => logged({ ...current, status: 'suspended' }, 'Account suspended'))
        setToast('Customer suspended')
      },
    })
  }

  function requestArchive() {
    setConfirm({
      title: `Archive ${customer!.name}?`,
      body: 'Archived customers disappear from the list and can no longer be selected for new orders. Their order and payment history is kept.',
      confirmLabel: 'Archive Customer',
      destructive: true,
      onConfirm: () => {
        change((current) => ({ ...current, archived: true }))
        navigate('/customers')
      },
    })
  }

  return (
    <>
      <Link
        to="/customers"
        className="inline-flex items-center gap-1.5 rounded-sm text-xs font-semibold text-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Customers
      </Link>

      <section className="rounded-xl bg-white p-4 ring-1 ring-line">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar customer={customer} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-ink">{customer.name}</h1>
              <CustomerStatusBadge customer={customer} />
              <TierBadge points={customer.points} />
            </div>
            <p className="mt-0.5 font-mono text-[11px] text-muted">{customer.id}</p>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              <span className="font-semibold text-ink">{customer.phone}</span>
              {customer.email && <span>{customer.email}</span>}
              <span>Customer since {formatDate(customer.registeredAt)}</span>
              <span>Preferred branch: {customer.branch}</span>
              <span>Preferred service: {customer.preferredService}</span>
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {customer.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex h-6 items-center gap-1 rounded-full bg-field pr-1 pl-2.5 text-[11px] font-semibold text-ink"
                >
                  {tag}
                  {permissions.edit && (
                    <button
                      type="button"
                      onClick={() =>
                        change((current) => ({
                          ...current,
                          tags: current.tags.filter((item) => item !== tag),
                        }))
                      }
                      aria-label={`Remove tag ${tag}`}
                      className="flex size-4 items-center justify-center rounded-full text-muted hover:bg-white hover:text-danger"
                    >
                      <X className="size-3" aria-hidden="true" />
                    </button>
                  )}
                </span>
              ))}
              {permissions.edit && availableTags.length > 0 && (
                <Menu
                  align="left"
                  trigger={
                    <>
                      <Plus className="size-3" aria-hidden="true" />
                      Add Tag
                    </>
                  }
                  triggerClassName="inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold text-brand ring-1 ring-brand/30 hover:bg-brand/5 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                >
                  {(close) =>
                    availableTags.map((tag) => (
                      <MenuItem
                        key={tag}
                        onSelect={() => {
                          close()
                          change((current) => ({
                            ...current,
                            tags: [...current.tags, tag],
                          }))
                        }}
                      >
                        {tag}
                      </MenuItem>
                    ))
                  }
                </Menu>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canCreateOrder && !suspended && (
              <Link
                to={`/orders?new=1&customer=${customer.id}`}
                className={primaryButton}
              >
                <ShoppingCart className="size-4" aria-hidden="true" />
                New Order
              </Link>
            )}
            {permissions.financials && customer.outstanding > 0 && (
              <button
                type="button"
                onClick={() => setDialog({ name: 'payment' })}
                className={secondaryButton}
              >
                <Banknote className="size-4 text-muted" aria-hidden="true" />
                Record Payment
              </button>
            )}
            <a
              href={`tel:${customer.phone.replace(/[^\d+]/g, '')}`}
              className={secondaryButton}
            >
              <Phone className="size-4 text-muted" aria-hidden="true" />
              Call
            </a>
            <a
              href={`https://wa.me/${customer.phone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className={secondaryButton}
            >
              <MessageCircle className="size-4 text-muted" aria-hidden="true" />
              Message
            </a>
            {permissions.edit && (
              <Menu
                label="More customer actions"
                trigger={<Ellipsis className="size-4" aria-hidden="true" />}
                triggerClassName={`${secondaryButton} w-9 px-0`}
              >
                {(close) => {
                  const item = (
                    label: string,
                    Icon: typeof Pencil,
                    action: () => void,
                    destructive = false,
                  ) => (
                    <MenuItem
                      destructive={destructive}
                      onSelect={() => {
                        close()
                        action()
                      }}
                    >
                      <Icon
                        className={`size-4 ${destructive ? '' : 'text-muted'}`}
                        aria-hidden="true"
                      />
                      {label}
                    </MenuItem>
                  )
                  return (
                    <>
                      {item('Edit Customer', Pencil, () => setDialog({ name: 'edit' }))}
                      {item('Add Address', MapPin, () => setDialog({ name: 'address' }))}
                      {item('Add Note', StickyNote, () => setDialog({ name: 'note' }))}
                      {permissions.manage &&
                        item('Adjust Loyalty Points', Star, () =>
                          setDialog({ name: 'points' }),
                        )}
                      {item('Export Customer Data', FileDown, () =>
                        downloadFile(
                          `${customer.id}.csv`,
                          customersToCsv([customer], permissions.financials),
                          'text/csv;charset=utf-8',
                        ),
                      )}
                      {permissions.manage &&
                        (suspended
                          ? item('Reactivate Customer', UserCheck, () => {
                              change((current) =>
                                logged({ ...current, status: 'active' }, 'Account reactivated'),
                              )
                              setToast('Customer reactivated')
                            })
                          : item('Suspend Customer', Ban, requestSuspend, true))}
                      {permissions.manage &&
                        item('Archive Customer', Archive, requestArchive, true)}
                    </>
                  )
                }}
              </Menu>
            )}
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {summary.map(([label, value]) => (
            <div key={label} className="rounded-lg bg-field px-3 py-2">
              <dt className="text-[10px] font-semibold text-muted">{label}</dt>
              <dd
                className={`text-sm font-bold ${
                  label === 'Outstanding' && customer.outstanding > 0
                    ? 'text-danger'
                    : 'text-ink'
                }`}
              >
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <div
        role="tablist"
        aria-label="Customer profile sections"
        className="flex gap-1 overflow-x-auto rounded-xl bg-white p-1 ring-1 ring-line"
      >
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={id === activeTab.id}
            aria-controls="customer-tabpanel"
            onClick={() => setTab(id)}
            className={`h-8 shrink-0 rounded-lg px-3 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
              id === activeTab.id
                ? 'bg-brand text-white'
                : 'text-muted hover:bg-field hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        id="customer-tabpanel"
        role="tabpanel"
        aria-labelledby={`tab-${activeTab.id}`}
      >
        <ActivePanel {...tabProps} />
      </div>

      {toast && (
        <p
          role="status"
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md bg-ink px-4 py-2.5 text-xs font-semibold text-white shadow-lg"
        >
          {toast}
        </p>
      )}

      {dialog?.name === 'edit' && (
        <CustomerFormDialog
          customer={customer}
          canManage={permissions.manage}
          onClose={() => setDialog(null)}
          onSave={(saved) => {
            change(() => saved)
            setDialog(null)
            setToast('Customer updated')
          }}
        />
      )}
      {dialog?.name === 'payment' && (
        <CustomerPaymentDialog
          customer={customer}
          onClose={() => setDialog(null)}
          onSubmit={(amount, method, reference) => {
            change((current) =>
              applyPayment(current, amount, method, reference, CURRENT_USER),
            )
            setDialog(null)
            setToast(`Payment of ${formatXaf(amount)} recorded`)
          }}
        />
      )}
      {dialog?.name === 'note' && (
        <NoteDialog
          onClose={() => setDialog(null)}
          onSave={(text) => {
            change((current) => ({
              ...current,
              notes: [
                {
                  id: `note-${Date.now()}`,
                  text,
                  by: CURRENT_USER,
                  at: new Date().toISOString(),
                },
                ...current.notes,
              ],
            }))
            setDialog(null)
          }}
        />
      )}
      {dialog?.name === 'points' && (
        <PointsDialog
          customer={customer}
          onClose={() => setDialog(null)}
          onSave={(delta, reason) => {
            change((current) =>
              logged(
                { ...current, points: current.points + delta },
                `Loyalty points adjusted by ${delta > 0 ? '+' : ''}${delta} (${reason})`,
              ),
            )
            setDialog(null)
          }}
        />
      )}
      {dialog?.name === 'address' && (
        <AddressDialog
          address={dialog.address}
          onClose={() => setDialog(null)}
          onSave={(address) => {
            change((current) => {
              const exists = current.addresses.some(({ id }) => id === address.id)
              const addresses = exists
                ? current.addresses.map((item) =>
                    item.id === address.id ? address : item,
                  )
                : [
                    ...current.addresses,
                    { ...address, isDefault: current.addresses.length === 0 },
                  ]
              return { ...current, addresses }
            })
            setDialog(null)
            setTab('addresses')
          }}
        />
      )}
      {confirm && (
        <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
      )}
    </>
  )
}

export default CustomerProfilePage
