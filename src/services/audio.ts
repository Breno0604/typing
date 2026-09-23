/**
 * Sons de digitação via Web Audio API (sem arquivos externos).
 * Nota curta para acerto; tom grave para erro.
 */

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!ctx) ctx = new Ctor()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function beep(volume: number, frequency: number, durationMs: number, type: OscillatorType): void {
  const audio = getCtx()
  if (!audio || volume <= 0) return
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = type
  osc.frequency.value = frequency
  const now = audio.currentTime
  const end = now + durationMs / 1000
  gain.gain.setValueAtTime(Math.min(volume, 1), now)
  gain.gain.exponentialRampToValueAtTime(0.0001, end)
  osc.connect(gain)
  gain.connect(audio.destination)
  osc.start(now)
  osc.stop(end)
}

export function playKeySound(volume: number): void {
  beep(volume, 740, 45, 'square')
}

export function playErrorSound(volume: number): void {
  beep(volume, 190, 140, 'sawtooth')
}

/** Prepara o contexto de áudio dentro de um gesto do usuário (política de autoplay). */
export function warmUpAudio(): void {
  getCtx()
}
