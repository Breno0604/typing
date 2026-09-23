import type { TestResult } from '../types/domain'
import { dbGetAll, dbPut, STORE_RESULTS } from './db'

export async function saveResult(result: TestResult): Promise<void> {
  await dbPut(STORE_RESULTS, result)
}

export async function getAllResults(): Promise<TestResult[]> {
  const all = await dbGetAll<TestResult>(STORE_RESULTS)
  return all.sort((a, b) => b.finishedAt - a.finishedAt)
}
