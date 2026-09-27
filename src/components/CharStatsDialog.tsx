import type { TestResult } from '../types/domain'
import { Dialog } from './ui/Dialog'
import { Button } from './ui/controls'

/**
 * Modal de estatísticas detalhadas de uma sessão: visão por caractere
 * (tentativas, erros, taxa de erro) e destaques dos caracteres mais problemáticos.
 */
export function CharStatsDialog({ result, onClose }: { result: TestResult; onClose: () => void }) {
  const charStats = result.metrics.charStats

  const worst = charStats?.filter((c) => c.errors > 0)[0] ?? null
  const lowestAccuracy = charStats
    ?.filter((c) => c.attempts > 0)
    .sort((a, b) => b.errors / b.attempts - a.errors / a.attempts)[0] ?? null
  const best = charStats
    ?.filter((c) => c.errors === 0)
    .sort((a, b) => b.attempts - a.attempts)[0] ?? null

  return (
    <Dialog open title="Detalhes da sessão" onClose={onClose}>
      <div className="char-stats-summary">
        <div>
          <strong>{result.metrics.wpm.toLocaleString('pt-BR')}</strong>
          <span>WPM</span>
        </div>
        <div>
          <strong>{Math.round(result.metrics.accuracy)}%</strong>
          <span>Precisão</span>
        </div>
        <div>
          <strong>{result.metrics.errors}</strong>
          <span>Erros</span>
        </div>
        <div>
          <strong>{result.metrics.correctedChars ?? '—'}</strong>
          <span>Corrigidos</span>
        </div>
        <div>
          <strong>{result.metrics.permanentErrors ?? '—'}</strong>
          <span>Permanentes</span>
        </div>
      </div>

      {charStats == null ? (
        <p className="empty-state">
          Sessões anteriores à atualização não possuem estatísticas por caractere.
        </p>
      ) : charStats.length === 0 ? (
        <p className="empty-state">Nenhum caractere digitado nesta sessão.</p>
      ) : (
        <>
          {(worst || best) && (
            <ul className="char-highlights">
              {worst && (
                <li>
                  Mais erros: <CharBadge {...worst} /> ({worst.errors} erro{worst.errors > 1 ? 's' : ''})
                </li>
              )}
              {lowestAccuracy && (
                <li>
                  Menor precisão: <CharBadge {...lowestAccuracy} /> ({formatPrecision(lowestAccuracy)})
                </li>
              )}
              {best && (
                <li>
                  Mais acertos: <CharBadge {...best} /> ({best.attempts} tentativa{best.attempts > 1 ? 's' : ''}, sem erro)
                </li>
              )}
            </ul>
          )}

          <table className="char-table">
            <thead>
              <tr>
                <th>Caractere</th>
                <th>Tentativas</th>
                <th>Erros</th>
                <th>Taxa de erro</th>
              </tr>
            </thead>
            <tbody>
              {charStats.map((c) => (
                <tr key={c.char} className={c.errors > 0 ? 'char-row-bad' : ''}>
                  <td className="char-cell">{displayChar(c.char)}</td>
                  <td>{c.attempts}</td>
                  <td>{c.errors}</td>
                  <td>{formatRate(c)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div className="actions-row">
        <Button variant="primary" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </Dialog>
  )
}

function CharBadge(props: { char: string }) {
  return <span className="char-badge">{displayChar(props.char)}</span>
}

function displayChar(char: string): string {
  if (char === ' ') return '␣ (espaço)'
  return char
}

function formatRate(entry: { attempts: number; errors: number }): string {
  if (entry.attempts === 0) return '—'
  return `${Math.round((entry.errors / entry.attempts) * 100)}%`
}

function formatPrecision(entry: { attempts: number; errors: number }): string {
  if (entry.attempts === 0) return '—'
  return `${Math.round(100 - (entry.errors / entry.attempts) * 100)}% de precisão`
}
