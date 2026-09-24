import type { AccentColorId, FontSizeId, Settings } from '../types/domain'
import type { GroqConfig } from '../types/domain'
import { DURATIONS, durationLabel } from '../logic/durations'
import { LEVELS } from '../logic/levels'
import { Dialog } from './ui/Dialog'
import { SelectControl, Switch } from './ui/controls'

const ACCENTS: { id: AccentColorId; label: string; color: string }[] = [
  { id: 'blue', label: 'Azul', color: '#4f7cff' },
  { id: 'green', label: 'Verde', color: '#3ecf74' },
  { id: 'purple', label: 'Roxo', color: '#9a6bff' },
  { id: 'orange', label: 'Laranja', color: '#ff9f43' },
  { id: 'pink', label: 'Rosa', color: '#ff6b9d' },
]

const FONT_SIZES: { id: FontSizeId; label: string }[] = [
  { id: 'small', label: 'Pequena' },
  { id: 'medium', label: 'Média' },
  { id: 'large', label: 'Grande' },
]

export function SettingsDialog(props: {
  open: boolean
  onClose: () => void
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
  groqConfig: GroqConfig
  onGroqChange: (patch: Partial<GroqConfig>) => void
}) {
  const s = props.settings
  return (
    <Dialog open={props.open} onClose={props.onClose} title="Configurações">
      <fieldset className="dialog-section">
        <legend className="dialog-legend">Aparência</legend>
        <div className="form-row">
          <label htmlFor="set-theme">Tema</label>
          <SelectControl
            id="set-theme"
            value={s.theme}
            onChange={(e) => props.onChange({ theme: e.target.value as Settings['theme'] })}
          >
            <option value="dark">Escuro</option>
            <option value="light">Claro</option>
          </SelectControl>
        </div>
        <div className="form-row">
          <label htmlFor="set-uifont">Tamanho da fonte da interface</label>
          <SelectControl
            id="set-uifont"
            value={s.uiFontSize}
            onChange={(e) => props.onChange({ uiFontSize: e.target.value as FontSizeId })}
          >
            {FONT_SIZES.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </SelectControl>
        </div>
        <div className="form-row">
          <label htmlFor="set-textfont">Tamanho do texto de digitação</label>
          <SelectControl
            id="set-textfont"
            value={s.typingFontSize}
            onChange={(e) => props.onChange({ typingFontSize: e.target.value as FontSizeId })}
          >
            {FONT_SIZES.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </SelectControl>
        </div>
        <div className="form-row">
          <span id="accent-label">Cor do destaque</span>
          <div role="group" aria-labelledby="accent-label" style={{ display: 'flex', gap: 8 }}>
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                aria-label={`Cor ${a.label}`}
                aria-pressed={s.accentColor === a.id}
                onClick={() => props.onChange({ accentColor: a.id })}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: a.color,
                  border: s.accentColor === a.id ? '3px solid var(--text)' : '2px solid transparent',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        </div>
        <div className="form-row">
          <span id="caret-label">Cor da letra a digitar</span>
          <div role="group" aria-labelledby="caret-label" style={{ display: 'flex', gap: 8 }}>
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                aria-label={`Cor da letra a digitar: ${a.label}`}
                aria-pressed={s.caretColor === a.id}
                onClick={() => props.onChange({ caretColor: a.id })}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: a.color,
                  border: s.caretColor === a.id ? '3px solid var(--text)' : '2px solid transparent',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        </div>
        <div className="form-row">
          <span id="caret-underline-label">Cor do sublinhado</span>
          <div role="group" aria-labelledby="caret-underline-label" style={{ display: 'flex', gap: 8 }}>
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                aria-label={`Cor do sublinhado: ${a.label}`}
                aria-pressed={s.caretUnderlineColor === a.id}
                onClick={() => props.onChange({ caretUnderlineColor: a.id })}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: a.color,
                  border: s.caretUnderlineColor === a.id ? '3px solid var(--text)' : '2px solid transparent',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        </div>
      </fieldset>

      <fieldset className="dialog-section">
        <legend className="dialog-legend">Áudio</legend>
        <div className="form-row">
          <label htmlFor="set-sound">Sons de tecla</label>
          <Switch
            checked={s.soundEnabled}
            onChange={(v) => props.onChange({ soundEnabled: v })}
            label="Sons de tecla"
          />
        </div>
        <div className="form-row">
          <label htmlFor="set-volume">Volume</label>
          <input
            id="set-volume"
            type="range"
            className="range"
            min={0}
            max={1}
            step={0.05}
            value={s.soundVolume}
            disabled={!s.soundEnabled}
            aria-label="Volume dos sons"
            onChange={(e) => props.onChange({ soundVolume: Number(e.target.value) })}
          />
        </div>
      </fieldset>

      <fieldset className="dialog-section">
        <legend className="dialog-legend">Teste</legend>
        <div className="form-row">
          <label htmlFor="set-mode">Modo padrão</label>
          <SelectControl
            id="set-mode"
            value={s.defaultMode}
            onChange={(e) => props.onChange({ defaultMode: e.target.value as Settings['defaultMode'] })}
          >
            <option value="test">Teste</option>
            <option value="practice">Treino</option>
          </SelectControl>
        </div>
        <div className="form-row">
          <label htmlFor="set-duration">Duração padrão</label>
          <SelectControl
            id="set-duration"
            value={s.defaultDuration}
            onChange={(e) => props.onChange({ defaultDuration: e.target.value as Settings['defaultDuration'] })}
          >
            {DURATIONS.map((d) => (
              <option key={d.id} value={d.id}>
                {durationLabel(d.id, s.defaultCustomDuration)}
              </option>
            ))}
            <option value="custom">Personalizado</option>
            <option value="unlimited">Sem limite</option>
          </SelectControl>
        </div>
        {s.defaultDuration === 'custom' && (
          <div className="form-row">
            <label htmlFor="set-custom">Segundos (personalizado)</label>
            <input
              id="set-custom"
              className="text-input"
              style={{ width: 110 }}
              type="number"
              min={1}
              max={3600}
              value={s.defaultCustomDuration}
              onChange={(e) => props.onChange({ defaultCustomDuration: Number(e.target.value) || 1 })}
            />
          </div>
        )}
        <div className="form-row">
          <label htmlFor="set-level">Nível padrão</label>
          <SelectControl
            id="set-level"
            value={s.defaultLevel}
            onChange={(e) => props.onChange({ defaultLevel: e.target.value as Settings['defaultLevel'] })}
          >
            {LEVELS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </SelectControl>
        </div>
      </fieldset>

      <fieldset className="dialog-section">
        <legend className="dialog-legend">IA (Groq)</legend>
        <div className="form-row">
          <label htmlFor="set-groqkey">Chave da API</label>
          <input
            id="set-groqkey"
            className="text-input"
            style={{ width: 280 }}
            type="password"
            autoComplete="off"
            placeholder="gsk_..."
            value={props.groqConfig.apiKey}
            onChange={(e) => props.onGroqChange({ apiKey: e.target.value })}
          />
        </div>
        <div className="form-row">
          <label htmlFor="set-groqmodel">Modelo</label>
          <input
            id="set-groqmodel"
            className="text-input"
            style={{ width: 280 }}
            type="text"
            value={props.groqConfig.model}
            onChange={(e) => props.onGroqChange({ model: e.target.value })}
          />
        </div>
        <p className="form-help">
          A chave fica armazenada apenas neste navegador (IndexedDB). A geração por IA é o
          único recurso que usa internet; todo o resto funciona offline.
        </p>
      </fieldset>
    </Dialog>
  )
}
