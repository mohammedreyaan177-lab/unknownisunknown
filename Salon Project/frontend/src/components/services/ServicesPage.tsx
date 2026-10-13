import { useMemo, useState } from 'react'
import { errorMessage } from '../../context/AuthContext'
import { useSalonData } from '../../context/SalonDataContext'
import { serviceApi } from '../../lib/api'
import { formatDuration, formatMoney, pluralize } from '../../lib/format'
import type { Service, ServiceInput } from '../../types'
import { ActiveBadge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { SelectField, TextArea, TextField } from '../ui/Field'
import { Modal } from '../ui/Modal'
import { PageHeader } from '../ui/PageHeader'
import { SearchInput } from '../ui/SearchInput'
import { EmptyState, ErrorState, InlineAlert, Skeleton } from '../ui/States'
import { useToast } from '../ui/Toast'

type Filter = 'all' | 'active' | 'inactive'

export function ServicesPage() {
  const { services, loading, error, refresh, upsertService, removeService } = useSalonData()
  const toast = useToast()

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<Service | null>(null)
  const [creating, setCreating] = useState(false)
  const [removing, setRemoving] = useState<Service | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return services.filter((service) => {
      const matchesFilter = filter === 'all' || (filter === 'active' ? service.is_active : !service.is_active)
      if (!matchesFilter) return false
      if (!needle) return true
      return [service.name, service.category, service.description ?? ''].some((value) =>
        value.toLowerCase().includes(needle),
      )
    })
  }, [services, query, filter])

  const activeCount = services.filter((service) => service.is_active).length
  const close = () => {
    setEditing(null)
    setCreating(false)
  }

  const toggleActive = async (service: Service) => {
    if (busyId !== null) return
    setBusyId(service.id)
    try {
      const saved = await serviceApi.update(service.id, {
        name: service.name,
        description: service.description ?? '',
        category: service.category,
        duration_minutes: service.duration_minutes,
        price: Number(service.price),
        is_active: !service.is_active,
      })
      upsertService(saved)
      toast.success(
        saved.is_active ? `${saved.name} is now bookable` : `${saved.name} is now inactive`,
        saved.is_active ? 'It will appear in appointment booking.' : 'Hidden from new bookings.',
      )
    } catch (err) {
      toast.error('Could not update the service', errorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  const confirmRemove = async () => {
    if (!removing) return
    setBusyId(removing.id)
    try {
      await serviceApi.remove(removing.id)
      removeService(removing.id)
      toast.success(`${removing.name} deleted`, 'The service was removed from the catalogue.')
      setRemoving(null)
    } catch (err) {
      toast.error('Could not delete the service', errorMessage(err))
      setBusyId(null)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Catalogue"
        title="Services"
        note={
          services.length
            ? `${activeCount} of ${services.length} ${pluralize(services.length, 'service')} bookable right now.`
            : 'The bookable catalogue for skin, hair and beauty.'
        }
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            New service
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
            <label className="visually-hidden" htmlFor="service-search">
              Search services
            </label>
            <SearchInput
              id="service-search"
              value={query}
              onChange={setQuery}
              placeholder="Search services and categories"
            />
            <div className="filters">
              <div className="seg" role="group" aria-label="Filter by status">
                {(['all', 'active', 'inactive'] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`seg__item ${filter === key ? 'seg__item--on' : ''}`}
                    aria-pressed={filter === key}
                    onClick={() => setFilter(key)}
                  >
                    {key[0].toUpperCase() + key.slice(1)}
                  </button>
                ))}
              </div>
              <span className="result-count">
                {loading ? 'Loading' : `${visible.length} shown`}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="service-grid">
              {Array.from({ length: 3 }, (_, i) => (
                <div className="panel" key={i} style={{ padding: '1.5rem' }}>
                  <Skeleton height="1.2rem" />
                  <div style={{ height: '0.75rem' }} />
                  <Skeleton height="2.6rem" />
                </div>
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="panel">
              <EmptyState
                title={query || filter !== 'all' ? 'No services match' : 'No services available'}
                text={
                  query || filter !== 'all'
                    ? 'Adjust the search or status filter to see the rest of the catalogue.'
                    : 'Add the first service so appointments can be booked against it.'
                }
                action={
                  query || filter !== 'all' ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setQuery('')
                        setFilter('all')
                      }}
                    >
                      Reset filters
                    </Button>
                  ) : (
                    <Button variant="accent" onClick={() => setCreating(true)}>
                      New service
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <div className="service-grid">
              {visible.map((service) => (
                <article
                  className={`service-card ${service.is_active ? '' : 'service-card--off'}`}
                  key={service.id}
                >
                  <div className="service-card__top">
                    <h2 className="service-card__name">{service.name}</h2>
                    <ActiveBadge active={service.is_active} />
                  </div>

                  <span className="section-title">{service.category}</span>

                  <p className="service-card__desc">
                    {service.description?.trim() || 'No description recorded.'}
                  </p>

                  <div className="service-card__facts">
                    <span className="service-card__price">{formatMoney(service.price)}</span>
                    <span className="service-card__meta">
                      <span>{formatDuration(service.duration_minutes)}</span>
                    </span>
                  </div>

                  <div className="actions" style={{ marginTop: '0.25rem' }}>
                    <Button size="sm" variant="ghost" onClick={() => void toggleActive(service)} loading={busyId === service.id}>
                      {service.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(service)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setRemoving(service)}
                      aria-label={`Delete ${service.name}`}
                    >
                      Delete
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {(creating || editing) && (
        <ServiceDialog
          service={editing}
          onClose={close}
          onSaved={(service, mode) => {
            upsertService(service)
            close()
            toast.success(
              mode === 'created' ? `${service.name} added` : `${service.name} updated`,
              mode === 'created' ? 'It is now part of the catalogue.' : 'Changes saved.',
            )
          }}
        />
      )}

      <Modal
        open={Boolean(removing)}
        title="Delete this service?"
        onClose={() => setRemoving(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)} disabled={busyId !== null}>
              Cancel
            </Button>
            <Button variant="danger" loading={busyId !== null} onClick={() => void confirmRemove()}>
              Delete service
            </Button>
          </>
        }
      >
        <p className="confirm__text">
          <strong>{removing?.name}</strong> will be removed from the catalogue. Appointments already
          booked against it are removed with it.
        </p>
      </Modal>
    </>
  )
}

const EMPTY: ServiceInput = {
  name: '',
  description: '',
  category: '',
  duration_minutes: 60,
  price: 0,
  is_active: true,
}

const CATEGORY_SUGGESTIONS = ['Hair', 'Skin', 'Nails', 'Makeup', 'Spa', 'Bridal']

interface DialogProps {
  service: Service | null
  onClose: () => void
  onSaved: (service: Service, mode: 'created' | 'updated') => void
}

function ServiceDialog({ service, onClose, onSaved }: DialogProps) {
  const [form, setForm] = useState<ServiceInput>(() =>
    service
      ? {
          name: service.name,
          description: service.description ?? '',
          category: service.category,
          duration_minutes: service.duration_minutes,
          price: Number(service.price),
          is_active: service.is_active,
        }
      : EMPTY,
  )
  const [errors, setErrors] = useState<Partial<Record<keyof ServiceInput, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof ServiceInput>(key: K, value: ServiceInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const validate = (): boolean => {
    const next: Partial<Record<keyof ServiceInput, string>> = {}
    if (!form.name.trim()) next.name = 'A service name is required.'
    if (!form.category.trim()) next.category = 'Choose or type a category.'
    if (!Number.isFinite(form.duration_minutes) || form.duration_minutes < 1)
      next.duration_minutes = 'Duration must be at least 1 minute.'
    if (!Number.isFinite(form.price) || form.price < 0) next.price = 'Price cannot be negative.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async () => {
    if (saving) return
    setFormError(null)
    if (!validate()) return

    const payload: ServiceInput = {
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category.trim(),
      duration_minutes: Number(form.duration_minutes),
      price: Number(form.price),
      is_active: form.is_active,
    }

    setSaving(true)
    try {
      const saved = service
        ? await serviceApi.update(service.id, payload)
        : await serviceApi.create(payload)
      onSaved(saved, service ? 'updated' : 'created')
    } catch (err) {
      setFormError(errorMessage(err, 'The service could not be saved.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      title={service ? 'Edit service' : 'New service'}
      subtitle={service ? `#${service.id} in the catalogue` : 'Add something the salon can book.'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void submit()} loading={saving}>
            {saving ? 'Saving' : service ? 'Save changes' : 'Add service'}
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
          label="Service name"
          className="span-2"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          error={errors.name}
          disabled={saving}
          placeholder="Hair Spa"
          autoComplete="off"
          required
        />
        <SelectField
          label="Category"
          value={CATEGORY_SUGGESTIONS.includes(form.category) ? form.category : form.category ? '__custom' : ''}
          onChange={(e) => set('category', e.target.value === '__custom' ? '' : e.target.value)}
          error={errors.category}
          disabled={saving}
          required
        >
          <option value="">Choose a category</option>
          {CATEGORY_SUGGESTIONS.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
          <option value="__custom">Other…</option>
        </SelectField>
        {form.category !== '' && !CATEGORY_SUGGESTIONS.includes(form.category) && (
          <TextField
            label="Category name"
            value={form.category}
            onChange={(e) => set('category', e.target.value)}
            disabled={saving}
            placeholder="e.g. Men's grooming"
          />
        )}
        <TextField
          label="Duration"
          type="number"
          min={1}
          step={5}
          value={form.duration_minutes}
          onChange={(e) => set('duration_minutes', Number(e.target.value))}
          error={errors.duration_minutes}
          disabled={saving}
          hint="In minutes"
          required
        />
        <TextField
          label="Price"
          type="number"
          min={0}
          step={50}
          value={form.price}
          onChange={(e) => set('price', Number(e.target.value))}
          error={errors.price}
          disabled={saving}
          hint="In rupees"
          required
        />
        <TextArea
          label="Description"
          className="span-2"
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          disabled={saving}
          placeholder="What the appointment includes."
        />
        <div className="field span-2">
          <span className="field__label">Availability</span>
          <div className="seg" role="group" aria-label="Availability">
            <button
              type="button"
              className={`seg__item ${form.is_active ? 'seg__item--on' : ''}`}
              aria-pressed={form.is_active}
              onClick={() => set('is_active', true)}
              disabled={saving}
            >
              Bookable
            </button>
            <button
              type="button"
              className={`seg__item ${!form.is_active ? 'seg__item--on' : ''}`}
              aria-pressed={!form.is_active}
              onClick={() => set('is_active', false)}
              disabled={saving}
            >
              Inactive
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
