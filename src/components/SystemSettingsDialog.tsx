import type { AccentColorId, GroqConfig, LightCardBgId, Settings, ThemeId } from '../types/domain'
import { Dialog } from './ui/Dialog'
import { SelectControl } from './ui/controls'

const ACCENTS: { id: AccentColorId; label: string; color: string }[] = [
  { id: 'blue', label: 'Azul', color: '#4f7cff' },
  { id: 'green', label: 'Verde', color: '#3ecf74' },
  { id: 'slate', label: 'Grafite', color: '#64748b' },
  { id: 'orange', label: 'Laranja', color: '#ff9f43' },
  { id: 'pink', label: 'Rosa', color: '#ff6b9d' },
]

const FONT_SIZES: { id: Settings['uiFontSize']; label: string }[] = [
  { id: 'small', label: 'Pequena' },
  { id: 'medium', label: 'Média' },
  { id: 'large', label: 'Grande' },
]

const LIGHT_CARD_BGS: { id: LightCardBgId; label: string; color: string }[] = [
  { id: 'white', label: 'Branco', color: '#ffffff' },
  { id: 'default', label: 'Padrão', color: '#dde3f0' },
  { id: 'soft', label: 'Suave', color: '#eef2f9' },
  { id: 'cream', label: 'Creme', color: '#fbf7ec' },
  { id: 'mint', label: 'Menta', color: '#eaf7ef' },
]

function ColorPicker(props: {
  labelId: string
  label: string
  options: { id: string; label: string; color: string }[]
  value: string
  ariaPrefix: string
  onSelect: (id: string) => void
  selectedBorder?: string
}) {
  return (
    <div className="form-row">
      <span id={props.labelId}>{props.label}</span>
      <div role="group" aria-labelledby={props.labelId} style={{ display: 'flex', gap: 8 }}>
        {props.options.map((a) => (
          <button
            key={a.id}
            type="button"
            aria-label={`${props.ariaPrefix}: ${a.label}`}
            aria-pressed={props.value === a.id}
            onClick={() => props.onSelect(a.id)}
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: a.color,
              border: props.value === a.id ? '3px solid var(--text)' : props.selectedBorder ?? '2px solid transparent',
              cursor: 'pointer',
            }}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Modal de configurações do sistema: aparência, preferências gerais e
 * integração com IA — tudo que não pertence à sessão de digitação.
 */
export function SystemSettingsDialog(props: {
  open: boolean
  onClose: () => void
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
  groqConfig: GroqConfig
  onGroqChange: (patch: Partial<GroqConfig>) => void
}) {
  const s = props.settings
  return (
    <Dialog open={props.open} onClose={props.onClose} title="Configurações do sistema">
      <fieldset className="dialog-section">
        <legend className="dialog-legend">Aparência</legend>
        <div className="form-row">
          <label htmlFor="ss-theme">Tema</label>
          <SelectControl
            id="ss-theme"
            value={s.theme}
            onChange={(e) => props.onChange({ theme: e.target.value as ThemeId })}
          >
            <option value="dark">Escuro</option>
            <option value="light">Claro</option>
          </SelectControl>
        </div>
        <div className="form-row">
          <label htmlFor="ss-uifont">Fonte da interface</label>
          <SelectControl
            id="ss-uifont"
            value={s.uiFontSize}
            onChange={(e) => props.onChange({ uiFontSize: e.target.value as Settings['uiFontSize'] })}
          >
            {FONT_SIZES.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </SelectControl>
        </div>
        <ColorPicker
          labelId="ss-accent-label"
          label="Cor de destaque"
          ariaPrefix="Cor"
          options={ACCENTS}
          value={s.accentColor}
          onSelect={(id) => props.onChange({ accentColor: id as AccentColorId })}
        />
        <ColorPicker
          labelId="ss-caret-label"
          label="Cor da letra a digitar"
          ariaPrefix="Cor da letra a digitar"
          options={ACCENTS}
          value={s.caretColor}
          onSelect={(id) => props.onChange({ caretColor: id as AccentColorId })}
        />
        <ColorPicker
          labelId="ss-underline-label"
          label="Cor do sublinhado"
          ariaPrefix="Cor do sublinhado"
          options={ACCENTS}
          value={s.caretUnderlineColor}
          onSelect={(id) => props.onChange({ caretUnderlineColor: id as AccentColorId })}
        />
        <ColorPicker
          labelId="ss-cardbg-label"
          label="Fundo do card de digitação"
          ariaPrefix="Fundo do card"
          options={LIGHT_CARD_BGS}
          value={s.lightTypingCardBg}
          selectedBorder="2px solid var(--btn-border)"
          onSelect={(id) => props.onChange({ lightTypingCardBg: id as LightCardBgId })}
        />
        <p className="form-help">
          O fundo do card é aplicado no tema claro (padrão: branco). No tema escuro, o fundo
          permanece o padrão. Todas as opções mantêm bom contraste com o texto.
        </p>
      </fieldset>

      <fieldset className="dialog-section">
        <legend className="dialog-legend">IA (Groq)</legend>
        <div className="form-row">
          <label htmlFor="ss-groqkey">Chave da API</label>
          <input
            id="ss-groqkey"
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
          <label htmlFor="ss-groqmodel">Modelo</label>
          <input
            id="ss-groqmodel"
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
