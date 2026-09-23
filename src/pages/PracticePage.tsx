import { useEffect, useMemo, useRef, useState } from 'react'
import type { DurationId, LevelId, SessionMode, TextEntry } from '../types/domain'
import { durationSeconds } from '../logic/durations'
import { buildAllTexts } from '../storage/seed'
import { useTestSession } from '../hooks/useTestSession'
import { ControlsBar } from '../components/ControlsBar'
import { TypingArea } from '../components/TypingArea'
import { ResultCard } from '../components/ResultCard'
import { AiGeneratePanel } from '../components/AiGeneratePanel'
import { TextsManager } from '../components/TextsManager'
import { SettingsDialog } from '../components/SettingsDialog'
import { Button, Field, SelectControl } from '../components/ui/controls'
import { IconFileText, IconKeyboard, IconSettings } from '../components/ui/Icons'
import { levelLabel } from '../logic/levels'
import type { GroqConfig, Settings } from '../types/domain'
import { useUserTexts } from '../hooks/useUserTexts'

export interface PracticePageProps {
  settings: Settings
  onSettingsChange: (patch: Partial<Settings>) => void
  groqConfig: GroqConfig
  onGroqChange: (patch: Partial<GroqConfig>) => void
  onOpenStats: () => void
}

export function PracticePage(props: PracticePageProps) {
  const { settings } = props
  const userTexts = useUserTexts()

  const [mode, setMode] = useState<SessionMode>(settings.defaultMode)
  const [durationId, setDurationId] = useState<DurationId>(settings.defaultDuration)
  const [customSeconds, setCustomSeconds] = useState(settings.defaultCustomDuration)
  const [level, setLevel] = useState<LevelId>(settings.defaultLevel)
  const [textFilter, setTextFilter] = useState<'all' | 'preset' | 'user'>('all')

  const [showSettings, setShowSettings] = useState(false)
  const [showTexts, setShowTexts] = useState(false)
  const [showAi, setShowAi] = useState(false)

  const allTexts = useMemo(() => buildAllTexts(userTexts.texts), [userTexts.texts])
  const availableTexts = useMemo(
    () => (textFilter === 'all' ? allTexts : allTexts.filter((t) => t.source === textFilter)),
    [allTexts, textFilter],
  )
  const levelTexts = useMemo(
    () => availableTexts.filter((t) => t.level === level),
    [availableTexts, level],
  )

  const [currentText, setCurrentText] = useState<TextEntry | null>(null)

  // Escolhe texto do nível selecionado; reage a mudanças de nível/fonte.
  useEffect(() => {
    const pool = levelTexts.length > 0 ? levelTexts : availableTexts
    if (pool.length === 0) {
      setCurrentText(null)
      return
    }
    setCurrentText((prev) => {
      const inPool = prev && pool.some((t) => t.id === prev.id)
      if (inPool) return prev
      return pool[Math.floor(Math.random() * pool.length)]
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, textFilter, allTexts])

  const duration = mode === 'practice' ? null : durationSeconds(durationId, customSeconds)

  const session = useTestSession({
    mode,
    text: currentText,
    duration,
    soundEnabled: settings.soundEnabled,
    soundVolume: settings.soundVolume,
  })

  // Captura global de teclado na página de prática.
  const keyHandlerRef = useRef(session.handleKeyDown)
  keyHandlerRef.current = session.handleKeyDown

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Não capturar enquanto um diálogo estiver aberto.
      if (document.querySelector('.dialog-overlay')) return
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (e.key === 'Tab' || e.key === 'Escape') return
      keyHandlerRef.current(e)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const newTest = () => {
    const pool = levelTexts.length > 0 ? levelTexts : availableTexts
    if (pool.length > 0) {
      const candidates = pool.length > 1 ? pool.filter((t) => t.id !== currentText?.id) : pool
      setCurrentText(candidates[Math.floor(Math.random() * candidates.length)])
    }
    session.reset()
  }

  const FONT_SCALE = { small: 0.85, medium: 1, large: 1.2 } as const
  const typingFontSize = 26 * FONT_SCALE[settings.typingFontSize]

  return (
    <div style={{ '--typing-font-size': `${typingFontSize}px` } as React.CSSProperties}>
      <ControlsBar
        mode={mode}
        onModeChange={setMode}
        durationId={durationId}
        onDurationChange={setDurationId}
        customSeconds={customSeconds}
        onCustomSecondsChange={setCustomSeconds}
        level={level}
        onLevelChange={setLevel}
        clockMs={session.clockMs}
        duration={duration}
        soundEnabled={settings.soundEnabled}
        onToggleSound={() => props.onSettingsChange({ soundEnabled: !settings.soundEnabled })}
        theme={settings.theme}
        onToggleTheme={() => props.onSettingsChange({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
        finished={session.finished}
      />

      <div className="controls-bar" style={{ marginBottom: 10 }}>
        <Field label="Fonte do texto">
          <SelectControl
            aria-label="Fonte do texto"
            value={textFilter}
            onChange={(e) => setTextFilter(e.target.value as typeof textFilter)}
          >
            <option value="all">Todas</option>
            <option value="preset">Predefinidos</option>
            <option value="user">Meus textos / IA</option>
          </SelectControl>
        </Field>
        <span className="ai-badge" title={currentText?.title}>
          {currentText ? `${currentText.title} · ${levelLabel(currentText.level)}` : 'Nenhum texto disponível'}
        </span>
        {currentText?.generatedByAi && (
          <span className="ai-badge">
            <IconKeyboard size={13} /> Gerado por IA
          </span>
        )}
        <div className="controls-spacer" />
        <Button className="btn-icon" aria-label="Meus textos" title="Meus textos" onClick={() => setShowTexts(true)}>
          <IconFileText />
        </Button>
        <Button className="btn-icon" aria-label="Gerar com IA" title="Gerar com IA" onClick={() => setShowAi(true)}>
          ✦
        </Button>
        <Button className="btn-icon" aria-label="Configurações" title="Configurações" onClick={() => setShowSettings(true)}>
          <IconSettings />
        </Button>
      </div>

      <div className="typing-card">
        {session.finished && session.finishedMetrics ? (
          <ResultCard
            metrics={session.finishedMetrics}
            finishReason={session.session.finishReason ?? 'manual'}
            onNewTest={newTest}
            onRetry={session.reset}
          />
        ) : (
          <>
            <TypingArea session={session.session} active={!session.finished} />
            <div className="typing-hint">
              {session.idle
                ? 'Digite o primeiro caractere para iniciar…'
                : mode === 'practice'
                  ? 'Modo treino — sem limite de tempo. Clique em Finalizar para encerrar.'
                  : null}
              {duration != null && <span>Limite: {duration}s</span>}
            </div>
          </>
        )}
      </div>

      {!session.finished && (
        <>
          <div className="progress-row" aria-live="off">
            <span>
              Palavras <strong>{session.liveMetrics.wordsCompleted}/{session.liveMetrics.wordsTotal}</strong>
            </span>
            <span>
              Caracteres <strong>{session.liveMetrics.charsCorrect}/{session.liveMetrics.charsTotal}</strong>
            </span>
            <span>
              Erros <strong>{session.liveMetrics.errors}</strong>
            </span>
            <span>
              WPM <strong>{session.liveMetrics.wpm.toLocaleString('pt-BR')}</strong>
            </span>
          </div>
          <div className="progress-bar" aria-hidden>
            <div
              className="progress-bar-fill"
              style={{ width: `${Math.min((session.liveMetrics.charsCorrect / Math.max(session.liveMetrics.charsTotal, 1)) * 100, 100)}%` }}
            />
          </div>
          <div className="actions-row">
            <Button variant="primary" onClick={newTest}>
              Novo teste
            </Button>
            <Button onClick={session.reset}>Reiniciar teste</Button>
            {(mode === 'practice' || duration == null) && (
              <Button onClick={session.finishManually} disabled={!session.running}>
                Finalizar
              </Button>
            )}
          </div>
        </>
      )}

      <div style={{ marginTop: 20, textAlign: 'center' }}>
        <Button onClick={props.onOpenStats}>Ver estatísticas de evolução</Button>
      </div>

      <TextsManager
        open={showTexts}
        onClose={() => setShowTexts(false)}
        texts={userTexts.texts}
        onCreate={userTexts.create}
        onUpdate={userTexts.update}
        onDelete={userTexts.remove}
        onUse={(t) => {
          setCurrentText(t)
          setLevel(t.level)
          session.reset()
          setShowTexts(false)
        }}
      />

      <SettingsDialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onChange={props.onSettingsChange}
        groqConfig={props.groqConfig}
        onGroqChange={props.onGroqChange}
      />

      <AiGeneratePanelWrapper
        open={showAi}
        onClose={() => setShowAi(false)}
        groqConfig={props.groqConfig}
        level={level}
        onUseText={(t) => {
          setCurrentText(t)
          session.reset()
        }}
        onOpenSettings={() => {
          setShowAi(false)
          setShowSettings(true)
        }}
      />
    </div>
  )
}

/** Envolve o painel de IA num diálogo para não poluir a tela principal. */
function AiGeneratePanelWrapper(props: {
  open: boolean
  onClose: () => void
  groqConfig: GroqConfig
  level: LevelId
  onUseText: (t: TextEntry) => void
  onOpenSettings: () => void
}) {
  const { open, onClose, ...rest } = props
  if (!open) return null
  return (
    <div className="dialog-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Gerar texto com IA">
        <h2 className="dialog-title">Gerar texto com IA (Groq)</h2>
        <AiGeneratePanel {...rest} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <Button onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </div>
  )
}
