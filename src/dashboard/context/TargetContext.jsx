import { createContext, useContext, useState, useMemo, useCallback } from 'react'
import { generateCompetitorData } from '../services/generateData.js'

const TargetContext = createContext(null)

export function TargetProvider({ children }) {
  const [target, setTarget] = useState(null) // { appName, companyName, genre }

  // Data is generated once per target and memoized
  const data = useMemo(() => {
    if (!target) return null
    return generateCompetitorData(target)
  }, [target?.appName, target?.companyName, target?.genre])

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
