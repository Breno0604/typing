import { useCallback, useEffect, useState } from 'react'
import type { LevelId, TextEntry } from '../types/domain'
import { createUserText, deleteUserText, getAllUserTexts, saveUserText } from '../storage/textsRepo'

/**
 * Canal de sincronização entre as instâncias do hook (PracticePage e
 * PracticeOverlays montam instâncias próprias). Sem isso, um texto salvo
 * pelo painel de IA não aparecia na lista "Meus textos" até recarregar
 * a página — cada instância mantinha a lista em memória, desatualizada.
 */
const CHANNEL_NAME = 'typing-app:user-texts'

function createSyncChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  return new BroadcastChannel(CHANNEL_NAME)
}

/** Escuta global de mudanças (qualquer instância avisa as demais). */
function listenSync(handler: () => void): () => void {
  const listeners: Array<() => void> = []

  const channel = createSyncChannel()
  if (channel) {
    const onMessage = () => handler()
    channel.addEventListener('message', onMessage)
    listeners.push(() => channel.removeEventListener('message', onMessage))
  }

  // Fallback (e cobre também mutações em outra aba da mesma origem).
  const onStorage = (e: StorageEvent) => {
    if (e.key === CHANNEL_NAME) handler()
  }
  window.addEventListener('storage', onStorage)
  listeners.push(() => window.removeEventListener('storage', onStorage))

  return () => listeners.forEach((off) => off())
}

/** Avisa as demais instâncias de que a lista de textos mudou. */
function notifySync(): void {
  try {
    createSyncChannel()?.postMessage('changed')
  } catch {
    /* canal indisponível: sem efeito */
  }
  // Dispara o fallback de storage para instâncias sem BroadcastChannel.
  try {
    localStorage.setItem(CHANNEL_NAME, String(Date.now()))
  } catch {
    /* storage indisponível: sem efeito */
  }
}

/** CRUD de textos do usuário (IndexedDB, disponível offline). */
export function useUserTexts() {
  const [texts, setTexts] = useState<TextEntry[]>([])
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    const all = await getAllUserTexts()
    setTexts(all)
    setLoaded(true)
  }, [])

  useEffect(() => {
    void refresh()
    // Mudanças feitas por outras instâncias (painel de IA, Meus textos,
    // outra aba) recarregam a lista automaticamente.
    return listenSync(() => void refresh())
  }, [refresh])

  const create = useCallback(
    async (title: string, content: string, level: LevelId) => {
      const entry = createUserText(title, content, level)
      await saveUserText(entry)
      await refresh()
      notifySync()
      return entry
    },
    [refresh],
  )

  const update = useCallback(
    async (entry: TextEntry) => {
      await saveUserText(entry)
      await refresh()
      notifySync()
    },
    [refresh],
  )

  const remove = useCallback(
    async (id: string) => {
      await deleteUserText(id)
      await refresh()
      notifySync()
    },
    [refresh],
  )

  return { texts, loaded, create, update, remove }
}
