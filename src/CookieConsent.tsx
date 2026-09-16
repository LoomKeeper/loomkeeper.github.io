import { useEffect, useState } from 'react'
import './cookieConsent.css'

type ConsentChoice = 'granted' | 'denied'
type Language = 'en' | 'es' | 'fr' | 'he' | 'pl'

type ConsentController = {
  get: () => ConsentChoice | null
  set: (choice: ConsentChoice) => void
}

declare global {
  interface Window {
    loomkeeperAnalyticsConsent?: ConsentController
  }
}

const copy: Record<
  Language,
  {
    accept: string
    body: string
    learnMore: string
    manage: string
    reject: string
    title: string
  }
> = {
  en: {
    accept: 'Accept analytics',
    body: 'We use Google Analytics to understand how visitors use Loomkeeper. Analytics stays off unless you accept.',
    learnMore: 'Learn more',
    manage: 'Manage cookie preferences',
    reject: 'Reject',
    title: 'Your privacy matters',
  },
  es: {
    accept: 'Aceptar analíticas',
    body: 'Usamos Google Analytics para entender cómo se utiliza Loomkeeper. Las analíticas permanecen desactivadas hasta que las aceptes.',
    learnMore: 'Más información',
    manage: 'Gestionar preferencias de cookies',
    reject: 'Rechazar',
    title: 'Tu privacidad importa',
  },
  fr: {
    accept: 'Accepter les statistiques',
    body: 'Nous utilisons Google Analytics pour comprendre comment Loomkeeper est utilisé. Les statistiques restent désactivées sans votre accord.',
    learnMore: 'En savoir plus',
    manage: 'Gérer les préférences de cookies',
    reject: 'Refuser',
    title: 'Votre vie privée compte',
  },
  he: {
    accept: 'אישור נתוני שימוש',
    body: 'אנחנו משתמשים ב-Google Analytics כדי להבין כיצד משתמשים ב-Loomkeeper. נתוני השימוש נשארים כבויים עד לאישורכם.',
    learnMore: 'מידע נוסף',
    manage: 'ניהול העדפות עוגיות',
    reject: 'דחייה',
    title: 'הפרטיות שלכם חשובה',
  },
  pl: {
    accept: 'Akceptuj analitykę',
    body: 'Używamy Google Analytics, aby zrozumieć, jak odwiedzający korzystają z Loomkeeper. Analityka pozostaje wyłączona, dopóki jej nie zaakceptujesz.',
    learnMore: 'Dowiedz się więcej',
    manage: 'Zarządzaj preferencjami plików cookie',
    reject: 'Odrzuć',
    title: 'Twoja prywatność ma znaczenie',
  },
}

const getLanguage = (): Language => {
  const language = document.documentElement.lang.split('-')[0]
  return language in copy ? (language as Language) : 'en'
}

const getStoredChoice = () => window.loomkeeperAnalyticsConsent?.get() ?? null

function CookieConsent() {
  const [language, setLanguage] = useState<Language>(getLanguage)
  const [isOpen, setIsOpen] = useState(() => getStoredChoice() === null)
  const content = copy[language]

  useEffect(() => {
    const updateLanguage = () => setLanguage(getLanguage())
    document.documentElement.addEventListener(
      'lk:languagechange',
      updateLanguage,
    )

    return () =>
      document.documentElement.removeEventListener(
        'lk:languagechange',
        updateLanguage,
      )
  }, [])

  useEffect(() => {
    const legalList = document.querySelector(
      '.foot-grid > div:last-child ul',
    )
    if (!legalList) return

    const listItem = document.createElement('li')
    const button = document.createElement('button')
    button.className = 'cookie-preferences-link'
    button.type = 'button'
    button.textContent = content.manage
    button.addEventListener('click', () => setIsOpen(true))
    listItem.append(button)
    legalList.append(listItem)

    return () => listItem.remove()
  }, [content.manage])

  const choose = (choice: ConsentChoice) => {
    window.loomkeeperAnalyticsConsent?.set(choice)
    setIsOpen(false)
  }

  if (!isOpen) return null

  return (
    <section
      aria-labelledby='cookie-consent-title'
      className='cookie-consent-banner'
      dir={language === 'he' ? 'rtl' : 'ltr'}
      role='dialog'
    >
      <div className='cookie-consent-copy'>
        <h2 id='cookie-consent-title'>{content.title}</h2>
        <p>
          {content.body}{' '}
          <a href='https://app.loomkeeper.com/legal/privacy'>
            {content.learnMore}
          </a>
          .
        </p>
      </div>
      <div className='cookie-consent-actions'>
        <button
          className='cookie-consent-button cookie-consent-reject'
          onClick={() => choose('denied')}
          type='button'
        >
          {content.reject}
        </button>
        <button
          className='cookie-consent-button cookie-consent-accept'
          onClick={() => choose('granted')}
          type='button'
        >
          {content.accept}
        </button>
      </div>
    </section>
  )
}

export default CookieConsent
