import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'
import i18n from './i18n/config'
import { useI18nStore } from './stores/i18n.store'
const language = useI18nStore.getState().language
const direction = language === 'ar' ? 'rtl' : 'ltr'
document.documentElement.lang = language
document.documentElement.dir = direction
void i18n.changeLanguage(language)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)