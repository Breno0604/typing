import { useEffect, useMemo, useRef, useState } from 'react'
import type { DurationId, LevelId, SessionMode, TextEntry } from '../types/domain'
import { durationSeconds } from '../logic/durations'
import { buildAllTexts } from '../storage/seed'
import { useTestSession } from '../hooks/useTestSession'
import { TypingArea } from '../components/TypingArea'
import { ResultCard } from '../components/ResultCard'
import { AiGeneratePanel } from '../components/AiGeneratePanel'
import { TextsManager } from '../components/TextsManager'
import { SettingsDialog } from '../components/SettingsDialog'
import { Dialog } from '../components/ui/Dialog'
import { Button, Field, SelectControl } from '../components/ui/controls'
import { IconFileText, IconSettings } from '../components/ui/Icons'
import { levelLabel } from '../logic/levels'
import { formatClock } from '../hooks/useTimer'
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
  /** Fase da experiência: configuração ou digitação. */
  const [phase, setPhase] = useState<'setup' | 'typing'>('setup')

  const [showSettings, setShowSettings] = useState(false)
  const [showTexts, setShowTexts] = useState(false)
  const [showAi, setShowAi] = useState(false)

  const allTexts = useMemo(() => buildAllTexts(userTexts.texts), [userTexts.texts])
  // "user" inclui textos do usuário E gerados por IA (ambos vivem no IndexedDB).
  const availableTexts = useMemo(
    () =>
      textFilter === 'all'
        ? allTexts
        : allTexts.filter((t) => (textFilter === 'user' ? t.source !== 'preset' : t.source === textFilter)),
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

  // Captura global de teclado na tela de digitação.
  const keyHandlerRef = useRef(session.handleKeyDown)
  keyHandlerRef.current = session.handleKeyDown

  useEffect(() => {
    if (phase !== 'typing') return
    const onKeyDown = (e: KeyboardEvent) => {
      // Não capturar enquanto um diálogo estiver aberto.
      if (document.querySelector('.dialog-overlay')) return
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (e.key === 'Tab' || e.key === 'Escape') return
      // Espaço fora de inputs não deve rolar a página (antes ou depois do teste).
      if (e.key === ' ') {
        e.preventDefault()
      }
      keyHandlerRef.current(e)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [phase])

  const newTest = () => {
    const pool = levelTexts.length > 0 ? levelTexts : availableTexts
    if (pool.length > 0) {
      const candidates = pool.length > 1 ? pool.filter((t) => t.id !== currentText?.id) : pool
      setCurrentText(candidates[Math.floor(Math.random() * candidates.length)])
    }
    session.reset()
  }

  const startTyping = () => {
    session.reset()
    setPhase('typing')
  }

  const backToSetup = () => {
    session.reset()
    setPhase('setup')
  }

  const FONT_SCALE = { small: 0.85, medium: 1, large: 1.2 } as const
  const typingFontSize = 26 * FONT_SCALE[settings.typingFontSize]

  const sourceLabel = (id: TextEntry['source']) =>
    id === 'preset' ? 'Predefinidos' : id === 'ai' ? 'IA' : 'Meus textos'

  return (
    <div style={{ '--typing-font-size': `${typingFontSize}px` } as React.CSSProperties}>
      {phase === 'setup' ? (
        /* ================= Tela de configuração ================= */
        <section className="setup-card" aria-label="Configuração do teste">
          <h2 className="setup-title">Configurar teste</h2>

          <div className="controls-bar">
            <Field label="Modo">
              <SelectControl
                aria-label="Modo"
                value={mode}
                onChange={(e) => setMode(e.target.value as SessionMode)}
              >
                <option value="test">Teste</option>
                <option value="practice">Treino</option>
              </SelectControl>
            </Field>

            {mode === 'test' && (
              <Field label="Duração">
                <SelectControl
                  aria-label="Duração"
                  value={durationId}
                  onChange={(e) => setDurationId(e.target.value as DurationId)}
                >
                  <option value="5">5s</option>
                  <option value="10">10s</option>
                  <option value="15">15s</option>
                  <option value="30">30s</option>
                  <option value="60">60s</option>
                  <option value="90">90s</option>
                  <option value="120">2min</option>
                  <option value="180">3min</option>
                  <option value="custom">Personalizado</option>
                  <option value="unlimited">Sem limite</option>
                </SelectControl>
              </Field>
            )}

            {mode === 'test' && durationId === 'custom' && (
              <Field label="Segundos">
                <input
                  type="number"
                  className="text-input"
                  style={{ width: 90 }}
                  min={1}
                  max={3600}
                  aria-label="Segundos personalizados"
                  value={customSeconds}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    if (Number.isFinite(n) && n >= 1) setCustomSeconds(n)
                  }}
                />
              </Field>
            )}

            <Field label="Nível">
              <SelectControl
                aria-label="Nível"
                value={level}
                onChange={(e) => setLevel(e.target.value as LevelId)}
              >
                {['beginner', 'basic', 'intermediate', 'advanced', 'expert'].map((l) => (
                  <option key={l} value={l}>
                    {levelLabel(l as LevelId)}
                  </option>
                ))}
              </SelectControl>
            </Field>

            <Field label="Fonte do texto" htmlFor="setup-text-source">
              <SelectControl
                id="setup-text-source"
                aria-label="Fonte do texto"
                value={textFilter}
                onChange={(e) => setTextFilter(e.target.value as typeof textFilter)}
              >
                <option value="all">Todas</option>
                <option value="preset">Predefinidos</option>
                <option value="user">Meus textos / IA</option>
              </SelectControl>
            </Field>

            <Field label="Som">
              <SelectControl
                aria-label="Sons de tecla"
                value={settings.soundEnabled ? 'on' : 'off'}
                onChange={(e) => props.onSettingsChange({ soundEnabled: e.target.value === 'on' })}
              >
                <option value="on">Ativado</option>
                <option value="off">Desativado</option>
              </SelectControl>
            </Field>

            <Field label="Tema">
              <SelectControl
                aria-label="Tema"
                value={settings.theme}
                onChange={(e) => props.onSettingsChange({ theme: e.target.value as Settings['theme'] })}
              >
                <option value="dark">Escuro</option>
                <option value="light">Claro</option>
              </SelectControl>
            </Field>

            <div className="controls-spacer" />

            <Button className="btn-icon" aria-label="Meus textos" title="Meus textos" onClick={() => setShowTexts(true)}>
              <IconFileText />
            </Button>
            <Button className="btn-icon" aria-label="Gerar com IA" title="Gerar com IA" onClick={() => setShowAi(true)}>
              ✦
            </Button>
            <Button
              className="btn-icon"
              aria-label="Configurações"
              title="Configurações"
              onClick={() => setShowSettings(true)}
            >
              <IconSettings />
            </Button>
          </div>

          {currentText && (
            <div className="setup-preview">
              <span className="setup-preview-label">
                Texto selecionado — {sourceLabel(currentText.source)} · {levelLabel(currentText.level)}
              </span>
              <p className="setup-preview-text">
                {currentText.content.length > 220
                  ? `${currentText.content.slice(0, 220)}…`
                  : currentText.content}
              </p>
            </div>
          )}

          <div className="actions-row" style={{ marginTop: 24 }}>
            <Button variant="primary" onClick={startTyping} disabled={!currentText}>
              Começar
            </Button>
            <Button onClick={newTest} disabled={!currentText}>
              Sortear outro texto
            </Button>
          </div>

          <div style={{ marginTop: 18, textAlign: 'center' }}>
            <Button onClick={props.onOpenStats}>Ver estatísticas de evolução</Button>
          </div>
        </section>
      ) : (
        /* ================= Tela de digitação (minimalista) ================= */
        <section aria-label="Digitação">
          {session.finished && session.finishedMetrics ? (
            /* Resultado: tela completa com estatísticas. */
            <>
              <div className="typing-card">
                <ResultCard
                  metrics={session.finishedMetrics}
                  finishReason={session.session.finishReason ?? 'manual'}
                  onNewTest={newTest}
                  onRetry={session.reset}
                />
              </div>
              <div className="actions-row">
                <Button onClick={backToSetup}>Configurar novo teste</Button>
              </div>
            </>
          ) : (
            /* Digitação: apenas relógio e texto. */
            <>
              <div className="typing-top">
                {duration != null && (
                  <div className="timer" role="timer" aria-live="off" data-warn={duration * 1000 - session.clockMs <= 5000}>
                    {formatClock(Math.max(duration * 1000 - session.clockMs, 0))}
                  </div>
                )}
                {mode === 'practice' && (
                  <div className="timer" role="timer" aria-live="off">
                    {formatClock(session.clockMs)}
                  </div>
                )}
              </div>

              <div className="typing-card">
                <TypingArea session={session.session} active={!session.finished} />
              </div>

              <div className="actions-row">
                <Button onClick={newTest} aria-keyshortcuts="Escape">
                  Reiniciar
                </Button>
                {(mode === 'practice' || duration == null) && (
                  <Button onClick={session.finishManually} disabled={!session.running}>
                    Finalizar
                  </Button>
                )}
                <Button onClick={backToSetup}>Configurar</Button>
              </div>
            </>
          )}
        </section>
      )}

      {/* ================= Diálogos (compartilhados) ================= */}
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

      <Dialog open={showAi} onClose={() => setShowAi(false)} title="Gerar texto com IA (Groq)">
        <AiGeneratePanel
          groqConfig={props.groqConfig}
          level={level}
          onLevelChange={setLevel}
          onUseText={(t) => {
            setCurrentText(t)
            session.reset()
          }}
          onOpenSettings={() => {
            setShowAi(false)
            setShowSettings(true)
          }}
        />
      </Dialog>
    </div>
  )
}
