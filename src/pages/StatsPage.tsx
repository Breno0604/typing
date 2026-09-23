import { useEffect, useMemo, useState } from 'react'
import type { SessionMode } from '../types/domain'
import { getAllResults } from '../storage/resultsRepo'
import type { TestResult } from '../types/domain'
import { StatsChart, type ChartPoint } from '../components/StatsChart'
import { Button } from '../components/ui/controls'

export function StatsPage({ onBack }: { onBack: () => void }) {
  const [results, setResults] = useState<TestResult[]>([])
  const [modeFilter, setModeFilter] = useState<SessionMode>('test')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    getAllResults().then((r) => {
      setResults(r)
      setLoaded(true)
    })
  }, [])

  const filtered = useMemo(() => results.filter((r) => r.mode === modeFilter), [results, modeFilter])

  const summary = useMemo(() => {
    if (filtered.length === 0) return null
    const wpms = filtered.map((r) => r.metrics.wpm)
    const accs = filtered.map((r) => r.metrics.accuracy)
    return {
      count: filtered.length,
      avgWpm: wpms.reduce((a, b) => a + b, 0) / wpms.length,
      bestWpm: Math.max(...wpms),
      avgAccuracy: accs.reduce((a, b) => a + b, 0) / accs.length,
    }
  }, [filtered])

  const chartPoints = useMemo<ChartPoint[]>(
    () =>
      [...filtered]
        .sort((a, b) => a.finishedAt - b.finishedAt)
        .slice(-20)
        .map((r) => ({ label: new Date(r.finishedAt).toLocaleDateString('pt-BR'), wpm: r.metrics.wpm, accuracy: r.metrics.accuracy })),
    [filtered],
  )

  return (
    <div>
      <div className="controls-bar">
        <h1 style={{ fontSize: 22, margin: 0 }}>Estatísticas de evolução</h1>
        <div className="controls-spacer" />
        <div className="field">
          <select
            className="select"
            aria-label="Filtrar por modo"
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value as SessionMode)}
          >
            <option value="test">Testes</option>
            <option value="practice">Treinos</option>
          </select>
        </div>
      </div>

      {!loaded ? (
        <p className="empty-state">Carregando…</p>
      ) : filtered.length === 0 ? (
        <div className="stats-panel">
          <p className="empty-state">
            Nenhum resultado {modeFilter === 'test' ? 'de teste' : 'de treino'} registrado ainda.
            Complete uma sessão para começar a acompanhar sua evolução.
          </p>
        </div>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">WPM médio</div>
              <div className="stat-value">{summary!.avgWpm.toLocaleString('pt-BR')}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Melhor WPM</div>
              <div className="stat-value">{summary!.bestWpm.toLocaleString('pt-BR')}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Precisão média</div>
              <div className="stat-value">{Math.round(summary!.avgAccuracy)}%</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">{modeFilter === 'test' ? 'Testes realizados' : 'Treinos realizados'}</div>
              <div className="stat-value">{summary!.count}</div>
            </div>
          </div>

          <div className="stats-panel">
            <h2 style={{ fontSize: 16, marginTop: 0 }}>Evolução (últimos {chartPoints.length} resultados)</h2>
            <StatsChart points={chartPoints} />
          </div>
        </>
      )}

      <div className="actions-row">
        <Button variant="primary" onClick={onBack}>
          Voltar
        </Button>
      </div>
    </div>
  )
}
