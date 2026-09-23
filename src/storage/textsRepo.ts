import type { LevelId, TextEntry, TextSource } from '../types/domain'
import { dbDelete, dbGetAll, dbPut, STORE_TEXTS } from './db'

export async function getAllUserTexts(): Promise<TextEntry[]> {
  const all = await dbGetAll<TextEntry>(STORE_TEXTS)
  return all.sort((a, b) => b.createdAt - a.createdAt)
}

export async function saveUserText(entry: TextEntry): Promise<void> {
  await dbPut(STORE_TEXTS, entry)
}

export async function deleteUserText(id: string): Promise<void> {
  await dbDelete(STORE_TEXTS, id)
}

export function createUserText(
  title: string,
  content: string,
  level: LevelId,
): TextEntry {
  return {
    id: `user-${crypto.randomUUID()}`,
    title: title.trim(),
    content: content.normalize('NFC').trim(),
    level,
    source: 'user' as TextSource,
    createdAt: Date.now(),
  }
}
