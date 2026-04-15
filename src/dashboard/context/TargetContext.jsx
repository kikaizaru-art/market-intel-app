import { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react'
import { generateCompetitorData } from '../services/generateData.js'
import { loadCollectedData } from '../services/loadCollectedData.js'

const TargetContext = createContext(null)

const DATA_MODE_STORAGE_KEY = 'market-intel:data-mode'
const VALID_MODES = ['auto', 'mock']

function loadInitialDataMode() {
  if (typeof window === 'undefined') return 'auto'
  try {
    const stored = window.localStorage.getItem(DATA_MODE_STORAGE_KEY)
    return VALID_MODES.includes(stored) ? stored : 'auto'
  } catch {
    return 'auto'
  }
}

export function TargetProvider({ children }) {
  const [target, setTarget] = useState(null) // { appName, companyName, genre }
  const [collected, setCollected] = useState(null)
  // 'auto': 実データ優先でモックにフォールバック / 'mock': モック固定（テスト用）
  const [dataMode, setDataModeState] = useState(loadInitialDataMode)

  const setDataMode = useCallback((mode) => {
    if (!VALID_MODES.includes(mode)) return
    setDataModeState(mode)
    try {
      window.localStorage.setItem(DATA_MODE_STORAGE_KEY, mode)
    } catch {
      // ignore storage failures
    }
  }, [])

  // 収集データを起動時に読み込み
  useEffect(() => {
    loadCollectedData().then(data => {
      if (data) {
        console.log('[dashboard] collected data loaded:', data.collected_at)
        setCollected(data)
      }
    })
  }, [])

  // Data is generated once per target and memoized, then merged with collected data
  const data = useMemo(() => {
    if (!target) return null
    const generated = generateCompetitorData(target)

    // モックモード or 実データ未取得時は生成データをそのまま返す
    if (dataMode === 'mock' || !collected) return generated

    // 実データで上書き（存在する場合のみ）
    return {
      ...generated,
      trends: collected.trends || generated.trends,
      reviews: collected.reviews || generated.reviews,
      ranking: collected.ranking || null,
      community: collected.community || null,
      industry: {
        ...generated.industry,
        news: collected.news || generated.industry.news,
      },
    }
  }, [target?.appName, target?.companyName, target?.genre, collected, dataMode])

  const reset = useCallback(() => setTarget(null), [])

  // データソース情報を提供（モードを反映）
  const dataSources = useMemo(() => {
    if (dataMode === 'mock' || !collected) return null
    return {
      collected_at: collected.collected_at,
      trends: !!collected.trends,
      reviews: !!collected.reviews,
      ranking: !!collected.ranking,
      community: !!collected.community,
      news: !!collected.news,
    }
  }, [collected, dataMode])

  const value = useMemo(
    () => ({ target, data, dataSources, dataMode, setDataMode, hasCollected: !!collected, setTarget, reset }),
    [target, data, dataSources, dataMode, setDataMode, collected, reset]
  )

  return (
    <TargetContext.Provider value={value}>
      {children}
    </TargetContext.Provider>
  )
}

export function useTarget() {
  const ctx = useContext(TargetContext)
  if (!ctx) throw new Error('useTarget must be used within TargetProvider')
  return ctx
}
