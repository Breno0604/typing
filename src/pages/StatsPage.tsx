import { useEffect, useMemo, useState } from 'react'
import { deleteResult, getAllResults } from '../storage/resultsRepo'
import type { TestResult } from '../types/domain'
import { StatsChart, type ChartPoint } from '../components/StatsChart'
import { CharStatsDialog } from '../components/CharStatsDialog'
import { Button } from '../components/ui/controls'
import { formatElapsed } from '../hooks/useTimer'

/**
 * Página Evolução: resumo consolidado (somente sessões válidas), gráfico,
 * histórico com exclusão individual e modal de detalhes por caractere.
 * Excluir uma sessão remove o registro; todos os indicadores recalculam sozinhos.
 */
export function StatsPage({ onBack }: { onBack: () => void }) {
  const [results, setResults] = useState<TestResult[]>([])
  const [loaded, setLoaded] = useState(false)
  const [detailResult, setDetailResult] = useState<TestResult | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => {
    getAllResults().then((r) => {
      setResults(r)
      setLoaded(true)
    })
  }, [])

  const summary = useMemo(() => {
    if (results.length === 0) return null
    const wpms = results.map((r) => r.metrics.wpm)
    const accs = results.map((r) => r.metrics.accuracy)
    return {
      count: results.length,
      avgWpm: wpms.reduce((a, b) => a + b, 0) / wpms.length,
      bestWpm: Math.max(...wpms),
      avgAccuracy: accs.reduce((a, b) => a + b, 0) / accs.length,
      totalChars: results.reduce((sum, r) => sum + r.metrics.charsCorrect, 0),
      totalErrors: results.reduce((sum, r) => sum + r.metrics.errors, 0),
      totalCorrected: results.reduce((sum, r) => sum + (r.metrics.correctedChars ?? 0), 0),
    }
  }, [results])

  const chartPoints = useMemo<ChartPoint[]>(
    () =>
      [...results]
        .sort((a, b) => a.finishedAt - b.finishedAt)
        .slice(-20)
        .map((r) => ({
          label: new Date(r.finishedAt).toLocaleDateString('pt-BR'),
          wpm: r.metrics.wpm,
          accuracy: r.metrics.accuracy,
        })),
    [results],
  )

  async function handleDelete(id: string) {
    setConfirmDeleteId(null)
    await deleteResult(id)
    setResults(await getAllResults())
  }

  return (
    <div>
      <div className="controls-bar">
        <h1 style={{ fontSize: 22, margin: 0 }}>Estatísticas de evolução</h1>
      </div>

      {!loaded ? (
        <p className="empty-state">Carregando…</p>
      ) : results.length === 0 ? (
        <div className="stats-panel">
          <p className="empty-state">
            Nenhum resultado registrado ainda.
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
              <div className="stat-label">Sessões realizadas</div>
              <div className="stat-value">{summary!.count}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Caracteres digitados</div>
              <div className="stat-value">{summary!.totalChars.toLocaleString('pt-BR')}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Erros totais</div>
              <div className="stat-value">{summary!.totalErrors.toLocaleString('pt-BR')}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Corrigidos totais</div>
              <div className="stat-value">{summary!.totalCorrected.toLocaleString('pt-BR')}</div>
            </div>
          </div>

          <div className="stats-panel">
            <h2 style={{ fontSize: 16, marginTop: 0 }}>Evolução (últimos {chartPoints.length} resultados)</h2>
            <StatsChart points={chartPoints} />
          </div>

          <div className="stats-panel">
            <h2 style={{ fontSize: 16, marginTop: 0 }}>Histórico de sessões</h2>
            <table className="history-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Texto</th>
                  <th>WPM</th>
                  <th>Precisão</th>
                  <th>Erros</th>
                  <th>Corrigidos</th>
                  <th>Tempo</th>
                  <th aria-label="Ações"></th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDateTime(r.finishedAt)}</td>
                    <td className="history-text" title={r.textTitle}>
                      {r.textTitle || '—'}
                    </td>
                    <td>{r.metrics.wpm.toLocaleString('pt-BR')}</td>
                    <td>{Math.round(r.metrics.accuracy)}%</td>
                    <td>{r.metrics.errors}</td>
                    <td>{r.metrics.correctedChars ?? '—'}</td>
                    <td>{formatElapsed(r.metrics.elapsedMs)}</td>
                    <td>
                      <div className="history-actions">
                        {r.metrics.charStats != null && (
                          <button
                            className="btn btn-small"
                            onClick={() => setDetailResult(r)}
                            aria-label={`Ver detalhes da sessão de ${formatDateTime(r.finishedAt)}`}
                          >
                            Detalhes
                          </button>
                        )}
                        {confirmDeleteId === r.id ? (
                          <>
                            <button className="btn btn-small btn-danger" onClick={() => handleDelete(r.id)}>
                              Confirmar
                            </button>
                            <button className="btn btn-small" onClick={() => setConfirmDeleteId(null)}>
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <button
                            className="btn btn-small btn-danger"
                            onClick={() => setConfirmDeleteId(r.id)}
                            aria-label={`Excluir sessão de ${formatDateTime(r.finishedAt)}`}
                          >
                            Excluir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="actions-row">
        <Button variant="primary" onClick={onBack}>
          Voltar
        </Button>
      </div>

      {detailResult && <CharStatsDialog result={detailResult} onClose={() => setDetailResult(null)} />}
    </div>
  )
}

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
