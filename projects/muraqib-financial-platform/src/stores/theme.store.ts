import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeId =
  | 'light'
  | 'light-sand'
  | 'light-mist'
  | 'dark'
  | 'dark-midnight'
  | 'dark-emerald'

export interface ThemeOption {
  id: ThemeId
  label: { ar: string; en: string }
  mode: 'light' | 'dark'
}

export const THEME_OPTIONS: ThemeOption[] = [
  { id: 'light', label: { ar: 'فاتح (افتراضي)', en: 'Light (Default)' }, mode: 'light' },
  { id: 'light-sand', label: { ar: 'فاتح رملي', en: 'Light Sand' }, mode: 'light' },
  { id: 'light-mist', label: { ar: 'فاتح ضبابي', en: 'Light Mist' }, mode: 'light' },
  { id: 'dark', label: { ar: 'داكن (افتراضي)', en: 'Dark (Default)' }, mode: 'dark' },
  { id: 'dark-midnight', label: { ar: 'داكن ليلّي', en: 'Dark Midnight' }, mode: 'dark' },
  { id: 'dark-emerald', label: { ar: 'داكن زمردي', en: 'Dark Emerald' }, mode: 'dark' },
]

export const isDarkTheme = (id: string) => id.startsWith('dark')

interface ThemeState {
  theme: ThemeId
  setTheme: (theme: ThemeId) => void
  toggleTheme: () => void
  applyTheme: (theme: ThemeId) => void
}

const ALL_THEME_IDS = THEME_OPTIONS.map((t) => t.id)

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      setTheme: (theme) => {
        set({ theme })
        get().applyTheme(theme)
      },
      toggleTheme: () => {
        const current = get().theme
        const dark = isDarkTheme(current)
        const next = dark ? 'light' : 'dark'
        get().setTheme(next)
      },
      applyTheme: (theme) => {
        const root = document.documentElement
        root.classList.remove('light', 'dark', ...ALL_THEME_IDS)
        const mode = isDarkTheme(theme) ? 'dark' : 'light'
        root.classList.add(mode, theme)
        root.dataset.theme = theme
        root.style.colorScheme = mode
      },
    }),
    {
      name: 'muraqib-theme',
      version: 2,
      migrate: (persisted: any) => {
        if (persisted && (persisted.theme === 'light' || persisted.theme === 'dark')) return persisted
        if (persisted && !ALL_THEME_IDS.includes(persisted.theme)) return { ...persisted, theme: 'light' }
        return persisted as ThemeState
      },
    },
  ),
)
