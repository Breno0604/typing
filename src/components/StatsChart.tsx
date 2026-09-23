import { useMemo } from 'react'

export interface ChartPoint {
  label: string
  wpm: number
  accuracy: number
}

/** Gráfico de evolução em SVG puro (WPM e precisão ao longo dos testes). */
export function StatsChart({ points }: { points: ChartPoint[] }) {
  const W = 640
  const H = 220
  const PAD = { top: 16, right: 16, bottom: 28, left: 40 }

  const { wpmPath, accPath, wpmMax, ticks } = useMemo(() => {
    const n = points.length
    const wpmMax = Math.max(10, ...points.map((p) => p.wpm)) * 1.1
    const innerW = W - PAD.left - PAD.right
    const innerH = H - PAD.top - PAD.bottom
    const x = (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW)
    const yWpm = (v: number) => PAD.top + innerH - (v / wpmMax) * innerH
    const yAcc = (v: number) => PAD.top + innerH - (v / 100) * innerH

    const wpmPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${yWpm(p.wpm).toFixed(1)}`).join(' ')
    const accPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${yAcc(p.accuracy).toFixed(1)}`).join(' ')

    const ticks = [0, 0.5, 1].map((f) => ({
      y: PAD.top + innerH - f * innerH,
      label: Math.round(f * wpmMax),
    }))

    return { wpmPath, accPath, wpmMax, ticks }
  }, [points])

  if (points.length === 0) return null

  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Evolução de WPM e precisão" style={{ width: '100%', height: 'auto' }}>
        {ticks.map((t) => (
          <g key={t.y}>
            <line x1={PAD.left} x2={W - PAD.right} y1={t.y} y2={t.y} stroke="var(--panel-border)" strokeWidth="1" />
            <text x={PAD.left - 8} y={t.y + 4} textAnchor="end" fontSize="11" fill="var(--text-faint)">
              {t.label}
            </text>
          </g>
        ))}
        <path d={accPath} fill="none" stroke="var(--correct)" strokeWidth="2" strokeDasharray="5 4" />
        <path d={wpmPath} fill="none" stroke="var(--accent)" strokeWidth="2.5" />
        {points.map((p, i) => {
          const n = points.length
          const innerW = W - PAD.left - PAD.right
          const x = PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW)
          const y = PAD.top + (H - PAD.top - PAD.bottom) - (p.wpm / wpmMax) * (H - PAD.top - PAD.bottom)
          return <circle key={i} cx={x} cy={y} r="3.5" fill="var(--accent)" />
        })}
        <text x={W - PAD.right} y={12} textAnchor="end" fontSize="11" fill="var(--accent)">
          WPM
        </text>
        <text x={W - PAD.right} y={26} textAnchor="end" fontSize="11" fill="var(--correct)">
          Precisão
        </text>
      </svg>
    </figure>
  )
}
