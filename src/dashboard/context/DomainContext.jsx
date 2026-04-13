import { createContext, useContext, useState, useMemo, useCallback } from 'react'
import gameMarketConfig from '../../../config/domains/game-market.json'
import keibaConfig from '../../../config/domains/keiba.json'
import stockConfig from '../../../config/domains/stock.json'

const DOMAINS = {
  'game-market': gameMarketConfig,
  'keiba': keibaConfig,
  'stock': stockConfig,
}

/** ドメインごとのUI設定 */
const DOMAIN_UI = {
  'game-market': {
    icon: '\u{1F3AE}',
    accent: '#d2a8ff',
    targetLabel: 'アプリ名',
    targetPlaceholder: '例: モンスターストライク',
    subLabel: '企業名',
    subPlaceholder: '例: MIXI（任意）',
    categoryLabel: 'ジャンル',
    presets: [
      { appName: 'モンスターストライク', companyName: 'MIXI', genre: 'RPG' },
      { appName: 'パズル&ドラゴンズ', companyName: 'ガンホー', genre: 'パズル' },
      { appName: 'Clash Royale', companyName: 'Supercell', genre: 'ストラテジー' },
      { appName: 'ウマ娘', companyName: 'Cygames', genre: 'シミュレーション' },
    ],
  },
  'keiba': {
    icon: '\u{1F40E}',
    accent: '#56d364',
    targetLabel: '分析対象',
    targetPlaceholder: '例: 有馬記念',
    subLabel: '条件',
    subPlaceholder: '例: 芝2500m（任意）',
    categoryLabel: 'グレード',
    presets: [
      { appName: '有馬記念', companyName: '中山・芝2500m', genre: 'GI' },
      { appName: '日本ダービー', companyName: '東京・芝2400m', genre: 'GI' },
      { appName: '天皇賞（秋）', companyName: '東京・芝2000m', genre: 'GI' },
      { appName: 'ジャパンカップ', companyName: '東京・芝2400m', genre: 'GI' },
    ],
  },
  'stock': {
    icon: '\u{1F4C8}',
    accent: '#388bfd',
    targetLabel: '銘柄名',
    targetPlaceholder: '例: 任天堂',
    subLabel: '証券コード',
    subPlaceholder: '例: 7974（任意）',
    categoryLabel: 'セクター',
    presets: [
      { appName: '任天堂', companyName: '7974', genre: 'ゲーム・エンタメ' },
      { appName: 'スクウェア・エニックス', companyName: '9684', genre: 'ゲーム・エンタメ' },
      { appName: 'ソニーG', companyName: '6758', genre: 'IT・通信' },
      { appName: 'サイバーエージェント', companyName: '4751', genre: '広告・メディア' },
    ],
  },
}

const DomainContext = createContext(null)

export function DomainProvider({ children }) {
  const [domainId, setDomainId] = useState('game-market')

  const config = useMemo(() => DOMAINS[domainId], [domainId])
  const ui = useMemo(() => DOMAIN_UI[domainId], [domainId])

  const setDomain = useCallback((id) => {
    if (DOMAINS[id]) setDomainId(id)
  }, [])

  const value = useMemo(() => ({
    domainId,
    config,
    ui,
    domains: DOMAINS,
    domainList: Object.entries(DOMAINS).map(([id, cfg]) => ({
      id,
      name: cfg.name,
      icon: DOMAIN_UI[id].icon,
      accent: DOMAIN_UI[id].accent,
      version: cfg.version,
      ready: cfg.version !== '0.1.0', // 0.1.0 = skeleton
    })),
    setDomain,
  }), [domainId, config, ui, setDomain])

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
