import { useEffect, useMemo, useRef, useState } from 'react'
import type { DurationId, SessionMode, TextEntry } from '../types/domain'
import { durationSeconds } from '../logic/durations'
import { useTestSession } from '../hooks/useTestSession'
import { TypingArea } from '../components/TypingArea'
import { ResultCard } from '../components/ResultCard'
import { AiGeneratePanel } from '../components/AiGeneratePanel'
import { TextsManager } from '../components/TextsManager'
import { TypingSettingsDialog } from '../components/TypingSettingsDialog'
import { SystemSettingsDialog } from '../components/SystemSettingsDialog'
import { Dialog } from '../components/ui/Dialog'
import { Button, Field, SelectControl } from '../components/ui/controls'
import { IconKeyboard, IconSettings } from '../components/ui/Icons'
import { formatClock } from '../hooks/useTimer'
import type { GroqConfig, Settings } from '../types/domain'
import { useUserTexts } from '../hooks/useUserTexts'
import {
  DEFAULT_SUBTOPIC,
  DEFAULT_TOPIC,
  TOPICS,
  cardsForSubtopic,
  type SubtopicDef,
  type TopicDef,
} from '../data/textTopics'

export interface PracticePageProps {
  settings: Settings
  onSettingsChange: (patch: Partial<Settings>) => void
  groqConfig: GroqConfig
  onGroqChange: (patch: Partial<GroqConfig>) => void
  onOpenStats: () => void
}

/** Etapas da navegação por cards na tela de configuração. */
type SetupStep = 'topics' | 'subtopics' | 'confirm'

export function PracticePage(props: PracticePageProps) {
  const { settings } = props
  const userTexts = useUserTexts()

  const [mode, setMode] = useState<SessionMode>(settings.defaultMode)
  const [durationId, setDurationId] = useState<DurationId>(settings.defaultDuration)
  const [customSeconds, setCustomSeconds] = useState(settings.defaultCustomDuration)

  // Navegação de cards: tema → subtema → confirmação.
  const [step, setStep] = useState<SetupStep>('topics')
  const [topic, setTopic] = useState<TopicDef>(DEFAULT_TOPIC)
  const [subtopic, setSubtopic] = useState<SubtopicDef>(DEFAULT_SUBTOPIC)
  const [selectedTextId, setSelectedTextId] = useState<string | null>(DEFAULT_SUBTOPIC.presetIds[0] ?? null)

  const [showTypingSettings, setShowTypingSettings] = useState(false)
  const [showSystemSettings, setShowSystemSettings] = useState(false)
  const [showTexts, setShowTexts] = useState(false)
  const [showAi, setShowAi] = useState(false)

  // "user" inclui textos do usuário E gerados por IA (ambos vivem no IndexedDB).
  const userAndAiTexts = useMemo(
    () => userTexts.texts.filter((t) => t.source !== 'preset'),
    [userTexts.texts],
  )

  // Todos os textos conhecidos (para resolver o texto selecionado).
  const allTexts = useMemo(() => {
    const presets: TextEntry[] = TOPICS.flatMap((t) =>
      t.subtopics.flatMap((s) =>
        cardsForSubtopic(s, []).map((c) => c.entry),
      ),
    )
    return [...presets, ...userAndAiTexts]
  }, [userAndAiTexts])

  const currentText = useMemo(
    () => allTexts.find((t) => t.id === selectedTextId) ?? null,
    [allTexts, selectedTextId],
  )

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
    const onKeyDown = (e: KeyboardEvent) => {
      // Não capturar enquanto um diálogo estiver aberto.
      if (document.querySelector('.dialog-overlay')) return
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (e.key === 'Tab' || e.key === 'Escape') return
      // Espaço fora de inputs não deve rolar a página.
      if (e.key === ' ') {
        e.preventDefault()
      }
      keyHandlerRef.current(e)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const startTyping = () => {
    session.reset()
  }

  const backToSetup = () => {
    session.reset()
    setStep('topics')
    setTopic(DEFAULT_TOPIC)
    setSubtopic(DEFAULT_SUBTOPIC)
    setSelectedTextId(DEFAULT_SUBTOPIC.presetIds[0] ?? null)
  }

  const retrySameText = () => {
    session.reset()
  }

  const selectSubtopic = (t: TopicDef, s: SubtopicDef) => {
    setTopic(t)
    setSubtopic(s)
    setSelectedTextId(s.presetIds[0] ?? null)
    setStep('confirm')
  }

  const FONT_SCALE = { small: 0.85, medium: 1, large: 1.2 } as const
  const typingFontSize = 26 * FONT_SCALE[settings.typingFontSize]

  const originLabel = (origin: 'preset' | 'user' | 'ai') =>
    origin === 'preset' ? 'Predefinido' : origin === 'ai' ? 'IA' : 'Meu texto'

  return (
    <div style={{ '--typing-font-size': `${typingFontSize}px` } as React.CSSProperties}>
      {/* ================= Tela de configuração (cards) ================= */}
      {step !== 'confirm' && (
        <section className="setup-card" aria-label="Escolher texto">
          <h2 className="setup-title">O que você quer digitar?</h2>

          {step === 'topics' && (
            <>
              <p className="setup-hint">Escolha um tema</p>
              <div className="topic-grid">
                {TOPICS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="choice-card"
                    onClick={() => {
                      setTopic(t)
                      setStep('subtopics')
                    }}
                  >
                    <span className="choice-card-title">{t.label}</span>
                    <span className="choice-card-desc">{t.description}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 'subtopics' && (
            <>
              <p className="setup-hint">{topic.label} — escolha um assunto</p>
              <div className="topic-grid">
                {topic.subtopics.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="choice-card"
                    onClick={() => selectSubtopic(topic, s)}
                  >
                    <span className="choice-card-title">{s.label}</span>
                    <span className="choice-card-desc">
                      {s.presetIds.length} {s.presetIds.length === 1 ? 'texto' : 'textos'}
                    </span>
                  </button>
                ))}
              </div>
              <div className="actions-row">
                <Button onClick={() => setStep('topics')}>Voltar aos temas</Button>
              </div>
            </>
          )}

          <div className="setup-tools">
            <Button aria-label="Configurações da digitação" title="Configurações da digitação (textos e IA)" onClick={() => setShowTypingSettings(true)}>
              <IconKeyboard size={16} /> Digitação
            </Button>
            <Button aria-label="Configurações do sistema" title="Configurações do sistema (aparência e IA)" onClick={() => setShowSystemSettings(true)}>
              <IconSettings size={16} /> Sistema
            </Button>
          </div>
        </section>
      )}

      {/* ================= Confirmação + digitação + resultado ================= */}
      {step === 'confirm' && (
        <section aria-label="Sessão de digitação">
          {session.finished && session.finishedMetrics ? (
            /* Resultado: tela completa com estatísticas. */
            <>
              <div className="typing-card">
                <ResultCard
                  metrics={session.finishedMetrics}
                  finishReason={session.session.finishReason ?? 'manual'}
                  onNewTest={retrySameText}
                  onRetry={session.reset}
                />
              </div>
              <div className="actions-row">
                <Button onClick={backToSetup}>Escolher outro texto</Button>
              </div>
            </>
          ) : session.idle ? (
            /* Confirmação antes de começar. */
            <div className="setup-card">
              <h2 className="setup-title">{subtopic.label}</h2>
              <p className="setup-hint">{topic.label}</p>

              {currentText && (
                <div className="setup-preview">
                  <span className="setup-preview-label">
                    {currentText.title} · {originLabel(
                      currentText.source === 'preset' ? 'preset' : currentText.source === 'ai' ? 'ai' : 'user',
                    )}
                  </span>
                  <p className="setup-preview-text">
                    {currentText.content.length > 220
                      ? `${currentText.content.slice(0, 220)}…`
                      : currentText.content}
                  </p>
                </div>
              )}

              {subtopic.presetIds.length >= 0 && userAndAiTexts.length > 0 && (
                <div className="text-picker">
                  <span className="setup-preview-label">Outros textos deste assunto</span>
                  <div className="topic-grid">
                    {cardsForSubtopic(subtopic, userAndAiTexts).map((card) => (
                      <button
                        key={card.entry.id}
                        type="button"
                        className={`choice-card ${selectedTextId === card.entry.id ? 'choice-card-selected' : ''}`}
                        onClick={() => setSelectedTextId(card.entry.id)}
                      >
                        <span className="choice-card-title">{card.entry.title}</span>
                        <span className="choice-card-desc">
                          {originLabel(card.origin)} ·{' '}
                          {card.entry.content.length > 80
                            ? `${card.entry.content.slice(0, 80)}…`
                            : card.entry.content}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="controls-bar" style={{ marginTop: 16 }}>
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
                <div className="controls-spacer" />
                <Button
                  className="btn-icon"
                  aria-label="Configurações da digitação"
                  title="Configurações da digitação"
                  onClick={() => setShowTypingSettings(true)}
                >
                  <IconKeyboard />
                </Button>
                <Button
                  className="btn-icon"
                  aria-label="Configurações do sistema"
                  title="Configurações do sistema"
                  onClick={() => setShowSystemSettings(true)}
                >
                  <IconSettings />
                </Button>
              </div>

              <div className="actions-row" style={{ marginTop: 24 }}>
                <Button variant="primary" onClick={startTyping} disabled={!currentText}>
                  Começar
                </Button>
                <Button onClick={() => setStep('subtopics')}>Voltar aos assuntos</Button>
              </div>
            </div>
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
                <Button onClick={session.reset}>Reiniciar</Button>
                {(mode === 'practice' || duration == null) && (
                  <Button onClick={session.finishManually} disabled={!session.running}>
                    Finalizar
                  </Button>
                )}
                <Button onClick={backToSetup}>Escolher outro texto</Button>
              </div>
            </>
          )}
        </section>
      )}

      {/* ================= Diálogos ================= */}
      <TypingSettingsDialog
        open={showTypingSettings}
        onClose={() => setShowTypingSettings(false)}
        mode={mode}
        onModeChange={setMode}
        durationId={durationId}
        onDurationChange={setDurationId}
        customSeconds={customSeconds}
        onCustomSecondsChange={setCustomSeconds}
        typingFontSize={settings.typingFontSize}
        onTypingFontSizeChange={(s) => props.onSettingsChange({ typingFontSize: s })}
        soundEnabled={settings.soundEnabled}
        onSoundEnabledChange={(v) => props.onSettingsChange({ soundEnabled: v })}
        soundVolume={settings.soundVolume}
        onSoundVolumeChange={(v) => props.onSettingsChange({ soundVolume: v })}
        userTextsCount={userTexts.texts.length}
        onOpenTexts={() => {
          setShowTypingSettings(false)
          setShowTexts(true)
        }}
        onOpenAi={() => {
          setShowTypingSettings(false)
          setShowAi(true)
        }}
      />

      <SystemSettingsDialog
        open={showSystemSettings}
        onClose={() => setShowSystemSettings(false)}
        settings={settings}
        onChange={props.onSettingsChange}
        groqConfig={props.groqConfig}
        onGroqChange={props.onGroqChange}
      />

      <TextsManager
        open={showTexts}
        onClose={() => setShowTexts(false)}
        texts={userTexts.texts}
        onCreate={userTexts.create}
        onUpdate={userTexts.update}
        onDelete={userTexts.remove}
        onUse={(t) => {
          setSelectedTextId(t.id)
          setShowTexts(false)
          setStep('confirm')
        }}
      />

      <Dialog open={showAi} onClose={() => setShowAi(false)} title="Gerar texto com IA (Groq)">
        <AiGeneratePanel
          groqConfig={props.groqConfig}
          level={currentText?.level ?? 'basic'}
          onLevelChange={() => {
            /* Nível é definido pelo texto escolhido; mantido para o painel. */
          }}
          onUseText={(t) => {
            setSelectedTextId(t.id)
            setShowAi(false)
            setStep('confirm')
          }}
          onOpenSettings={() => {
            setShowAi(false)
            setShowSystemSettings(true)
          }}
        />
      </Dialog>
    </div>
  )
}
