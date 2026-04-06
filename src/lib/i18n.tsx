'use client'

/**
 * @파일: lib/i18n.tsx
 * @설명: 다국어 지원 — LanguageContext, translations, useLanguage hook
 *        지원 언어: EN, KO, JA
 *        선택한 언어는 localStorage에 저장되어 새로고침 후에도 유지됨
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react'

export type Lang = 'en' | 'ko' | 'ja'

export const languages: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ko', label: '한국어' },
  { code: 'ja', label: '日本語' },
]

// ─── 번역 사전 ──────────────────────────────────────────────────

const translations = {
  en: {
    nav: {
      about: 'About',
      product: 'Product',
      pricing: 'Pricing',
      changelog: 'ChangeLog',
      manual: 'Manual',
      contact: 'Contact',
      login: 'Log in',
      getStarted: 'Get started',
      myPage: 'My Page',
      settings: 'Settings',
      logout: 'Log out',
    },
    dashboard: {
      overview: 'Overview',
      licenses: 'Licenses',
      billing: 'Billing',
      settings: 'Settings',
      logout: 'Log out',
    },
    common: {
      language: 'Language',
    },
  },
  ko: {
    nav: {
      about: '소개',
      product: '제품',
      pricing: '요금제',
      changelog: '업데이트',
      manual: '매뉴얼',
      contact: '문의',
      login: '로그인',
      getStarted: '시작하기',
      myPage: '마이페이지',
      settings: '설정',
      logout: '로그아웃',
    },
    dashboard: {
      overview: '개요',
      licenses: '라이선스',
      billing: '결제',
      settings: '설정',
      logout: '로그아웃',
    },
    common: {
      language: '언어',
    },
  },
  ja: {
    nav: {
      about: '概要',
      product: '製品',
      pricing: '料金',
      changelog: '更新履歴',
      manual: 'マニュアル',
      contact: 'お問い合わせ',
      login: 'ログイン',
      getStarted: '始める',
      myPage: 'マイページ',
      settings: '設定',
      logout: 'ログアウト',
    },
    dashboard: {
      overview: 'ダッシュボード',
      licenses: 'ライセンス',
      billing: '請求',
      settings: '設定',
      logout: 'ログアウト',
    },
    common: {
      language: '言語',
    },
  },
}

export type Translations = typeof translations.en

// ─── Context ────────────────────────────────────────────────────

interface LanguageContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: Translations
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  setLang: () => {},
  t: translations.en,
})

// ─── Provider ───────────────────────────────────────────────────

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en')

  // localStorage에서 저장된 언어 불러오기
  useEffect(() => {
    const saved = localStorage.getItem('corezent_lang') as Lang | null
    if (saved && ['en', 'ko', 'ja'].includes(saved)) {
      setLangState(saved)
    }
  }, [])

  function setLang(newLang: Lang) {
    setLangState(newLang)
    localStorage.setItem('corezent_lang', newLang)
  }

  return (
    <LanguageContext.Provider
      value={{ lang, setLang, t: translations[lang] }}
    >
      {children}
    </LanguageContext.Provider>
  )
}

// ─── Hook ───────────────────────────────────────────────────────

export function useLanguage() {
  return useContext(LanguageContext)
}
