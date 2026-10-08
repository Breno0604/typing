import { useState } from 'react'
import type { GroqConfig, LevelId, TextEntry } from '../types/domain'
import {
  GroqError,
  generateTypingText,
  DEFAULT_TEXT_FILTERS,
  type TextFilters,
  type TextSizeId,
  type TextStyleId,
} from '../services/groq'
import { saveUserText } from '../storage/textsRepo'
import { generateId } from '../utils/id'
import { Button, Field, SelectControl, Switch } from './ui/controls'
import { IconSparkles } from './ui/Icons'
import { LEVELS } from '../logic/levels'

interface AiGeneratePanelProps {
  groqConfig: GroqConfig
  level: LevelId
  onLevelChange: (level: LevelId) => void
  onUseText: (entry: TextEntry) => void
  /** Salva um patch na configuração do Groq (ex.: a chave da API). */
  onGroqChange: (patch: Partial<GroqConfig>) => void
}

type AiState = 'idle' | 'loading' | 'error' | 'ready'

/** Sugestões rápidas de tema: um clique preenche o campo de tema. */
const TOPIC_SUGGESTIONS = [
  'esportes',
  'culinária',
  'viagens',
  'ciência',
  'música brasileira',
  'natureza',
  'história do Brasil',
  'tecnologia no dia a dia',
]

export function AiGeneratePanel(props: AiGeneratePanelProps) {
  const [state, setState] = useState<AiState>('idle')
  const [message, setMessage] = useState('')
  const [topic, setTopic] = useState('')
  const [filters, setFilters] = useState<TextFilters>(DEFAULT_TEXT_FILTERS)
  const [showKeyForm, setShowKeyForm] = useState(false)
  const [keyDraft, setKeyDraft] = useState('')

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
    try {
      const content = await generateTypingText({
        config: props.groqConfig,
        level: props.level,
        topicHint: topic || undefined,
        filters,
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
      await saveUserText(entry)
      setState('ready')
      setMessage('Texto gerado e salvo em "Meus textos".')
      props.onUseText(entry)
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

  const noKey = !props.groqConfig.apiKey.trim()

  // Aviso de chave ausente com o formulário de configuração inline.
  const keyNotice = noKey && (
    <div className="ai-key-setup">
      <p className="form-help">
        Para gerar textos, configure sua chave gratuita da API do Groq ({' '}<a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">console.groq.com/keys</a>). Ela fica salva apenas neste navegador.
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
          <Button variant="primary" onClick={saveKey}>Salvar chave</Button>
          <Button onClick={() => setShowKeyForm(false)}>Cancelar</Button>
        </div>
      ) : (
        <Button onClick={() => setShowKeyForm(true)}>Configurar chave da API</Button>
      )}
    </div>
  )

  return (
    <>
      {/* Corpo rolável do modal (o rodapé com o botão fica fora, sempre visível). */}
      <div className="ai-body">
      {keyNotice}
      <div className="ai-panel">
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
            value={filters.size}
            onChange={(e) => patchFilters({ size: e.target.value as TextSizeId })}
          >
            <option value="short">Curto (~250 caracteres)</option>
            <option value="medium">Médio (~450 caracteres)</option>
            <option value="long">Longo (~800 caracteres)</option>
          </SelectControl>
        </Field>
        <Field label="Estilo" htmlFor="ai-style">
          <SelectControl
            id="ai-style"
            value={filters.style}
            onChange={(e) => patchFilters({ style: e.target.value as TextStyleId })}
          >
            <option value="everyday">Cotidiano</option>
            <option value="journalistic">Jornalístico</option>
            <option value="literary">Literário</option>
            <option value="technical">Técnico/Tecnologia</option>
            <option value="formal">Formal</option>
          </SelectControl>
        </Field>
      </div>

      <div className="ai-toggles">
        <div className="form-row">
          <label htmlFor="ai-accents">Acentos reforçados</label>
          <Switch
            checked={filters.accentHeavy}
            onChange={(checked) => patchFilters({ accentHeavy: checked })}
            label="Acentos reforçados"
          />
        </div>
        <p className="form-help">Gera texto intencionalmente rico em á, ã, ç, ê, ó — bom treino para teclado ABNT.</p>
        <div className="form-row">
          <label htmlFor="ai-numbers">Com números e símbolos</label>
          <Switch
            checked={filters.withNumbers}
            onChange={(checked) => patchFilters({ withNumbers: checked })}
            label="Com números e símbolos"
          />
        </div>
        <p className="form-help">Inclui datas, valores, percentuais e parênteses — treina a linha numérica do teclado.</p>
      </div>

      <div className="ai-topics" role="group" aria-label="Sugestões de tema">
        <span className="ai-topics-label">Sugestões:</span>
        {TOPIC_SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            className={`chip${topic === suggestion ? ' chip-active' : ''}`}
            onClick={() => setTopic(topic === suggestion ? '' : suggestion)}
          >
            {suggestion}
          </button>
        ))}
      </div>

      {message && (
        <div className="status-message" data-kind={state === 'error' ? 'error' : 'success'} role="status">
          {message}
          {state === 'error' && (
            <>. O restante da aplicação continua funcionando normalmente offline.</>
          )}
        </div>
      )}
      <p className="form-help">
        Requer conexão com a internet. O texto gerado usa o nível e os filtros selecionados e é salvo automaticamente.
      </p>

      </div>

      {/* Rodapé fixo: o botão de gerar fica sempre visível, mesmo com o corpo em rolagem. */}
      <div className="ai-footer">
        <Button variant="primary" onClick={() => void generate()} disabled={state === 'loading' || noKey}>
          <IconSparkles size={18} /> {state === 'loading' ? 'Gerando…' : 'Gerar texto com IA'}
        </Button>
      </div>
    </>
  )
}
