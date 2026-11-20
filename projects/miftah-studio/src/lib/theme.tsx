import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export type ThemeId = 'nocturne' | 'obsidian' | 'rosette' | 'pearl' | 'sand' | 'mint';
export type DensityId = 'comfortable' | 'compact';

export interface ThemeDef {
  id: ThemeId;
  name: string;
  nameEn: string;
  mode: 'dark' | 'light';
  bg: string;
  surface: string;
  swatches: string[];
}

export const THEMES: ThemeDef[] = [
  { id: 'nocturne', name: 'نوكتورن', nameEn: 'Nocturne', mode: 'dark', bg: '#080a14', surface: '#111424', swatches: ['#7c7cf8', '#22d3ee', '#f472b6'] },
  { id: 'obsidian', name: 'أوبسيديان', nameEn: 'Obsidian', mode: 'dark', bg: '#070f0c', surface: '#0f1a16', swatches: ['#2dd4a7', '#a3e635', '#38bdf8'] },
  { id: 'rosette', name: 'روزيت', nameEn: 'Rosette', mode: 'dark', bg: '#120a12', surface: '#1c101b', swatches: ['#fb7185', '#fbbf24', '#a78bfa'] },
  { id: 'pearl', name: 'لؤلؤة', nameEn: 'Pearl', mode: 'light', bg: '#f3f5fb', surface: '#ffffff', swatches: ['#4f46e5', '#0891b2', '#db2777'] },
  { id: 'sand', name: 'صحراء', nameEn: 'Sand', mode: 'light', bg: '#f7f3ea', surface: '#fffdf8', swatches: ['#b45309', '#15803d', '#be123c'] },
  { id: 'mint', name: 'نعناع', nameEn: 'Mint', mode: 'light', bg: '#f0f7f4', surface: '#ffffff', swatches: ['#047857', '#0d9488', '#0ea5e9'] },
];

const STORAGE_KEY = 'miftah.theme';
const DENSITY_KEY = 'miftah.density';

interface ThemeContextValue {
  theme: ThemeId;
  def: ThemeDef;
  density: DensityId;
  setTheme: (theme: ThemeId) => void;
  setDensity: (density: DensityId) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveInitial(): ThemeId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    if (stored && THEMES.some((t) => t.id === stored)) return stored;
  } catch { /* storage unavailable */ }
  return 'nocturne';
}

function resolveDensity(): DensityId {
  try {
    const stored = localStorage.getItem(DENSITY_KEY);
    if (stored === 'compact' || stored === 'comfortable') return stored;
  } catch { /* storage unavailable */ }
  return 'comfortable';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(resolveInitial);
  const [density, setDensityState] = useState<DensityId>(resolveDensity);
  // Remember whether this is a fresh session before defaults get persisted.
  const hasStoredPrefs = useRef(
    (() => {
      try {
        return Boolean(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(DENSITY_KEY));
      } catch {
        return true;
      }
    })()
  );

  const def = useMemo(() => THEMES.find((t) => t.id === theme) || THEMES[0], [theme]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = def.mode;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', def.bg);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* ignore */ }
  }, [theme, def]);

  useEffect(() => {
    document.documentElement.dataset.density = density;
    try { localStorage.setItem(DENSITY_KEY, density); } catch { /* ignore */ }
  }, [density]);

  // Fresh sessions inherit the studio's default appearance from the server.
  useEffect(() => {
    if (hasStoredPrefs.current) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/v1/branding');
        if (!res.ok) return;
        const payload = await res.json();
        const data = payload?.data;
        if (cancelled || !data) return;
        if (THEMES.some((t) => t.id === data.theme)) setThemeState(data.theme as ThemeId);
        if (data.density === 'compact' || data.density === 'comfortable') setDensityState(data.density);
        hasStoredPrefs.current = true;
      } catch {
        /* offline or API unavailable: keep local defaults */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const setTheme = (next: ThemeId) => setThemeState(next);
  const setDensity = (next: DensityId) => setDensityState(next);

  const toggleMode = () => {
    const target = def.mode === 'dark' ? THEMES.find((t) => t.mode === 'light') : THEMES.find((t) => t.mode === 'dark');
    if (target) setThemeState(target.id);
  };

  return (
    <ThemeContext.Provider value={{ theme, def, density, setTheme, setDensity, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
