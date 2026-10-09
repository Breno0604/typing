import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  FingerId,
  FocusToggleId,
  GroqConfig,
  LevelId,
  TextEntry,
  TrainingFocus,
} from '../types/domain'
import {
  GroqError,
  generateTypingText,
  DEFAULT_TEXT_FILTERS,
  TEXT_SIZE_OPTIONS,
  CONTENT_FORMAT_OPTIONS,
  type TextFilters,
  type TextSizeId,
} from '../services/groq'
import { saveUserText } from '../storage/textsRepo'
import { getAllResults } from '../storage/resultsRepo'
import { loadAiPrefs, saveAiPrefs } from '../storage/aiPrefs'
import { generateId } from '../utils/id'
import { countWords, toCodePoints } from '../logic/texts'
import { Dialog } from './ui/Dialog'
import { Button, Field, SelectControl, ToggleRow } from './ui/controls'
import { IconSparkles } from './ui/Icons'
import { LEVELS } from '../logic/levels'
import {
  EMPTY_FOCUS,
  FINGER_OPTIONS,
  FOCUS_TOGGLE_OPTIONS,
  OBJECTIVE_OPTIONS,
  SIDE_OPTIONS,
  buildPerformanceSummary,
  planFocus,
  wordsSideExclusiveHint,
} from '../logic/focus'
import type { TestResult } from '../types/domain'

interface AiGeneratePanelProps {
  /** Controla os diálogos (configuração e pré-visualização) do painel. */
  open: boolean
  onClose: () => void
  groqConfig: GroqConfig
  level: LevelId
  onLevelChange: (level: LevelId) => void
  onUseText: (entry: TextEntry) => void
  /** Salva um patch na configuração do Groq (ex.: a chave da API). */
  onGroqChange: (patch: Partial<GroqConfig>) => void
}

type AiState = 'idle' | 'loading' | 'error' | 'ready'

/** Etapa atual dentro do fluxo de IA: configuração ou prévia do texto gerado. */
type AiView = 'config' | 'preview'

export function AiGeneratePanel(props: AiGeneratePanelProps) {
  const [state, setState] = useState<AiState>('idle')
  const [message, setMessage] = useState('')
  const [topic, setTopic] = useState('')
  const [filters, setFilters] = useState<TextFilters>(DEFAULT_TEXT_FILTERS)
  const [showKeyForm, setShowKeyForm] = useState(false)
  const [keyDraft, setKeyDraft] = useState('')
  // Foco de treino combinável (objetivo, lado, interruptores e dedos).
  const [focus, setFocus] = useState<TrainingFocus>(EMPTY_FOCUS)
  // Histórico de sessões, para focos baseados em erros do usuário.
  const [results, setResults] = useState<TestResult[]>([])
  // Evita salvar as preferências antes de carregá-las do IndexedDB.
  const [prefsLoaded, setPrefsLoaded] = useState(false)
  // Fluxo em duas etapas: configurar → pré-visualizar o texto gerado.
  const [view, setView] = useState<AiView>('config')
  // Texto gerado aguardando a decisão do usuário (ainda não salvo).
  const [pending, setPending] = useState<TextEntry | null>(null)
  // Bloqueia ações enquanto salva/inicia, evitando cliques repetidos.
  const [busy, setBusy] = useState(false)
  // Erro ao salvar/iniciar a partir da prévia (o conteúdo é preservado).
  const [previewError, setPreviewError] = useState('')
  // Guarda síncrona contra duplo clique (o estado do React não é imediato).
  const actingRef = useRef(false)

  // Ao fechar o fluxo, volta para a configuração e descarta a prévia pendente.
  useEffect(() => {
    if (props.open) return
    setView('config')
    setPending(null)
    setPreviewError('')
    setBusy(false)
    actingRef.current = false
  }, [props.open])

  useEffect(() => {
    let cancelled = false
    getAllResults().then((r) => {
      if (!cancelled) setResults(r)
    })
    return () => {
      cancelled = false
    }
  }, [])

  useEffect(() => {
    let active = true
    loadAiPrefs()
      .then((prefs) => {
        if (!active) return
        setFocus(prefs.focus)
        setFilters({
          size: prefs.size,
          accentHeavy: prefs.accentHeavy,
          withNumbers: prefs.withNumbers,
          format: prefs.format,
          wordsSideOnly: prefs.wordsSideOnly,
        })
        setPrefsLoaded(true)
      })
      .catch(() => {
        if (active) setPrefsLoaded(true)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!prefsLoaded) return
    void saveAiPrefs({
      focus,
      size: filters.size,
      accentHeavy: filters.accentHeavy,
      withNumbers: filters.withNumbers,
      format: filters.format,
      wordsSideOnly: filters.wordsSideOnly,
    }).catch(() => {})
  }, [prefsLoaded, focus, filters])

  const plan = useMemo(() => planFocus(focus), [focus])
  const performanceData = useMemo(() => buildPerformanceSummary(results), [results])
  const historyAvailable = performanceData.trim().length > 0

  const toggleFinger = (f: FingerId) =>
    setFocus((prev) => ({
      ...prev,
      fingers: prev.fingers.includes(f) ? prev.fingers.filter((x) => x !== f) : [...prev.fingers, f],
    }))

  const toggleFocus = (id: FocusToggleId) =>
    setFocus((prev) => ({
      ...prev,
      toggles: prev.toggles.includes(id) ? prev.toggles.filter((x) => x !== id) : [...prev.toggles, id],
    }))

  const saveKey = () => {
    const trimmed = keyDraft.trim()
    if (!trimmed) return
    props.onGroqChange({ apiKey: trimmed })
    setKeyDraft('')
    setShowKeyForm(false)
    setMessage('Chave salva. Agora você pode gerar o texto.')
    setState('idle')
  }

  const patchFilters = (patch: Partial<TextFilters>) => setFilters((f) => ({ ...f, ...patch }))

  const generate = async () => {
    setState('loading')
    setMessage('Gerando texto…')
    setPreviewError('')
    try {
      const postLines =
        filters.format === 'words' && filters.wordsSideOnly && focus.side
          ? [...plan.postLines, wordsSideExclusiveHint(focus.side)]
          : plan.postLines
      const content = await generateTypingText({
        config: props.groqConfig,
        level: props.level,
        topicHint: topic || undefined,
        filters,
        focus: { preLines: plan.preLines, postLines },
        performanceData: plan.usesHistory && historyAvailable ? performanceData : undefined,
      })
      const entry: TextEntry = {
        id: generateId('ai'),
        title: 'Texto gerado por IA',
        content,
        level: props.level,
        source: 'ai',
        createdAt: Date.now(),
        generatedByAi: true,
      }
      // Não salva aqui: o usuário decide na prévia ("Salvar e praticar").
      setPending(entry)
      actingRef.current = false
      setState('ready')
      setMessage('')
      setView('preview')
    } catch (err) {
      if (err instanceof GroqError) {
        setState('error')
        setMessage(err.message)
      } else {
        setState('error')
        setMessage('Não foi possível gerar o texto. Tente novamente.')
      }
    }
  }

  // Fecha o fluxo e limpa a prévia pendente.
  const handleClose = () => {
    setView('config')
    setPending(null)
    setPreviewError('')
    actingRef.current = false
    props.onClose()
  }

  // Volta à configuração mantendo o texto gerado (para ajustar parâmetros).
  const backToConfig = () => {
    if (actingRef.current) return
    setPreviewError('')
    setView('config')
  }

  // Inicia a prática sem salvar nada.
  const practiceWithoutSaving = () => {
    if (actingRef.current || !pending) return
    actingRef.current = true
    setBusy(true)
    props.onUseText(pending)
  }

  // Salva uma única vez e inicia a prática; em erro, preserva o conteúdo.
  const saveAndPractice = async () => {
    if (actingRef.current || !pending) return
    actingRef.current = true
    setBusy(true)
    setPreviewError('')
    try {
      await saveUserText(pending)
      props.onUseText(pending)
    } catch {
      actingRef.current = false
      setBusy(false)
      setPreviewError('Não foi possível salvar o texto. O conteúdo foi mantido — tente novamente.')
    }
  }

  const noKey = !props.groqConfig.apiKey.trim()

  // Estatísticas do texto aguardando decisão (contagem por code points, como no app).
  const previewChars = pending ? toCodePoints(pending.content).length : 0
  const previewWords = pending ? countWords(pending.content) : 0

  // Aviso de chave ausente com o formulário de configuração inline.
  const keyNotice = noKey && (
    <div className="ai-key-setup">
      <p className="form-help">
        Para gerar textos, configure sua chave gratuita da API do Groq ({' '}
        <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">
          console.groq.com/keys
        </a>
        ). Ela fica salva apenas neste navegador.
      </p>
      {showKeyForm ? (
        <div className="ai-key-form">
          <input
            className="text-input"
            type="password"
            placeholder="gsk_..."
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.stopPropagation()
                saveKey()
              }
            }}
            autoFocus
          />
          <Button variant="primary" onClick={saveKey}>
            Salvar chave
          </Button>
          <Button onClick={() => setShowKeyForm(false)}>Cancelar</Button>
        </div>
      ) : (
        <Button onClick={() => setShowKeyForm(true)}>Configurar chave da API</Button>
      )}
    </div>
  )

  return (
    <>
      <Dialog
        open={props.open && view === 'config'}
        onClose={handleClose}
        title="Gerar texto com IA (Groq)"
        className="dialog-ai"
      >
      {/* Corpo rolável do modal (o rodapé com o botão fica fora, sempre visível). */}
      <div className="ai-body">
        {keyNotice}
        <div className="ai-panel">
          <Field label="Objetivo" htmlFor="ai-objective">
            <SelectControl
              id="ai-objective"
              value={focus.objective ?? ''}
              onChange={(e) =>
                setFocus((prev) => ({
                  ...prev,
                  objective: (e.target.value || null) as TrainingFocus['objective'],
                }))
              }
            >
              <option value="">Nenhum</option>
              {OBJECTIVE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </SelectControl>
          </Field>
          <Field label="Lado" htmlFor="ai-side">
            <SelectControl
              id="ai-side"
              value={focus.side ?? ''}
              onChange={(e) =>
                setFocus((prev) => ({
                  ...prev,
                  side: (e.target.value || null) as TrainingFocus['side'],
                }))
              }
            >
              <option value="">Nenhum</option>
              {SIDE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </SelectControl>
          </Field>
          <Field label="Nível" htmlFor="ai-level">
            <SelectControl
              id="ai-level"
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
          <Field label="Tamanho" htmlFor="ai-size">
            <SelectControl
              id="ai-size"
              value={String(filters.size)}
              onChange={(e) => patchFilters({ size: Number(e.target.value) as TextSizeId })}
            >
              {TEXT_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size} caracteres
                </option>
              ))}
            </SelectControl>
          </Field>
          <Field label="Tema (opcional)" htmlFor="ai-topic">
            <input
              id="ai-topic"
              className="text-input"
              style={{ width: 220 }}
              placeholder="Ex.: exploração espacial"
              value={topic}
              maxLength={60}
              onChange={(e) => setTopic(e.target.value)}
            />
          </Field>
          <Field label="Modelo" htmlFor="ai-model">
            <SelectControl
              id="ai-model"
              value={props.groqConfig.model}
              onChange={(e) => props.onGroqChange({ model: e.target.value })}
            >
              <option value="openai/gpt-oss-120b">GPT-OSS 120B (recomendado)</option>
              <option value="openai/gpt-oss-20b">GPT-OSS 20B (mais leve)</option>
              <option value="qwen/qwen3.8-27b">Qwen 3.8 27B (preview)</option>
            </SelectControl>
          </Field>
        </div>

        {/* Interruptores de treino combináveis com o objetivo/lado acima. */}
        <div className="ai-focus-section">
          <span className="ai-focus-section-title">Ajustes finos</span>
          <div className="toggle-row">
            <span className="toggle-row-text">
              <span className="toggle-row-label">Formato do conteúdo</span>
              <span className="toggle-row-desc">
                Texto corrido ou apenas palavras isoladas.
              </span>
            </span>
            <div className="segmented" role="group" aria-label="Formato do conteúdo">
              {CONTENT_FORMAT_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={`chip${filters.format === o.id ? ' chip-active' : ''}`}
                  aria-pressed={filters.format === o.id}
                  onClick={() => patchFilters({ format: o.id })}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          {filters.format === 'words' && focus.side && (
            <ToggleRow
              checked={filters.wordsSideOnly}
              onChange={(v) => patchFilters({ wordsSideOnly: v })}
              label="Somente palavras do lado escolhido"
              description="Ligado: usa apenas palavras do lado selecionado. Desligado: prioriza o lado, mas permite palavras variadas."
            />
          )}
          {FOCUS_TOGGLE_OPTIONS.map((o) => (
            <ToggleRow
              key={o.id}
              checked={focus.toggles.includes(o.id)}
              onChange={() => toggleFocus(o.id)}
              label={o.label}
              description={o.description}
            />
          ))}
          <ToggleRow
            checked={filters.accentHeavy}
            onChange={(v) => patchFilters({ accentHeavy: v })}
            label="Muitos acentos"
            description="Prioriza palavras com acentos e cedilha (treino ABNT)."
          />
          <ToggleRow
            checked={filters.withNumbers}
            onChange={(v) => patchFilters({ withNumbers: v })}
            label="Números e valores"
            description="Inclui datas, horários, quantidades, valores e percentuais."
          />
        </div>

        {/* Escolha de dedos, visível apenas com o interruptor "Dedos específicos". */}
        {focus.toggles.includes('specific-fingers') && (
          <div className="ai-fingers" role="group" aria-label="Dedos do treino">
            <span className="ai-fingers-label">Dedos:</span>
            {FINGER_OPTIONS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`chip${focus.fingers.includes(f.id) ? ' chip-active' : ''}`}
                onClick={() => toggleFinger(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {plan.usesHistory && (
          <p className="ai-focus-help" role="note">
            {historyAvailable
              ? 'Seu histórico de erros será usado para personalizar o texto.'
              : 'Ainda não há histórico de erros suficiente — será usada uma estratégia padrão para este objetivo (complete alguns testes para personalizar).'}
          </p>
        )}

        {plan.warnings.length > 0 && (
          <ul className="ai-focus-warnings" role="note">
            {plan.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}

        {plan.blocked && (
          <p className="ai-focus-help" data-kind="error">
            {plan.blockMessage}
          </p>
        )}

        {message && (
          <div className="status-message" data-kind={state === 'error' ? 'error' : 'success'} role="status">
            {state === 'error'
              // Normaliza o final para não duplicar a pontuação antes do aviso offline.
              ? `${message.replace(/[.\s]+$/, '')}. O restante da aplicação continua funcionando normalmente offline.`
              : message}
          </div>
        )}
      </div>

      {/* Rodapé fixo: o botão de gerar fica sempre visível, mesmo com o corpo em rolagem. */}
      <div className="ai-footer">
        {pending && (
          <Button onClick={() => setView('preview')} disabled={state === 'loading'}>
            Ver prévia
          </Button>
        )}
        <Button
          variant="primary"
          onClick={() => void generate()}
          disabled={state === 'loading' || noKey || plan.blocked}
        >
          <IconSparkles size={18} /> {state === 'loading' ? 'Gerando…' : 'Gerar texto com IA'}
        </Button>
      </div>
      </Dialog>

      {/* Prévia: o texto gerado aparece aqui antes de iniciar a prática. */}
      <Dialog
        open={props.open && view === 'preview' && pending !== null}
        onClose={backToConfig}
        title="Prévia do texto gerado"
        className="dialog-ai"
      >
        <div className="ai-body">
          <p className="ai-preview-meta">
            {previewChars} {previewChars === 1 ? 'caractere' : 'caracteres'} · {previewWords}{' '}
            {previewWords === 1 ? 'palavra' : 'palavras'}
          </p>
          <div className="ai-preview-text">{pending?.content}</div>
          {previewError && (
            <div className="status-message" data-kind="error" role="status">
              {previewError}
            </div>
          )}
        </div>
        <div className="ai-footer ai-footer-preview">
          <Button onClick={backToConfig} disabled={busy}>
            Voltar e ajustar
          </Button>
          <div className="ai-footer-actions">
            <Button onClick={practiceWithoutSaving} disabled={busy}>
              Apenas praticar
            </Button>
            <Button variant="primary" onClick={() => void saveAndPractice()} disabled={busy}>
              {busy ? 'Salvando…' : 'Salvar e praticar'}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  )
}
