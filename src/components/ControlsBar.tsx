import type { DurationId, LevelId, SessionMode, ThemeId } from '../types/domain'
import { DURATIONS, durationLabel, MAX_CUSTOM_SECONDS, MIN_CUSTOM_SECONDS } from '../logic/durations'
import { LEVELS } from '../logic/levels'
import { formatClock } from '../hooks/useTimer'
import { Field, SelectControl } from './ui/controls'
import { IconMoon, IconSun, IconVolumeOff, IconVolumeOn } from './ui/Icons'

export interface ControlsBarProps {
  mode: SessionMode
  onModeChange: (m: SessionMode) => void
  durationId: DurationId
  onDurationChange: (d: DurationId) => void
  customSeconds: number
  onCustomSecondsChange: (s: number) => void
  level: LevelId
  onLevelChange: (l: LevelId) => void
  clockMs: number
  duration: number | null
  soundEnabled: boolean
  onToggleSound: () => void
  theme: ThemeId
  onToggleTheme: () => void
  finished: boolean
}

export function ControlsBar(props: ControlsBarProps) {
  const remaining = props.duration != null ? Math.max(props.duration * 1000 - props.clockMs, 0) : props.clockMs
  const warn = props.duration != null && remaining <= 5000
  const clockLabel = props.duration != null ? formatClock(remaining) : formatClock(props.clockMs)

  return (
    <div className="controls-bar">
      <Field label="Modo">
        <SelectControl
          aria-label="Modo"
          value={props.mode}
          onChange={(e) => props.onModeChange(e.target.value as SessionMode)}
        >
          <option value="test">Teste</option>
          <option value="practice">Treino</option>
        </SelectControl>
      </Field>

      {props.mode === 'test' && (
        <Field label="Duração">
          <SelectControl
            aria-label="Duração"
            value={props.durationId}
            onChange={(e) => props.onDurationChange(e.target.value as DurationId)}
          >
            {DURATIONS.map((d) => (
              <option key={d.id} value={d.id}>
                {durationLabel(d.id, props.customSeconds)}
              </option>
            ))}
            <option value="custom">Personalizado</option>
            <option value="unlimited">Sem limite</option>
          </SelectControl>
        </Field>
      )}

      {props.mode === 'test' && props.durationId === 'custom' && (
        <Field label="Segundos">
          <SelectControl
            aria-label="Segundos personalizados"
            value={props.customSeconds}
            onChange={(e) => props.onCustomSecondsChange(Number(e.target.value))}
          >
            {buildCustomOptions(props.customSeconds).map((s) => (
              <option key={s} value={s}>
                {s}s
              </option>
            ))}
          </SelectControl>
        </Field>
      )}

      <Field label="Nível">
        <SelectControl
          aria-label="Nível"
          value={props.level}
          onChange={(e) => props.onLevelChange(e.target.value as LevelId)}
        >
          {LEVELS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </SelectControl>
      </Field>

      <div className="controls-spacer" />

      <button
        type="button"
        className="btn btn-icon"
        aria-label={props.soundEnabled ? 'Desativar sons' : 'Ativar sons'}
        aria-pressed={props.soundEnabled}
        onClick={props.onToggleSound}
      >
        {props.soundEnabled ? <IconVolumeOn /> : <IconVolumeOff />}
      </button>

      <button
        type="button"
        className="btn btn-icon"
        aria-label={props.theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
        onClick={props.onToggleTheme}
      >
        {props.theme === 'dark' ? <IconSun /> : <IconMoon />}
      </button>

      <div className="timer" role="timer" aria-live="off" data-warn={warn}>
        {clockLabel}
      </div>
    </div>
  )
}

/** Opções em torno do valor personalizado atual. */
function buildCustomOptions(current: number): number[] {
  const set = new Set<number>([15, 30, 45, 60, 90, 120, current])
  set.add(Math.min(Math.max(current - 5, MIN_CUSTOM_SECONDS), MAX_CUSTOM_SECONDS))
  set.add(current + 5)
  return [...set].sort((a, b) => a - b)
}
