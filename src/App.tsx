import { useEffect, useState } from 'react'
import type { ThemeId } from './types/domain'
import { useGroqConfig, useSettings } from './hooks/useSettings'
import { PracticePage } from './pages/PracticePage'
import { StatsPage } from './pages/StatsPage'
import { IconChart, IconKeyboard } from './components/ui/Icons'

type Page = 'practice' | 'stats'

const ACCENT_COLORS = {
  blue: '#4f7cff',
  green: '#3ecf74',
  purple: '#9a6bff',
  orange: '#ff9f43',
  pink: '#ff6b9d',
} as const

export default function App() {
  const { settings, update, loaded } = useSettings()
  const { groqConfig, updateGroqConfig } = useGroqConfig()
  const [page, setPage] = useState<Page>('practice')

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme as ThemeId
  }, [settings.theme])

  if (!loaded) {
    return <div className="app-shell" aria-busy="true" />
  }

  return (
    <div
      className="app-shell"
      style={{
        // Cor do destaque configurável aplicada como token.
        ['--accent' as string]: ACCENT_COLORS[settings.accentColor],
        ['--accent-strong' as string]: ACCENT_COLORS[settings.accentColor],
        // Cores do caractere atual (letra + sublinhado) configuráveis.
        ['--caret-color' as string]: ACCENT_COLORS[settings.caretColor],
        ['--caret-underline' as string]: ACCENT_COLORS[settings.caretUnderlineColor],
        fontSize: settings.uiFontSize === 'small' ? '14px' : settings.uiFontSize === 'large' ? '17px' : undefined,
      }}
    >
      <header className="top-bar">
        <div className="brand">
          <span className="brand-badge">
            <IconKeyboard size={20} />
          </span>
          Digitação
        </div>
        <nav className="nav-tabs" role="tablist" aria-label="Navegação">
          <button className="nav-tab" role="tab" aria-selected={page === 'practice'} onClick={() => setPage('practice')}>
            Praticar
          </button>
          <button className="nav-tab" role="tab" aria-selected={page === 'stats'} onClick={() => setPage('stats')}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <IconChart size={16} /> Evolução
            </span>
          </button>
        </nav>
      </header>

      {page === 'practice' ? (
        <PracticePage
          settings={settings}
          onSettingsChange={update}
          groqConfig={groqConfig}
          onGroqChange={updateGroqConfig}
          onOpenStats={() => setPage('stats')}
        />
      ) : (
        <StatsPage onBack={() => setPage('practice')} />
      )}
    </div>
  )
}
