import { useMemo, useState } from 'react'
import { errorMessage } from '../../context/AuthContext'
import { useSalonData } from '../../context/SalonDataContext'
import { staffApi } from '../../lib/api'
import { formatMediumDate, initials, pluralize } from '../../lib/format'
import { staffNameOf } from '../../lib/staffName'
import type { Staff, StaffCreateInput, StaffUpdateInput } from '../../types'
import { ActiveBadge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { TextField } from '../ui/Field'
import { Modal } from '../ui/Modal'
import { PageHeader } from '../ui/PageHeader'
import { SearchInput } from '../ui/SearchInput'
import { EmptyState, ErrorState, InlineAlert, Skeleton } from '../ui/States'
import { useToast } from '../ui/Toast'

export function StaffPage() {
  const { staff, loading, error, staffRestricted, refresh, upsertStaff } = useSalonData()
  const toast = useToast()

  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Staff | null>(null)
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return staff
    return staff.filter((member) =>
      [staffNameOf(member), member.name ?? '', member.email ?? '', member.specialization ?? '', member.phone ?? ''].some(
        (value) => value.toLowerCase().includes(needle),
      ),
    )
  }, [staff, query])

  const close = () => {
    setEditing(null)
    setCreating(false)
  }

  const toggleActive = async (member: Staff) => {
    if (busyId !== null) return
    setBusyId(member.id)
    try {
      const saved = await staffApi.update(member.id, {
        name: member.name ?? '',
        email: member.email ?? '',
        phone: member.phone ?? '',
        specialization: member.specialization ?? '',
        is_active: !member.is_active,
      })
      upsertStaff({ ...member, ...saved })
      toast.success(
        saved.is_active ? `${staffNameOf(saved)} is active` : `${staffNameOf(saved)} marked inactive`,
        saved.is_active ? 'Available for new bookings.' : 'Hidden from new bookings.',
      )
    } catch (err) {
      toast.error('Could not update the staff member', errorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="The team"
        title="Staff"
        note={
          staff.length
            ? `${staff.filter((m) => m.is_active).length} of ${staff.length} ${pluralize(staff.length, 'member')} on the floor.`
            : 'Stylists and specialists on the floor.'
        }
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            New staff
          </Button>
        }
      />

      {staffRestricted ? (
        <div className="panel">
          <EmptyState
            title="Staff records are admin-only"
            text="The staff endpoints require an administrator token. Sign in with an admin account to view and manage the team."
          />
        </div>
      ) : error ? (
        <div className="panel">
          <ErrorState message={error} onRetry={() => void refresh()} />
        </div>
      ) : (
        <>
          <div className="toolbar">
            <label className="visually-hidden" htmlFor="staff-search">
              Search staff
            </label>
            <SearchInput
              id="staff-search"
              value={query}
              onChange={setQuery}
              placeholder="Search name, specialisation or phone"
            />
            <span className="result-count">{loading ? 'Loading' : `${visible.length} shown`}</span>
          </div>

          <div className="tablewrap">
            {loading ? (
              <Skeleton rows={4} />
            ) : visible.length === 0 ? (
              <EmptyState
                title={query ? 'No staff match that search' : 'No staff records yet'}
                text={
                  query
                    ? 'Try a different name, specialisation or phone number.'
                    : 'Add the first team member so appointments can be assigned.'
                }
                action={
                  query ? (
                    <Button variant="outline" onClick={() => setQuery('')}>
                      Clear search
                    </Button>
                  ) : (
                    <Button variant="accent" onClick={() => setCreating(true)}>
                      New staff
                    </Button>
                  )
                }
              />
            ) : (
              <div className="tablescroll">
                <table className="data">
                  <caption className="visually-hidden">{visible.length} staff records</caption>
                  <thead>
                    <tr>
                      <th scope="col">Staff</th>
                      <th scope="col">Specialisation</th>
                      <th scope="col">Phone</th>
                      <th scope="col">Joined</th>
                      <th scope="col">Status</th>
                      <th scope="col">
                        <span className="visually-hidden">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((member) => (
                        <tr key={member.id}>
                          <td data-label="">
                            <span className="cellname">
                            <span className="avatar" aria-hidden="true">
                              {member.name ? initials(member.name) : '#'}
                            </span>
                            <span className="cellname__text">
                              <span className="cellname__title">{staffNameOf(member)}</span>
                              <span className="cellname__sub">
                                {member.email ?? `User #${member.user_id}`}
                              </span>
                            </span>
                          </span>
                        </td>
                        <td className="muted" data-label="Specialisation">
                          {member.specialization || '—'}
                        </td>
                        <td className="num" data-label="Phone">
                          {member.phone || '—'}
                        </td>
                        <td className="muted" data-label="Joined">
                          {formatMediumDate(member.created_at.slice(0, 10))}
                        </td>
                        <td data-label="Status">
                          <ActiveBadge active={member.is_active} />
                        </td>
                        <td className="actions-cell" data-label="">
                          <div className="actions">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => void toggleActive(member)}
                              loading={busyId === member.id}
                            >
                              {member.is_active ? 'Deactivate' : 'Activate'}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditing(member)}>
                              Edit
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {(creating || editing) && (
        <StaffDialog
          staff={editing}
          onClose={close}
          onSaved={(member, mode) => {
            upsertStaff({ ...member })
            close()
            toast.success(
              mode === 'created' ? 'Staff account created' : 'Staff record updated',
              mode === 'created' ? 'They can now be assigned to appointments.' : 'Changes saved.',
            )
          }}
        />
      )}
    </>
  )
}

interface DialogProps {
  staff: Staff | null
  onClose: () => void
  onSaved: (staff: Staff, mode: 'created' | 'updated') => void
}

function StaffDialog({ staff, onClose, onSaved }: DialogProps) {
  const [name, setName] = useState(staff?.name ?? '')
  const [email, setEmail] = useState(staff?.email ?? '')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState(staff?.phone ?? '')
  const [specialization, setSpecialization] = useState(staff?.specialization ?? '')
  const [isActive, setIsActive] = useState(staff?.is_active ?? true)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = 'A name is required.'
    if (!email.trim()) next.email = 'An email address is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = 'Enter a valid email address.'
    if (!staff && password.length < 6) next.password = 'Use at least 6 characters.'
    if (!phone.trim()) next.phone = 'A phone number is required.'
    if (!specialization.trim()) next.specialization = 'A specialisation is required.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async () => {
    if (saving) return
    setFormError(null)
    if (!validate()) return

    setSaving(true)
    try {
      if (staff) {
        const payload: StaffUpdateInput = {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          specialization: specialization.trim(),
          is_active: isActive,
        }
        const updated = await staffApi.update(staff.id, payload)
        onSaved({ ...staff, ...updated, name: payload.name, email: payload.email }, 'updated')
      } else {
        const payload: StaffCreateInput = {
          name: name.trim(),
          email: email.trim(),
          password,
          phone: phone.trim(),
          specialization: specialization.trim(),
        }
        const created = await staffApi.create(payload)
        onSaved({ ...created, name: payload.name, email: payload.email }, 'created')
      }
    } catch (err) {
      setFormError(errorMessage(err, 'The staff record could not be saved.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      title={staff ? 'Edit staff' : 'New staff'}
      subtitle={
        staff
          ? `Staff #${staff.id} · user #${staff.user_id}`
          : 'Creates a login account and a staff record together.'
      }
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void submit()} loading={saving}>
            {saving ? 'Saving' : staff ? 'Save changes' : 'Create staff'}
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
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          disabled={saving}
          autoComplete="off"
          required
        />
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          disabled={saving}
          autoComplete="off"
          required
        />
        {!staff && (
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            disabled={saving}
            autoComplete="new-password"
            hint="At least 6 characters"
            required
          />
        )}
        <TextField
          label="Phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={errors.phone}
          disabled={saving}
          autoComplete="off"
          required
        />
        <TextField
          label="Specialisation"
          value={specialization}
          onChange={(e) => setSpecialization(e.target.value)}
          error={errors.specialization}
          disabled={saving}
          placeholder="Hair Stylist"
          autoComplete="off"
          required
        />
        {staff && (
          <div className="field">
            <span className="field__label">Availability</span>
            <div className="seg" role="group" aria-label="Availability">
              <button
                type="button"
                className={`seg__item ${isActive ? 'seg__item--on' : ''}`}
                aria-pressed={isActive}
                onClick={() => setIsActive(true)}
                disabled={saving}
              >
                Active
              </button>
              <button
                type="button"
                className={`seg__item ${!isActive ? 'seg__item--on' : ''}`}
                aria-pressed={!isActive}
                onClick={() => setIsActive(false)}
                disabled={saving}
              >
                Inactive
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
