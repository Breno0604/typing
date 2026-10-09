/**
 * Efeitos sonoros via Web Audio API (sem arquivos de áudio).
 *
 * O AudioContext é criado de forma preguiçosa e retomado no primeiro gesto do
 * usuário (a digitação é um gesto), respeitando as restrições de reprodução
 * automática dos navegadores. Se a Web Audio API não estiver disponível, o
 * serviço vira um no-op — o áudio jamais interfere na digitação.
 */

type AudioContextCtor = new () => AudioContext

let context: AudioContext | null = null

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null
  const candidate = window as unknown as {
    AudioContext?: AudioContextCtor
    webkitAudioContext?: AudioContextCtor
  }
  return candidate.AudioContext ?? candidate.webkitAudioContext ?? null
}

function getContext(): AudioContext | null {
  const Ctor = getAudioContextCtor()
  if (!Ctor) return null
  if (!context) {
    try {
      context = new Ctor()
    } catch {
      return null
    }
  }
  if (context.state === 'suspended') {
    void context.resume().catch(() => {
      /* Alguns navegadores só retomam o contexto após um gesto; ignorar. */
    })
  }
  return context
}

/** Duração do sinal em segundos (curto e discreto). */
const DURATION = 0.11
/** Frequência grave (G3), menos estridente que um bipe agudo. */
const FREQUENCY = 196
/** Pico do envelope, para manter o som baixo e não irritante. */
const PEAK_RATIO = 0.3

/**
 * Toca um sinal curto e discreto de erro.
 * @param volume Volume relativo 0..1. Zero desativa o som.
 */
export function playErrorSound(volume = 0.5): void {
  const level = Math.min(Math.max(volume, 0), 1)
  if (level === 0) return

  const ctx = getContext()
  if (!ctx) return

  try {
    const now = ctx.currentTime
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()

    oscillator.type = 'triangle'
    oscillator.frequency.setValueAtTime(FREQUENCY, now)

    // Envelope curto: sobe rápido e decai antes de terminar (evita estalos).
    const peak = level * PEAK_RATIO
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.006)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + DURATION)

    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start(now)
    oscillator.stop(now + DURATION)
  } catch {
    // Falha de áudio nunca deve interromper a digitação.
  }
}
