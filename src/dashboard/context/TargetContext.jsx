import { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react'
import { generateCompetitorData } from '../services/generateData.js'
import { loadCollectedData, detectVersionEvents } from '../services/loadCollectedData.js'

const TargetContext = createContext(null)

const DATA_MODE_STORAGE_KEY = 'market-intel:data-mode'
const TARGET_STORAGE_KEY = 'market-intel:target'
const VALID_MODES = ['auto', 'mock']

function normalizeName(s) {
  if (s == null) return ''
  return String(s).trim().toLowerCase().replace(/\s+/g, '')
}

function namesMatch(a, b) {
  const na = normalizeName(a)
  const nb = normalizeName(b)
  if (!na || !nb) return false
  if (na === nb) return true
  // 片方がもう片方に含まれる場合 (例: "モンスト" / "モンスターストライク")
  if (na.length >= 3 && nb.length >= 3 && (na.includes(nb) || nb.includes(na))) return true
  return false
}

/**
 * 入力された target が収集データに含まれているかを判定する。
 * 一致した場合はその app の id を返す (isMain 付替用)。
 *
 * マッチ条件 (いずれか):
 *  - reviews.apps[].name が target.appName / companyName と一致
 *  - ranking.positions[].name が target.appName と一致
 *  - trends._genres (keywords) に target.appName が含まれる
 */
function resolveTargetMatch(target, collected) {
  if (!target || !collected) return { matched: false, matchedId: null }
  const name = target.appName
  const company = target.companyName

  const apps = collected.reviews?.apps || []
  for (const app of apps) {
    if (namesMatch(app.name, name) || (company && namesMatch(app.name, company))) {
      return { matched: true, matchedId: app.id }
    }
  }

  const positions = collected.ranking?.positions || []
  for (const p of positions) {
    if (p?.name && namesMatch(p.name, name)) {
      return { matched: true, matchedId: null }
    }
  }

  const keywords = collected.trends?._genres || []
  for (const kw of keywords) {
    if (namesMatch(kw, name)) return { matched: true, matchedId: null }
  }

  return { matched: false, matchedId: null }
}

/**
 * 入力したターゲットが競合として収集データに含まれていた場合、
 * その app を isMain: true に昇格し、元々の main を降格する。
 * こうすることでチャート・KPI・センチメント解析が入力ターゲット基準になる。
 */
function remapMainApp(reviews, targetId) {
  if (!reviews?.apps?.length || !targetId) return reviews
  const hasTarget = reviews.apps.some(a => a.id === targetId)
  if (!hasTarget) return reviews
  const already = reviews.apps.find(a => a.id === targetId)?.isMain
  if (already) return reviews
  return {
    ...reviews,
    apps: reviews.apps.map(a => ({
      ...a,
      isMain: a.id === targetId,
    })),
  }
}

function loadInitialDataMode() {
  if (typeof window === 'undefined') return 'auto'
  try {
    const stored = window.localStorage.getItem(DATA_MODE_STORAGE_KEY)
    return VALID_MODES.includes(stored) ? stored : 'auto'
  } catch {
    return 'auto'
  }
}

function loadInitialTarget() {
  if (typeof window === 'undefined') return null
  try {
    const stored = window.localStorage.getItem(TARGET_STORAGE_KEY)
    if (!stored) return null
    const parsed = JSON.parse(stored)
    return parsed && parsed.appName ? parsed : null
  } catch {
    return null
  }
}

export function TargetProvider({ children }) {
  const [target, setTargetState] = useState(loadInitialTarget) // { appName, companyName, genre }
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

    // 入力したアプリ/インフルエンサーが収集データの対象に含まれていない場合は
    // モック生成をそのまま返す (他アプリのデータを別名で流用してしまうのを防ぐ)
    const match = resolveTargetMatch(target, collected)
    if (!match.matched) {
      if (typeof console !== 'undefined') {
        console.info(
          `[dashboard] collected data (${collected.domain || '?'}) does not match target "${target.appName}" — using mock.`
        )
      }
      return generated
    }

    // 入力がメインでない競合に一致した場合は isMain を付け替える
    const reviews = match.matchedId
      ? remapMainApp(collected.reviews, match.matchedId)
      : collected.reviews || generated.reviews

    // アプデ履歴からバージョン変更イベントを自動生成し、既存イベントとマージ
    const versionEvents = detectVersionEvents(reviews)
    const baseEvents = generated.events || { source: 'mock', events: [] }
    const mergedEvents = {
      ...baseEvents,
      events: [
        ...(baseEvents.events || []),
        ...versionEvents.events,
      ],
    }

    return {
      ...generated,
      trends: collected.trends || generated.trends,
      reviews,
      ranking: collected.ranking || null,
      community: collected.community || null,
      twitter: collected.twitter || null,
      youtubeChannels: collected.youtubeChannels || null,
      events: mergedEvents,
      industry: {
        ...generated.industry,
        news: collected.news || generated.industry.news,
      },
    }
  }, [target?.appName, target?.companyName, target?.genre, collected, dataMode])

  const setTarget = useCallback((t) => {
    setTargetState(t)
    if (t) {
      try {
        window.localStorage.setItem(TARGET_STORAGE_KEY, JSON.stringify(t))
      } catch {
        // ignore storage failures
      }
    }
  }, [])

  const reset = useCallback(() => setTargetState(null), [])

  // データソース情報を提供（モードを反映）
  // 入力 target が収集データと一致しない場合は null を返し、ヘッダー等で
  // 「モック(既定)」表示に落とすことで「別アプリのデータを流用している」
  // 誤解を防ぐ
  const dataSources = useMemo(() => {
    if (dataMode === 'mock' || !collected) return null
    if (!target || !resolveTargetMatch(target, collected).matched) return null
    return {
      collected_at: collected.collected_at,
      trends: !!collected.trends,
      reviews: !!collected.reviews,
      ranking: !!collected.ranking,
      community: !!collected.community,
      news: !!collected.news,
      twitter: !!collected.twitter,
      youtubeChannels: !!collected.youtubeChannels,
    }
  }, [collected, dataMode, target?.appName, target?.companyName])

  const value = useMemo(
    () => ({ target, data, dataSources, dataMode, setDataMode, hasCollected: !!collected, setTarget, reset }),
    [target, data, dataSources, dataMode, setDataMode, collected, setTarget, reset]
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
