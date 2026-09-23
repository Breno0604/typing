/**
 * Utilidades de texto: normalização Unicode e segmentação de palavras.
 * Todo o app usa code points (não UTF-16 units) para tratar acentos,
 * ç e emojis sem quebrar caracteres.
 */

/** Normaliza para NFC (forma canônica composta) — evita "a" + combining acute. */
export function normalizeText(text: string): string {
  return text.normalize('NFC')
}

/** Converte texto em array de code points. */
export function toCodePoints(text: string): number[] {
  return [...normalizeText(text)].map((ch) => ch.codePointAt(0)!)
}

/** Reconstrói string a partir de code points. */
export function fromCodePoints(points: number[]): string {
  return points.map((p) => String.fromCodePoint(p)).join('')
}

/** Segmenta em palavras (sequências sem espaço). */
export function splitWords(text: string): string[] {
  return normalizeText(text).split(/\s+/).filter((w) => w.length > 0)
}

export function countWords(text: string): number {
  return splitWords(text).length
}

/** Conta ocorrências de espaço (cada espaço finalizado marca 1 palavra concluída). */
export function countSpaces(points: number[]): number {
  let count = 0
  for (const p of points) if (p === 0x20) count++
  return count
}
