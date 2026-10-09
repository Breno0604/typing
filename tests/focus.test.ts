import { describe, expect, it } from 'vitest'
import { EMPTY_FOCUS, planFocus } from '../src/logic/focus'
import type { TrainingFocus } from '../src/types/domain'

const focus = (patch: Partial<TrainingFocus>): TrainingFocus => ({ ...EMPTY_FOCUS, ...patch })

describe('planFocus', () => {
  it('sem nenhuma escolha não gera linhas nem pede histórico', () => {
    const plan = planFocus(EMPTY_FOCUS)
    expect(plan.preLines).toEqual([])
    expect(plan.postLines).toEqual([])
    expect(plan.usesHistory).toBe(false)
    expect(plan.blocked).toBe(false)
    expect(plan.warnings).toEqual([])
  })

  it('objetivo e lado entram nas linhas pré-texto', () => {
    const plan = planFocus(focus({ objective: 'speed', side: 'left' }))
    const joined = plan.preLines.join(' ')
    expect(joined).toContain('VELOCIDADE')
    expect(joined).toContain('MÃO ESQUERDA')
  })

  it('interruptores combinam nas linhas pré-texto', () => {
    const plan = planFocus(focus({ toggles: ['rare-keys', 'nearby-keys'] }))
    const joined = plan.preLines.join(' ')
    expect(joined).toContain('TECLAS POUCO USADAS')
    expect(joined).toContain('TECLAS PRÓXIMAS')
  })

  it('interruptores de histórico marcam usesHistory', () => {
    expect(planFocus(focus({ toggles: ['worst-letters'] })).usesHistory).toBe(true)
    expect(planFocus(focus({ toggles: ['worst-combos'] })).usesHistory).toBe(true)
    expect(planFocus(focus({ toggles: ['rare-keys'] })).usesHistory).toBe(false)
  })

  it('duas ou mais escolhas geram uma linha de combinação no pós-texto', () => {
    const plan = planFocus(focus({ objective: 'accuracy', toggles: ['nearby-keys'] }))
    expect(plan.postLines.join(' ')).toContain('Combine')
  })

  it('uma única escolha não gera linha de combinação', () => {
    const plan = planFocus(focus({ objective: 'accuracy' }))
    expect(plan.postLines.join(' ')).not.toContain('Combine')
  })

  it('dedos específicos sem dedo escolhido bloqueia a geração', () => {
    const plan = planFocus(focus({ toggles: ['specific-fingers'] }))
    expect(plan.blocked).toBe(true)
    expect(plan.blockMessage).toBeTruthy()
  })

  it('dedos específicos com dedo escolhido gera a linha das letras', () => {
    const plan = planFocus(focus({ toggles: ['specific-fingers'], fingers: ['pinky'] }))
    expect(plan.blocked).toBe(false)
    const joined = plan.postLines.join(' ')
    expect(joined).toContain('Mindinho')
    expect(joined).toContain('q')
  })

  it('avisa conflito de velocidade com treino difícil', () => {
    const plan = planFocus(focus({ objective: 'speed', toggles: ['rare-keys'] }))
    expect(plan.warnings.length).toBeGreaterThan(0)
  })

  it('avisa quando há muitos interruptores ligados', () => {
    const plan = planFocus(
      focus({
        toggles: ['worst-letters', 'worst-combos', 'nearby-keys', 'rare-keys', 'hand-alternation'],
      }),
    )
    expect(plan.warnings.some((w) => w.includes('diluir'))).toBe(true)
  })
})
