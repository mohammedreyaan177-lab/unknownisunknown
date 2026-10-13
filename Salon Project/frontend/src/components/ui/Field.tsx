import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

interface BaseProps {
  label: string
  hint?: ReactNode
  error?: string | null
  required?: boolean
  className?: string
}

/** Joins the hint/error ids so a control can point at whatever it rendered. */
function describedBy(id: string, hint: ReactNode, error?: string | null): string | undefined {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean)
  return ids.length ? ids.join(' ') : undefined
}

function Shell({
  id,
  label,
  hint,
  error,
  required,
  className = '',
  children,
}: BaseProps & { id: string; children: (props: { describedBy?: string }) => ReactNode }) {
  return (
    <div className={`field ${error ? 'field--invalid' : ''} ${className}`.trim()}>
      <label className="field__label" htmlFor={id}>
        {label}
        {required && (
          <span className="field__req" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children({ describedBy: describedBy(id, hint, error) })}
      {hint && (
        <span className="field__hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field__error" id={`${id}-error`} role="alert">
          {error}
        </span>
      )}
    </div>
  )
}

interface TextFieldProps extends BaseProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  type?: string
}

export function TextField({ label, hint, error, required, type = 'text', className, ...rest }: TextFieldProps) {
  const id = useId()
  return (
    <Shell id={id} label={label} hint={hint} error={error} required={required} className={className}>
      {({ describedBy: desc }) => (
        <input
          id={id}
          type={type}
          className="field__control"
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={desc}
          {...rest}
        />
      )}
    </Shell>
  )
}

interface SelectFieldProps extends BaseProps, Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> {
  placeholder?: string
  children: ReactNode
}

export function SelectField({
  label,
  hint,
  error,
  required,
  placeholder,
  className,
  children,
  ...rest
}: SelectFieldProps) {
  const id = useId()
  return (
    <Shell id={id} label={label} hint={hint} error={error} required={required} className={className}>
      {({ describedBy: desc }) => (
        <select
          id={id}
          className="field__control"
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={desc}
          {...rest}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {children}
        </select>
      )}
    </Shell>
  )
}

type TextAreaProps = BaseProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'>

export function TextArea({ label, hint, error, required, className, ...rest }: TextAreaProps) {
  const id = useId()
  return (
    <Shell id={id} label={label} hint={hint} error={error} required={required} className={className}>
      {({ describedBy: desc }) => (
        <textarea
          id={id}
          className="field__control"
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={desc}
          {...rest}
        />
      )}
    </Shell>
  )
}
