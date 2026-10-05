import { useEffect, useState } from 'react'
import { useGroqConfig } from './hooks/useSettings'
import { PracticePage, PracticeOverlays } from './pages/PracticePage'
import { StatsPage } from './pages/StatsPage'
import { IconChart, IconFileText, IconKeyboard, IconSparkles } from './components/ui/Icons'
import type { TextEntry } from './types/domain'

type Page = 'practice' | 'stats'

export default function App() {
  const { groqConfig, updateGroqConfig } = useGroqConfig()
  const [page, setPage] = useState<Page>('practice')
  const [showTexts, setShowTexts] = useState(false)
  const [showAi, setShowAi] = useState(false)
  // Texto selecionado vive aqui (e não no PracticePage) para que "Usar"
  // (Meus textos) e "usar texto gerado" (IA) — diálogos montados no App —
  // consigam de fato selecionar o texto da prática.
  const [selectedText, setSelectedText] = useState<TextEntry | null>(null)

  // Tema claro fixo: única identidade visual do MVP.
  useEffect(() => {
    document.documentElement.dataset.theme = 'light'
  }, [])

  return (
    <div className="app-shell">
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
          <button
            className="nav-tab"
            aria-label="Meus textos"
            title="Meus textos"
            onClick={() => setShowTexts(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <IconFileText size={16} /> Textos
          </button>
          <button
            className="nav-tab"
            aria-label="Gerar com IA"
            title="Gerar texto com IA"
            onClick={() => setShowAi(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <IconSparkles size={16} /> IA
          </button>
        </nav>
      </header>

      {page === 'practice' ? (
        <PracticePage selectedText={selectedText} onSelectText={setSelectedText} />
      ) : (
        <StatsPage onBack={() => setPage('practice')} />
      )}

      {/* TextsManager e painel de IA ficam acessíveis de qualquer aba. */}
      <PracticeOverlays
        showTexts={showTexts}
        onCloseTexts={() => setShowTexts(false)}
        showAi={showAi}
        onCloseAi={() => setShowAi(false)}
        groqConfig={groqConfig}
        onGroqChange={updateGroqConfig}
        onUseText={setSelectedText}
      />
    </div>
  )
}
