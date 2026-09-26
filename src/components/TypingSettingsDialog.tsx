import type { DurationId, SessionMode } from '../types/domain'
import { DURATIONS, durationLabel, MAX_CUSTOM_SECONDS, MIN_CUSTOM_SECONDS } from '../logic/durations'
import { Dialog } from './ui/Dialog'
import { Button, SelectControl, Switch } from './ui/controls'
import { IconFileText, IconSparkles } from './ui/Icons'

/**
 * Modal de configurações da digitação: reúne apenas o que altera a
 * experiência ou o comportamento da sessão (modo, duração, fonte do
 * texto, sons) e o acesso a textos próprios e IA.
 */
export function TypingSettingsDialog(props: {
  open: boolean
  onClose: () => void
  mode: SessionMode
  onModeChange: (m: SessionMode) => void
  durationId: DurationId
  onDurationChange: (d: DurationId) => void
  customSeconds: number
  onCustomSecondsChange: (s: number) => void
  typingFontSize: 'small' | 'medium' | 'large'
  onTypingFontSizeChange: (s: 'small' | 'medium' | 'large') => void
  soundEnabled: boolean
  onSoundEnabledChange: (v: boolean) => void
  soundVolume: number
  onSoundVolumeChange: (v: number) => void
  userTextsCount: number
  onOpenTexts: () => void
  onOpenAi: () => void
}) {
  return (
    <Dialog open={props.open} onClose={props.onClose} title="Configurações da digitação">
      <fieldset className="dialog-section">
        <legend className="dialog-legend">Sessão</legend>
        <div className="form-row">
          <label htmlFor="ts-mode">Modo</label>
          <SelectControl
            id="ts-mode"
            value={props.mode}
            onChange={(e) => props.onModeChange(e.target.value as SessionMode)}
          >
            <option value="test">Teste</option>
            <option value="practice">Treino</option>
          </SelectControl>
        </div>
        {props.mode === 'test' && (
          <>
            <div className="form-row">
              <label htmlFor="ts-duration">Duração</label>
              <SelectControl
                id="ts-duration"
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
            </div>
            {props.durationId === 'custom' && (
              <div className="form-row">
                <label htmlFor="ts-custom">Segundos</label>
                <input
                  id="ts-custom"
                  className="text-input"
                  style={{ width: 110 }}
                  type="number"
                  min={MIN_CUSTOM_SECONDS}
                  max={MAX_CUSTOM_SECONDS}
                  value={props.customSeconds}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    if (Number.isFinite(n) && n >= MIN_CUSTOM_SECONDS) props.onCustomSecondsChange(n)
                  }}
                />
              </div>
            )}
          </>
        )}
        <div className="form-row">
          <label htmlFor="ts-textfont">Tamanho do texto</label>
          <SelectControl
            id="ts-textfont"
            value={props.typingFontSize}
            onChange={(e) => props.onTypingFontSizeChange(e.target.value as 'small' | 'medium' | 'large')}
          >
            <option value="small">Pequena</option>
            <option value="medium">Média</option>
            <option value="large">Grande</option>
          </SelectControl>
        </div>
      </fieldset>

      <fieldset className="dialog-section">
        <legend className="dialog-legend">Sons</legend>
        <div className="form-row">
          <label htmlFor="ts-sound">Sons de tecla</label>
          <Switch
            checked={props.soundEnabled}
            onChange={props.onSoundEnabledChange}
            label="Sons de tecla"
          />
        </div>
        <div className="form-row">
          <label htmlFor="ts-volume">Volume</label>
          <input
            id="ts-volume"
            type="range"
            className="range"
            min={0}
            max={1}
            step={0.05}
            value={props.soundVolume}
            disabled={!props.soundEnabled}
            aria-label="Volume dos sons"
            onChange={(e) => props.onSoundVolumeChange(Number(e.target.value))}
          />
        </div>
      </fieldset>

      <fieldset className="dialog-section">
        <legend className="dialog-legend">Textos e IA</legend>
        <div className="form-row">
          <span>
            Meus textos
            <span className="form-help">
              {props.userTextsCount > 0
                ? `${props.userTextsCount} ${props.userTextsCount === 1 ? 'texto salvo' : 'textos salvos'} neste navegador`
                : 'Nenhum texto salvo ainda'}
            </span>
          </span>
          <Button onClick={props.onOpenTexts}>
            <IconFileText size={18} /> Gerenciar
          </Button>
        </div>
        <div className="form-row">
          <span>
            Gerar com IA
            <span className="form-help">Cria um texto novo a partir de um tema (requer internet)</span>
          </span>
          <Button onClick={props.onOpenAi}>
            <IconSparkles size={18} /> Gerar
          </Button>
        </div>
      </fieldset>
    </Dialog>
  )
}
