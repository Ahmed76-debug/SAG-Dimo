import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import i18n from '@/i18n/config'

export type Language = 'ar' | 'en'
export type Direction = 'rtl' | 'ltr'

interface I18nState {
  language: Language
  direction: Direction
  setLanguage: (language: Language) => void
  toggleLanguage: () => void
  applyDirection: (language: Language, direction: Direction) => void
}

const getDirection = (lang: Language): Direction => (lang === 'ar' ? 'rtl' : 'ltr')

export const useI18nStore = create<I18nState>()(
  persist(
    (set, get) => ({
      language: 'ar',
      direction: 'rtl',
      setLanguage: (language) => {
        const direction = getDirection(language)
        set({ language, direction })
        i18n.changeLanguage(language)
        get().applyDirection(language, direction)
      },
      toggleLanguage: () => {
        const next = get().language === 'ar' ? 'en' : 'ar'
        get().setLanguage(next)
      },
      applyDirection: (language, direction) => {
        const root = document.documentElement
        root.lang = language
        root.dir = direction
      },
    }),
    {
      name: 'muraqib-i18n',
    },
  ),
)
