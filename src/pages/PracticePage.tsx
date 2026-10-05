import { useEffect, useMemo, useRef, useState } from 'react'
import type { TextEntry } from '../types/domain'
import { useTestSession } from '../hooks/useTestSession'
import { TypingArea } from '../components/TypingArea'
import { ResultCard } from '../components/ResultCard'
import { AiGeneratePanel } from '../components/AiGeneratePanel'
import { TextsManager } from '../components/TextsManager'
import { Dialog } from '../components/ui/Dialog'
import { Button } from '../components/ui/controls'
import type { GroqConfig } from '../types/domain'
import { useUserTexts } from '../hooks/useUserTexts'
import { formatElapsed } from '../hooks/useTimer'
import {
  DEFAULT_SUBTOPIC,
  DEFAULT_TOPIC,
  TOPICS,
  cardsForSubtopic,
  type TopicDef,
} from '../data/textTopics'

/**
 * Página de prática do MVP: abre digitando. Trocar de texto é opcional
 * (botão "Trocar texto" → cards de tema → assunto). Sem modos, sem
 * cronômetro configurável, sem painéis de configuração.
 */
export function PracticePage(props: {
  /** Texto selecionado via "Usar" (Meus textos) ou IA; prioridade máxima. */
  selectedText: TextEntry | null
  onSelectText: (entry: TextEntry | null) => void
}) {
  const userTexts = useUserTexts()

  // Navegação opcional de troca de texto: lista de temas ou textos do tema.
  const [choosing, setChoosing] = useState(false)
  const [pickingTopic, setPickingTopic] = useState(false)
  const [topic, setTopic] = useState<TopicDef>(DEFAULT_TOPIC)
  // Textos do primeiro subtema do tema (subtemas são um detalhe interno da navegação).
  const subtopic = topic.subtopics[0]
  const [selectedTextId, setSelectedTextId] = useState<string | null>(DEFAULT_SUBTOPIC.presetIds[0] ?? null)

  const userAndAiTexts = useMemo(
    () => userTexts.texts.filter((t) => t.source !== 'preset'),
    [userTexts.texts],
  )

  const allTexts = useMemo(() => {
    const presets: TextEntry[] = TOPICS.flatMap((t) =>
      t.subtopics.flatMap((s) => cardsForSubtopic(s, []).map((c) => c.entry)),
    )
    return [...presets, ...userAndAiTexts]
  }, [userAndAiTexts])

  // Prioridade: texto usado via "Usar"/IA (objeto completo, sem depender de
  // listas locais) → escolha por tema (id local) → preset padrão.
  const currentText = useMemo(() => {
    if (props.selectedText) return props.selectedText
    return allTexts.find((t) => t.id === selectedTextId) ?? null
  }, [props.selectedText, allTexts, selectedTextId])

  // Sessão única: termina ao completar o texto (ou Finalizar). Sem duração.
  const session = useTestSession({
    mode: 'practice',
    text: currentText,
    duration: null,
  })

  const keyHandlerRef = useRef(session.handleKeyDown)
  keyHandlerRef.current = session.handleKeyDown

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (document.querySelector('.dialog-overlay')) return
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (e.key === 'Tab' || e.key === 'Escape') return
      if (e.key === ' ') e.preventDefault()
      keyHandlerRef.current(e)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const retrySameText = () => session.reset()

  const confirmText = (id: string) => {
    const entry = allTexts.find((t) => t.id === id) ?? null
    props.onSelectText(entry) // limpa a seleção externa: passa a valer a escolha local
    setSelectedTextId(id)
    setChoosing(false)
    session.reset()
  }

  const typingFontSize = 26 // fixo no MVP

  return (
    <div style={{ '--typing-font-size': `${typingFontSize}px` } as React.CSSProperties}>
      {/* Escolha de texto (opcional, via "Trocar texto"). */}
      {choosing ? (
        <section className="setup-card" aria-label="Escolher texto">
          <h2 className="setup-title">Trocar texto</h2>

          {pickingTopic ? (
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
                      setPickingTopic(false)
                    }}
                  >
                    <span className="choice-card-title">{t.label}</span>
                    <span className="choice-card-desc">{t.description}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="setup-hint">{topic.label} — escolha um texto</p>
              <div className="topic-grid">
                {cardsForSubtopic(subtopic, userAndAiTexts).map((card) => (
                  <button
                    key={card.entry.id}
                    type="button"
                    className={`choice-card ${selectedTextId === card.entry.id ? 'choice-card-selected' : ''}`}
                    onClick={() => confirmText(card.entry.id)}
                  >
                    <span className="choice-card-title">{card.entry.title}</span>
                    <span className="choice-card-desc">
                      {card.entry.content.length > 80 ? `${card.entry.content.slice(0, 80)}…` : card.entry.content}
                    </span>
                  </button>
                ))}
              </div>
              <div className="actions-row">
                <Button onClick={() => setPickingTopic(true)}>Voltar aos temas</Button>
              </div>
            </>
          )}
        </section>
      ) : session.finished && session.finishedMetrics ? (
        /* Resultado. */
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
            <Button onClick={() => setChoosing(true)}>Trocar texto</Button>
          </div>
        </>
      ) : (
        /* Digitação: cronômetro de tempo efetivo + texto. */
        <>
          <div className="typing-top">
            <span
              className="timer"
              data-paused={session.running && session.paused}
              aria-label={session.paused ? 'Cronômetro em pausa por inatividade' : 'Cronômetro da sessão'}
            >
              {formatElapsed(session.clockMs)}
            </span>
          </div>
          <div className="typing-card">
            <TypingArea session={session.session} active={!session.finished} />
          </div>
          <div className="actions-row">
            <Button onClick={session.reset}>Reiniciar</Button>
            <Button onClick={session.finishManually} disabled={!session.running}>
              Finalizar
            </Button>
            <Button onClick={() => setChoosing(true)}>Trocar texto</Button>
          </div>
        </>
      )}
    </div>
  )
}


/** Overlays globais (Meus textos e IA) montados no App. */
export function PracticeOverlays(props: {
  showTexts: boolean
  onCloseTexts: () => void
  showAi: boolean
  onCloseAi: () => void
  groqConfig: GroqConfig
  onGroqChange: (patch: Partial<GroqConfig>) => void
  /** Seleciona o texto na prática (vindo de "Usar" ou de texto gerado por IA). */
  onUseText: (entry: TextEntry) => void
}) {
  const userTexts = useUserTexts()

  return (
    <>
      <TextsManager
        open={props.showTexts}
        onClose={props.onCloseTexts}
        texts={userTexts.texts}
        onCreate={userTexts.create}
        onUpdate={userTexts.update}
        onDelete={userTexts.remove}
        onUse={(t) => {
          props.onUseText(t)
          props.onCloseTexts()
        }}
      />

      <Dialog
        open={props.showAi}
        onClose={props.onCloseAi}
        title="Gerar texto com IA (Groq)"
        className="dialog-ai"
      >
        <AiGeneratePanel
          groqConfig={props.groqConfig}
          level="basic"
          onLevelChange={() => {
            /* Nível fixo no MVP. */
          }}
          onUseText={(entry) => {
            props.onUseText(entry)
            props.onCloseAi()
          }}
          onOpenSettings={() => {
            /* Sem modal de sistema no MVP; a chave é configurada pelo prompt. */
          }}
        />
      </Dialog>
    </>
  )
}

