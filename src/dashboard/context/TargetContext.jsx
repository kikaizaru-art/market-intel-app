import { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react'
import { generateCompetitorData } from '../services/generateData.js'
import { loadCollectedData } from '../services/loadCollectedData.js'

const TargetContext = createContext(null)

export function TargetProvider({ children }) {
  const [target, setTarget] = useState(null) // { appName, companyName, genre }
  const [collected, setCollected] = useState(null)

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

    if (!collected) return generated

    // 実データで上書き（存在する場合のみ）
    return {
      ...generated,
      trends: collected.trends || generated.trends,
      reviews: collected.reviews || generated.reviews,
      industry: {
        ...generated.industry,
        news: collected.news || generated.industry.news,
      },
    }
  }, [target?.appName, target?.companyName, target?.genre, collected])

  const reset = useCallback(() => setTarget(null), [])

  const value = useMemo(() => ({ target, data, setTarget, reset }), [target, data, reset])

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
