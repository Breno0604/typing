import { useState } from 'react'
import type { GroqConfig, LevelId, TextEntry } from '../types/domain'
import { GroqError, generateTypingText } from '../services/groq'
import { saveUserText } from '../storage/textsRepo'
import { generateId } from '../utils/id'
import { Button, Field, SelectControl } from './ui/controls'
import { IconSparkles } from './ui/Icons'
import { LEVELS } from '../logic/levels'

interface AiGeneratePanelProps {
  groqConfig: GroqConfig
  level: LevelId
  onLevelChange: (level: LevelId) => void
  onUseText: (entry: TextEntry) => void
  onOpenSettings: () => void
}

type AiState = 'idle' | 'loading' | 'error' | 'ready'

export function AiGeneratePanel(props: AiGeneratePanelProps) {
  const [state, setState] = useState<AiState>('idle')
  const [message, setMessage] = useState('')
  const [topic, setTopic] = useState('')

  const generate = async () => {
    setState('loading')
    setMessage('Gerando texto…')
    try {
      const content = await generateTypingText({
        config: props.groqConfig,
        level: props.level,
        topicHint: topic || undefined,
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

  return (
    <div>
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
        {noKey ? (
          <Button onClick={props.onOpenSettings}>Configurar chave da API</Button>
        ) : (
          <Button variant="primary" onClick={() => void generate()} disabled={state === 'loading'}>
            <IconSparkles size={18} /> {state === 'loading' ? 'Gerando…' : 'Gerar texto com IA'}
          </Button>
        )}
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
        Requer conexão com a internet. O texto gerado usa o nível selecionado e é salvo automaticamente.
      </p>
    </div>
  )
}
