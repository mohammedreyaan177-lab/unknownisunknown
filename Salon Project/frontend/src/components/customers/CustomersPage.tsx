import { useMemo, useState } from 'react'
import { errorMessage } from '../../context/AuthContext'
import { useSalonData } from '../../context/SalonDataContext'
import { customerApi } from '../../lib/api'
import { dateOfBirthFromAge, formatAge, formatMediumDate, initials, pluralize } from '../../lib/format'
import type { Customer, CustomerInput } from '../../types'
import { Button } from '../ui/Button'
import { TextArea, TextField } from '../ui/Field'
import { Modal } from '../ui/Modal'
import { PageHeader } from '../ui/PageHeader'
import { SearchInput } from '../ui/SearchInput'
import { EmptyState, ErrorState, InlineAlert, Skeleton } from '../ui/States'
import { useToast } from '../ui/Toast'
import { CustomerHistoryDialog } from './CustomerHistoryDialog'

type SortKey = 'name' | 'recent' | 'birthday'

export function CustomersPage() {
  const {
    customers,
    appointments,
    services,
    staff,
    loading,
    error,
    refresh,
    upsertCustomer,
    removeCustomer,
  } = useSalonData()
  const toast = useToast()

  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('name')
  const [editing, setEditing] = useState<Customer | null>(null)
  const [creating, setCreating] = useState(false)
  const [history, setHistory] = useState<Customer | null>(null)

  // Appointment counts come from the shared appointment list — no extra request.
  const visits = useMemo(() => {
    const counts = new Map<number, number>()
    for (const appointment of appointments) {
      counts.set(appointment.customer_id, (counts.get(appointment.customer_id) ?? 0) + 1)
    }
    return counts
  }, [appointments])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const filtered = needle
      ? customers.filter((c) =>
          [c.name, c.email ?? '', c.phone, c.notes ?? ''].some((value) =>
            value.toLowerCase().includes(needle),
          ),
        )
      : customers

    return [...filtered].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'birthday') return (a.date_of_birth ?? '9999').localeCompare(b.date_of_birth ?? '9999')
      return b.id - a.id
    })
  }, [customers, query, sort])

  const close = () => {
    setEditing(null)
    setCreating(false)
  }

  return (
    <>
      <PageHeader
        eyebrow="Client book"
        title="Customers"
        note="Everyone on the salon record book, with contact details and preferences."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            New customer
          </Button>
        }
      />

      {error ? (
        <div className="panel">
          <ErrorState message={error} onRetry={() => void refresh()} />
        </div>
      ) : (
        <>
          <div className="toolbar">
            <label className="visually-hidden" htmlFor="customer-search">
              Search customers
            </label>
            <SearchInput
              id="customer-search"
              value={query}
              onChange={setQuery}
              placeholder="Search name, phone, email or note"
            />
            <div className="filters">
              <label className="visually-hidden" htmlFor="customer-sort">
                Sort customers
              </label>
              <select
                id="customer-sort"
                className="field__control"
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
              >
                <option value="name">Name A–Z</option>
                <option value="recent">Most recent</option>
                <option value="birthday">Birthday</option>
              </select>
              <span className="result-count">
                {loading ? 'Loading' : `${visible.length} of ${customers.length}`}
              </span>
            </div>
          </div>

          <div className="tablewrap">
            {loading ? (
              <Skeleton rows={5} />
            ) : visible.length === 0 ? (
              <EmptyState
                title={query ? 'No customers match that search' : 'No customers yet'}
                text={
                  query
                    ? `Nothing matches “${query}”. Try a different name, number or email.`
                    : 'Add the first client to start keeping track of bookings and preferences.'
                }
                action={
                  query ? (
                    <Button variant="outline" onClick={() => setQuery('')}>
                      Clear search
                    </Button>
                  ) : (
                    <Button variant="accent" onClick={() => setCreating(true)}>
                      New customer
                    </Button>
                  )
                }
              />
            ) : (
              <div className="tablescroll">
                <table className="data">
                  <caption className="visually-hidden">
                    {visible.length} {pluralize(visible.length, 'customer')}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Customer</th>
                      <th scope="col">Phone</th>
                      <th scope="col">Email</th>
                      <th scope="col">Birthday</th>
                      <th scope="col" className="num">
                        Visits
                      </th>
                      <th scope="col">
                        <span className="visually-hidden">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((customer) => {
                      const age = formatAge(customer.date_of_birth)
                      return (
                        <tr key={customer.id}>
                          <td data-label="">
                            <span className="cellname">
                              <span className="avatar" aria-hidden="true">
                                {initials(customer.name)}
                              </span>
                              <span className="cellname__text">
                                <span className="cellname__title">{customer.name}</span>
                                <span className="cellname__sub">
                                  {customer.notes?.trim() ? customer.notes : `Record #${customer.id}`}
                                </span>
                              </span>
                            </span>
                          </td>
                          <td className="num" data-label="Phone">
                            {customer.phone}
                          </td>
                          <td className="muted" data-label="Email">
                            {customer.email || '—'}
                          </td>
                          <td className="muted" data-label="Birthday">
                            {customer.date_of_birth
                              ? `${formatMediumDate(customer.date_of_birth)}${age ? ` · ${age}` : ''}`
                              : '—'}
                          </td>
                          <td className="num muted" data-label="Visits">
                            {/* The count doubles as the way in to the full history. */}
                            <button
                              type="button"
                              className="linkbtn"
                              onClick={() => setHistory(customer)}
                              aria-label={`View visit history for ${customer.name}`}
                            >
                              {visits.get(customer.id) ?? 0}
                            </button>
                          </td>
                          <td className="actions-cell" data-label="">
                            <div className="actions">
                              <Button size="sm" variant="outline" onClick={() => setEditing(customer)}>
                                Edit
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {(creating || editing) && (
        <CustomerDialog
          customer={editing}
          // The bookings cascade away with the customer, so the confirmation
          // has to say how many before anything is destroyed.
          appointmentCount={editing ? visits.get(editing.id) ?? 0 : 0}
          onClose={close}
          onSaved={(customer, mode) => {
            upsertCustomer(customer)
            close()
            toast.success(
              mode === 'created' ? `${customer.name} added` : `${customer.name} updated`,
              mode === 'created' ? 'The record is now on file.' : 'Changes saved.',
            )
          }}
          onDeleted={(customer) => {
            removeCustomer(customer.id)
            close()
            toast.success(`${customer.name} deleted`, 'The record was removed.')
          }}
        />
      )}

      <CustomerHistoryDialog
        customer={history}
        appointments={appointments}
        services={services}
        staff={staff}
        onClose={() => setHistory(null)}
      />
    </>
  )
}

/** The dialog edits plain strings; the payload converts them to the API shape. */
interface CustomerDraft {
  name: string
  phone: string
  email: string
  /** Age in whole years, as typed. Converted to a birthday on submit. */
  age: string
  notes: string
}

const EMPTY: CustomerDraft = { name: '', phone: '', email: '', age: '', notes: '' }

interface DialogProps {
  customer: Customer | null
  /** How many appointments this customer has — all of which cascade on delete. */
  appointmentCount: number
  onClose: () => void
  onSaved: (customer: Customer, mode: 'created' | 'updated') => void
  onDeleted: (customer: Customer) => void
}

function CustomerDialog({ customer, appointmentCount, onClose, onSaved, onDeleted }: DialogProps) {
  const [form, setForm] = useState<CustomerDraft>(() =>
    customer
      ? {
          name: customer.name,
          phone: customer.phone,
          email: customer.email ?? '',
          age: formatAge(customer.date_of_birth) ?? '',
          notes: customer.notes ?? '',
        }
      : EMPTY,
  )
  const [errors, setErrors] = useState<Partial<Record<keyof CustomerDraft, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const set = <K extends keyof CustomerDraft>(key: K, value: CustomerDraft[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const validate = (): boolean => {
    const next: Partial<Record<keyof CustomerDraft, string>> = {}
    if (!form.name.trim()) next.name = 'A name is required.'
    if (!form.phone.trim()) next.phone = 'A phone number is required.'
    else if (!/^[0-9+\-\s()]{6,20}$/.test(form.phone.trim()))
      next.phone = 'Enter a reachable phone number.'
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      next.email = 'Enter a valid email address.'
    const age = form.age.trim()
    if (age && !/^\d{1,3}$/.test(age)) next.age = 'Enter an age as a whole number.'
    else if (age && Number(age) > 129) next.age = 'Enter a realistic age.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async () => {
    if (saving) return
    setFormError(null)
    if (!validate()) return

    const age = form.age.trim()
    const payload: CustomerInput = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      // Email is optional, so a blank field is sent as null rather than "".
      // `customers.email` is nullable, but the service's duplicate check is
      // `where email = $1`: an empty string matches any other customer saved
      // without an email and the server answers "The customer already exists",
      // blocking the save. Null never compares equal in SQL, so it is both the
      // correct storage value and the one the duplicate check expects.
      email: form.email.trim() || null,
      // The desk asks for an age; the column stores a birthday, so the age is
      // converted here. Blank means unknown, which is sent as null.
      date_of_birth: age ? dateOfBirthFromAge(Number(age)) : null,
      notes: form.notes.trim() || null,
    }

    setSaving(true)
    try {
      const saved = customer
        ? await customerApi.update(customer.id, payload)
        : await customerApi.create(payload)
      onSaved(saved, customer ? 'updated' : 'created')
    } catch (err) {
      setFormError(errorMessage(err, 'The customer could not be saved.'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!customer || deleting) return
    setDeleting(true)
    try {
      await customerApi.remove(customer.id)
      onDeleted(customer)
    } catch (err) {
      setFormError(errorMessage(err, 'The customer could not be deleted.'))
      setDeleting(false)
      setConfirming(false)
    }
  }

  return (
    <>
      <Modal
        open
        title={customer ? 'Edit customer' : 'New customer'}
        subtitle={customer ? `Record #${customer.id}` : 'Record the details the front desk needs.'}
        onClose={onClose}
        footer={
          <>
            {/* Only when editing — a customer that does not exist yet cannot be
                deleted. This is the trigger the confirmation modal was waiting
                for; without it `remove()` and the modal below were unreachable. */}
            {customer && (
              <Button
                variant="danger"
                className="modal__footer-lead"
                onClick={() => setConfirming(true)}
                disabled={saving || deleting}
              >
                Delete
              </Button>
            )}
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void submit()} loading={saving}>
              {saving ? 'Saving' : customer ? 'Save changes' : 'Add customer'}
            </Button>
          </>
        }
      >
        {formError && (
          <div style={{ marginBottom: '1rem' }}>
            <InlineAlert message={formError} />
          </div>
        )}
        <div className="grid-2">
          <TextField
            label="Full name"
            className="span-2"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            error={errors.name}
            disabled={saving}
            autoComplete="off"
            required
          />
          <TextField
            label="Phone"
            type="tel"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            error={errors.phone}
            disabled={saving}
            autoComplete="off"
            required
          />
          <TextField
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            error={errors.email}
            disabled={saving}
            autoComplete="off"
            hint="Optional"
          />
          <TextField
            label="Age"
            type="number"
            inputMode="numeric"
            min={0}
            max={129}
            step={1}
            value={form.age}
            onChange={(e) => set('age', e.target.value)}
            error={errors.age}
            disabled={saving}
            hint="Optional"
            placeholder="e.g. 28"
          />
          <TextArea
            label="Notes"
            className="span-2"
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            disabled={saving}
            placeholder="Preferences, allergies, anything the team should know."
          />
        </div>
      </Modal>

      <Modal
        open={confirming}
        title="Delete this customer?"
        onClose={() => setConfirming(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleting} onClick={() => void remove()}>
              {deleting ? 'Deleting' : 'Delete customer'}
            </Button>
          </>
        }
      >
        <p className="confirm__text">
          <strong>{customer?.name}</strong> will be removed from the record book.
        </p>
        {/* `appointments.customer_id` is ON DELETE CASCADE, so the server
            destroys the history along with the record and still answers 200.
            That has to be stated here, because nothing downstream mentions it. */}
        {appointmentCount > 0 ? (
          <div className="confirm__warning" role="alert">
            <strong>
              {appointmentCount} {pluralize(appointmentCount, 'appointment')} will be permanently
              deleted
            </strong>
            <span>
              Booking history is kept with the appointment, not with the customer record, so
              deleting the customer erases {appointmentCount === 1 ? 'it' : 'them'} too. This cannot
              be undone.
            </span>
          </div>
        ) : (
          <p className="confirm__text confirm__text--muted">
            This customer has no appointments, so nothing else is lost.
          </p>
        )}
      </Modal>
    </>
  )
}
