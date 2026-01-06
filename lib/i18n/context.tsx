'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type Language = 'en' | 'bg'

interface LanguageContextType {
  language: Language
  locale: Language
  setLanguage: (lang: Language) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>('en')
  const [translations, setTranslations] = useState<Record<string, string>>({})

  useEffect(() => {
    const savedLang = localStorage.getItem('memento-language') as Language
    if (savedLang === 'en' || savedLang === 'bg') {
      setLanguageState(savedLang)
    }
  }, [])

  useEffect(() => {
    import(`./translations/${language}.json`)
      .then((module) => setTranslations(module.default))
      .catch(() => setTranslations({}))
  }, [language])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem('memento-language', lang)
  }

  const t = (key: string, vars?: Record<string, string | number>): string => {
    let text = translations[key] || key
    
    if (vars) {
      Object.entries(vars).forEach(([varKey, value]) => {
        text = text.replace(new RegExp(`{{\\s*${varKey}\\s*}}`, 'g'), String(value))
      })
    }
    
    return text
  }

  return (
    <LanguageContext.Provider value={{ language, locale: language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider')
  }
  return context
}

