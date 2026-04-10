import { useState, useMemo, memo } from 'react'
import OverviewTab from './appinfo/OverviewTab.jsx'
import ReviewsTab from './appinfo/ReviewsTab.jsx'
import RankingTab from './appinfo/RankingTab.jsx'
import EventsTab from './appinfo/EventsTab.jsx'
import CorporateTab from './appinfo/CorporateTab.jsx'

const TABS = [
  { key: 'overview', label: '概要' },
  { key: 'reviews', label: 'レビュー' },
  { key: 'ranking', label: 'ランキング' },
  { key: 'events', label: 'イベント' },
  { key: 'corporate', label: '企業' },
]

export default memo(function AppInfoView({ target, reviews, fundamentals, events, corporate, causation }) {
  const [tab, setTab] = useState('overview')

  const targetReview = useMemo(() =>
    reviews?.apps?.find(a => a.id === 'target'), [reviews])

  const targetFundamental = useMemo(() =>
    fundamentals?.apps?.find(a => a.id === 'target'), [fundamentals])

  const targetCompany = useMemo(() =>
    corporate?.companies?.[0], [corporate])

  const targetEvents = useMemo(() =>
    (events?.events || []).filter(e => e.app === target.appName)
      .sort((a, b) => b.start.localeCompare(a.start)),
    [events, target.appName])

  const targetCausation = useMemo(() =>
    (causation?.notes || []).filter(n => n.app === target.appName),
    [causation, target.appName])

  const reviewChartData = useMemo(() =>
    targetReview?.monthly.map(m => ({
      month: m.month.slice(5) + '月',
      スコア: m.score,
      レビュー数: m.count,
      好意的: Math.round(m.positive_ratio * 100),
    })) || [], [targetReview])

  const rankChartData = useMemo(() =>
    targetFundamental?.weekly_sales_rank.map(d => ({
      date: d.date,
      順位: d.rank,
    })) || [], [targetFundamental])

  const latestReview = targetReview?.monthly[targetReview.monthly.length - 1]
  const prevReview = targetReview?.monthly[targetReview.monthly.length - 2]
  const scoreDiff = latestReview && prevReview ? (latestReview.score - prevReview.score).toFixed(1) : '0.0'
  const totalReviews = targetReview?.monthly.reduce((s, m) => s + m.count, 0) || 0

  const latestRank = targetFundamental?.weekly_sales_rank[targetFundamental.weekly_sales_rank.length - 1]?.rank
  const prevRank = targetFundamental?.weekly_sales_rank[targetFundamental.weekly_sales_rank.length - 5]?.rank
  const rankDiff = latestRank && prevRank ? prevRank - latestRank : 0

  return (
    <div className="panel appinfo-panel">
      <div className="panel-header">
        <div className="panel-header-left">
          <div className="panel-indicator appinfo-indicator" />
          <span className="panel-title appinfo-title">{target.appName}</span>
          <span className="panel-tag">{target.genre}</span>
          <span className="panel-tag">{target.companyName}</span>
        </div>
      </div>

      <div className="panel-body">
        <div className="fundamental-tabs">
          {TABS.map(t => (
            <button key={t.key} className={`fundamental-tab appinfo-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>

        {tab === 'overview' && (
          <OverviewTab
            reviewChartData={reviewChartData} rankChartData={rankChartData}
            latestReview={latestReview} scoreDiff={scoreDiff} totalReviews={totalReviews}
            latestRank={latestRank} rankDiff={rankDiff} targetReview={targetReview}
          />
        )}

        {tab === 'reviews' && targetReview && (
          <ReviewsTab
            reviewChartData={reviewChartData} latestReview={latestReview}
            scoreDiff={scoreDiff} totalReviews={totalReviews} targetReview={targetReview}
          />
        )}

        {tab === 'ranking' && targetFundamental && (
          <RankingTab
            rankChartData={rankChartData} latestRank={latestRank}
            rankDiff={rankDiff} targetFundamental={targetFundamental}
          />
        )}

        {tab === 'events' && (
          <EventsTab target={target} targetEvents={targetEvents} targetCausation={targetCausation} />
        )}

        {tab === 'corporate' && targetCompany && (
          <CorporateTab target={target} targetCompany={targetCompany} />
        )}
      </div>
      <div className="panel-footer">対象アプリの情報を抽出表示</div>
    </div>
  )
})
