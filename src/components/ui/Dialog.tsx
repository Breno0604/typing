import { useEffect, useRef, type ReactNode } from 'react'

export function Dialog(props: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!props.open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [props.open, props])

  if (!props.open) return null

  return (
    <div className="dialog-overlay" onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={props.title} ref={ref}>
        <h2 className="dialog-title">{props.title}</h2>
        {props.children}
      </div>
    </div>
  )
}
