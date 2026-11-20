import { RouterProvider } from 'react-router-dom'
import { router } from '@/routes'
import { useEffect, useState } from 'react'
import { useThemeStore } from '@/stores/theme.store'
import { useI18nStore } from '@/stores/i18n.store'
import { Spinner } from '@/components/ui'

function App() {
  const { theme, applyTheme } = useThemeStore()
  const { language, direction, applyDirection } = useI18nStore()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    applyTheme(theme)
  }, [theme, applyTheme])

  useEffect(() => {
    applyDirection(language, direction)
  }, [language, direction, applyDirection])

  useEffect(() => {
    // Demo data is seeded once by the managed SQLite server (server/seed.mjs).
    setReady(true)
  }, [])

  if (!ready) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-bg text-text">
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-info text-sm font-black text-white shadow-card">
          C.F.C
          <div className="absolute -inset-2 animate-ping rounded-3xl border border-primary/20" />
        </div>
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Spinner /> Preparing the certified financial workspace…
        </div>
        <p className="text-[11px] uppercase tracking-[0.25em] text-text-secondary/70">Muraqib · Financial Intelligence</p>
      </div>
    )
  }

  return <RouterProvider router={router} />
}

export default App
