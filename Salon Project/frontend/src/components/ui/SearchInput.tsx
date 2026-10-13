interface SearchInputProps {
  id: string
  value: string
  onChange: (value: string) => void
  placeholder: string
}

export function SearchInput({ id, value, onChange, placeholder }: SearchInputProps) {
  return (
    <div className="search">
      <svg
        className="search__icon"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <circle cx="7" cy="7" r="4.6" />
        <path d="M10.6 10.6L14 14" strokeLinecap="round" />
      </svg>
      <input
        id={id}
        type="search"
        className="field__control"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}
