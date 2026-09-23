import type { FinishReason, ResultMetrics } from '../types/domain'
import { formatElapsed } from '../hooks/useTimer'
import { Button } from './ui/controls'

const FINISH_LABELS: Record<FinishReason, string> = {
  'time-up': 'Tempo esgotado',
  'text-completed': 'Texto concluído',
  manual: 'Finalizado manualmente',
}

export function ResultCard(props: {
  metrics: ResultMetrics
  finishReason: FinishReason
  onNewTest: () => void
  onRetry: () => void
}) {
  const m = props.metrics
  return (
    <section className="result-card" aria-label="Resultado do teste">
      <h2 className="result-title">Resultados</h2>
      <p className="finish-reason">{FINISH_LABELS[props.finishReason]}</p>
      <div className="result-wpm" aria-live="assertive">
        {m.wpm.toLocaleString('pt-BR')}
        <small>WPM</small>
      </div>
      <dl className="result-grid">
        <dt>Precisão</dt>
        <dd>{formatPercent(m.accuracy)}</dd>
        <dt>Toques Líquidos</dt>
        <dd>{m.netKeystrokes}</dd>
        <dt>Toques Brutos</dt>
        <dd>{m.grossKeystrokes}</dd>
        <dt>Erros</dt>
        <dd>{m.errors}</dd>
        <dt>Correções</dt>
        <dd>{m.corrections}</dd>
        <dt>Toques Totais</dt>
        <dd>{m.totalKeystrokes}</dd>
        <dt>Palavras</dt>
        <dd>
          {m.wordsCompleted}/{m.wordsTotal}
        </dd>
        <dt>Caracteres</dt>
        <dd>
          {m.charsCorrect}/{m.charsTotal}
        </dd>
        <dt>Tempo Total</dt>
        <dd>{formatElapsed(m.elapsedMs)}</dd>
      </dl>
      <div className="result-actions">
        <Button variant="primary" onClick={props.onNewTest}>
          Novo teste
        </Button>
        <Button onClick={props.onRetry}>Repetir teste</Button>
      </div>
    </section>
  )
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`
}
