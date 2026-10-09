import type { ButtonHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

export function Field(props: { label: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={props.htmlFor}>
        {props.label}
      </label>
      {props.children}
    </div>
  )
}

export function SelectControl(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="select" {...props} />
}

export function Switch(props: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked}
      aria-label={props.label}
      className="switch"
      onClick={() => props.onChange(!props.checked)}
    >
      <span className="switch-knob" />
    </button>
  )
}

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' }) {
  const { variant = 'default', className, ...rest } = props
  return <button className={`btn ${variant === 'primary' ? 'btn-primary' : ''} ${className ?? ''}`} {...rest} />
}

export function ToggleRow(props: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
}) {
  return (
    <label className="toggle-row">
      <span className="toggle-row-text">
        <span className="toggle-row-label">{props.label}</span>
        {props.description && <span className="toggle-row-desc">{props.description}</span>}
      </span>
      <Switch checked={props.checked} onChange={props.onChange} label={props.label} />
    </label>
  )
}
