import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SessionUser } from '@/services/auth.service'
import { logout as logoutApi } from '@/services/auth.service'

interface AuthState {
  user: SessionUser | null
  setUser: (user: SessionUser | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      logout: () => {
        void logoutApi()
        set({ user: null })
      },
    }),
    { name: 'muraqib-session' },
  ),
)
