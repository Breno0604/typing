import { useCallback, useEffect, useState } from 'react'
import type { LevelId, TextEntry } from '../types/domain'
import { createUserText, deleteUserText, getAllUserTexts, saveUserText } from '../storage/textsRepo'

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
  }, [refresh])

  const create = useCallback(
    async (title: string, content: string, level: LevelId) => {
      const entry = createUserText(title, content, level)
      await saveUserText(entry)
      await refresh()
      return entry
    },
    [refresh],
  )

  const update = useCallback(
    async (entry: TextEntry) => {
      await saveUserText(entry)
      await refresh()
    },
    [refresh],
  )

  const remove = useCallback(
    async (id: string) => {
      await deleteUserText(id)
      await refresh()
    },
    [refresh],
  )

  return { texts, loaded, create, update, remove }
}
