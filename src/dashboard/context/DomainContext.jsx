import { createContext, useContext, useMemo } from 'react'
import mementoMoriConfig from '../../../config/domains/memento-mori.json'

const DOMAIN_ID = 'memento-mori'

const DOMAIN_UI = {
  icon: '\u{2620}\u{FE0F}',
  accent: '#d2a8ff',
  targetLabel: 'アプリ名',
  targetPlaceholder: 'メメントモリ',
  subLabel: '企業名',
  subPlaceholder: 'BOI',
  categoryLabel: 'ジャンル',
  presets: [],
}

const DomainContext = createContext(null)

export function DomainProvider({ children }) {
  const value = useMemo(() => ({
    domainId: DOMAIN_ID,
    config: mementoMoriConfig,
    ui: DOMAIN_UI,
    // 単一ドメイン化したため domainList は 1 件固定、setDomain は no-op
    domainList: [{
      id: DOMAIN_ID,
      name: mementoMoriConfig.name,
      icon: DOMAIN_UI.icon,
      accent: DOMAIN_UI.accent,
      version: mementoMoriConfig.version,
      ready: mementoMoriConfig.version !== '0.1.0',
    }],
    setDomain: () => {},
  }), [])

  return (
    <DomainContext.Provider value={value}>
      {children}
    </DomainContext.Provider>
  )
}

export function useDomain() {
  const ctx = useContext(DomainContext)
  if (!ctx) throw new Error('useDomain must be used within DomainProvider')
  return ctx
}
