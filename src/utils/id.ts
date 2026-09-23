/**
 * Identificadores únicos.
 * `crypto.randomUUID()` só existe em contexto seguro (HTTPS/localhost);
 * o fallback garante que falha de ID nunca interrompa a gravação de um
 * resultado ou texto.
 */
export function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }
  const random = Math.random().toString(36).slice(2, 10)
  const time = Date.now().toString(36)
  return `${prefix}-${time}-${random}`
}
