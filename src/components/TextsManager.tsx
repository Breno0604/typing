import { useState } from 'react'
import type { LevelId, TextEntry } from '../types/domain'
import { LEVELS, levelLabel } from '../logic/levels'
import { Dialog } from './ui/Dialog'
import { Button, Field, SelectControl } from './ui/controls'
import { IconEdit, IconPlus, IconSparkles, IconTrash } from './ui/Icons'

interface TextsManagerProps {
  open: boolean
  onClose: () => void
  texts: TextEntry[]
  onCreate: (title: string, content: string, level: LevelId) => Promise<TextEntry>
  onUpdate: (entry: TextEntry) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onUse: (entry: TextEntry) => void
}

const emptyForm = { id: '', title: '', content: '', level: 'basic' as LevelId }

export function TextsManager(props: TextsManagerProps) {
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')

  const startCreate = () => {
    setForm(emptyForm)
    setEditing(true)
    setError('')
  }

  const startEdit = (entry: TextEntry) => {
    setForm({ id: entry.id, title: entry.title, content: entry.content, level: entry.level })
    setEditing(true)
    setError('')
  }

  const submit = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      setError('Informe título e conteúdo do texto.')
      return
    }
    if (form.id) {
      const existing = props.texts.find((t) => t.id === form.id)
      if (existing) {
        await props.onUpdate({ ...existing, title: form.title.trim(), content: form.content.trim(), level: form.level })
      }
    } else {
      await props.onCreate(form.title, form.content, form.level)
    }
    setEditing(false)
    setForm(emptyForm)
  }

  return (
    <Dialog open={props.open} onClose={props.onClose} title="Meus textos">
      {!editing && (
        <>
          <div className="texts-toolbar">
            <p className="form-help" style={{ margin: 0 }}>
              Textos próprios ficam salvos neste navegador e funcionam offline.
            </p>
            <Button variant="primary" onClick={startCreate}>
              <IconPlus size={18} /> Novo texto
            </Button>
          </div>
          <div className="texts-list">
            {props.texts.length === 0 && (
              <p className="empty-state">Você ainda não criou textos. Crie o primeiro para usar nos testes.</p>
            )}
            {props.texts.map((t) => (
              <div key={t.id} className="text-row">
                <div className="text-row-main">
                  <div className="text-row-title">
                    {t.title}
                    <span className="tag">{levelLabel(t.level)}</span>
                    {t.generatedByAi && (
                      <span className="ai-badge">
                        <IconSparkles size={13} /> Gerado por IA
                      </span>
                    )}
                  </div>
                  <div className="text-row-content">{t.content}</div>
                </div>
                <Button onClick={() => props.onUse(t)}>Usar</Button>
                <Button className="btn-icon" aria-label={`Editar ${t.title}`} onClick={() => startEdit(t)}>
                  <IconEdit size={17} />
                </Button>
                <Button className="btn-icon" aria-label={`Excluir ${t.title}`} onClick={() => void props.onDelete(t.id)}>
                  <IconTrash size={17} />
                </Button>
              </div>
            ))}
          </div>
        </>
      )}

      {editing && (
        <div style={{ display: 'grid', gap: 14 }}>
          <Field label="Título" htmlFor="txt-title">
            <input
              id="txt-title"
              className="text-input"
              value={form.title}
              maxLength={80}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </Field>
          <Field label="Nível" htmlFor="txt-level">
            <SelectControl
              id="txt-level"
              value={form.level}
              onChange={(e) => setForm((f) => ({ ...f, level: e.target.value as LevelId }))}
            >
              {LEVELS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </SelectControl>
          </Field>
          <Field label="Conteúdo" htmlFor="txt-content">
            <textarea
              id="txt-content"
              className="text-input"
              rows={7}
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            />
          </Field>
          {error && (
            <div className="status-message" data-kind="error" role="alert">
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button onClick={() => setEditing(false)}>Cancelar</Button>
            <Button variant="primary" onClick={() => void submit()}>
              Salvar
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
