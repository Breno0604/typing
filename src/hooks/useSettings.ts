import { useCallback, useEffect, useState } from 'react'
import type { GroqConfig, Settings } from '../types/domain'
import { DEFAULT_GROQ_CONFIG, DEFAULT_SETTINGS, loadGroqConfig, loadSettings, saveGroqConfig, saveSettings } from '../storage/settings'

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadSettings().then((s) => {
      if (!cancelled) {
        setSettings(s)
        setLoaded(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      saveSettings(next).catch((err) => console.error('Falha ao salvar configurações:', err))
      return next
    })
  }, [])

  return { settings, update, loaded }
}

export function useGroqConfig() {
  const [config, setConfig] = useState<GroqConfig>(DEFAULT_GROQ_CONFIG)

  useEffect(() => {
    let cancelled = false
    loadGroqConfig().then((c) => {
      if (!cancelled) setConfig(c)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const update = useCallback((patch: Partial<GroqConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch }
      saveGroqConfig(next).catch((err) => console.error('Falha ao salvar configuração da IA:', err))
      return next
    })
  }, [])

  return { groqConfig: config, updateGroqConfig: update }
}
