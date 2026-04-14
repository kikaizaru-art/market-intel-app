import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { ChartTooltip, SentimentBar } from '../shared/index.js'
import { ACCENT_ORANGE } from '../../constants.js'
import { formatDate } from '../../utils.js'

export default function OverviewTab({ reviewChartData, rankChartData, latestReview, scoreDiff, totalReviews, latestRank, rankDiff, targetReview, reviewSource }) {
  return (
    <>
      <div className="appinfo-overview-grid">
        <div className="stat-card">
          <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>レビュースコア {reviewSource && <span style={{ fontSize: 8, color: '#388bfd' }}>({reviewSource})</span>}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: ACCENT_ORANGE }}>★ {latestReview?.score ?? '-'}</span>
            {scoreDiff !== '0.0' && (
              <span style={{ fontSize: 11, fontWeight: 600, color: parseFloat(scoreDiff) >= 0 ? '#56d364' : '#f85149' }}>
                {parseFloat(scoreDiff) >= 0 ? '▲' : '▼'}{Math.abs(scoreDiff)}
              </span>
            )}
          </div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>セールス順位</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#388bfd' }}>{latestRank ?? '-'}位</span>
            {rankDiff !== 0 && (
              <span style={{ fontSize: 11, color: rankDiff > 0 ? '#56d364' : '#f85149' }}>
                {rankDiff > 0 ? `▲${rankDiff}` : `▼${Math.abs(rankDiff)}`}
              </span>
            )}
          </div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>累計レビュー数</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#e6edf3' }}>{totalReviews.toLocaleString()}件</div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>好意的比率</div>
          <SentimentBar ratio={latestReview?.positive_ratio ?? 0} color={ACCENT_ORANGE} />
        </div>
      </div>

      <div style={{ fontSize: 10, color: '#6e7681', marginTop: 12, marginBottom: 4 }}>レビュースコア推移</div>
      <ResponsiveContainer width="100%" height={100}>
        <LineChart data={reviewChartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
          <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} tickLine={false} />
          <YAxis domain={[3, 5]} tick={{ fontSize: 9, fill: '#6e7681' }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Line type="monotone" dataKey="スコア" stroke={ACCENT_ORANGE} strokeWidth={2} dot={{ fill: ACCENT_ORANGE, r: 2 }} />
        </LineChart>
      </ResponsiveContainer>

      <div style={{ fontSize: 10, color: '#6e7681', marginTop: 10, marginBottom: 4 }}>セールスランキング推移</div>
      <ResponsiveContainer width="100%" height={100}>
        <LineChart data={rankChartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
          <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 9, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} tickLine={false} />
          <YAxis reversed domain={[1, 100]} tick={{ fontSize: 9, fill: '#6e7681' }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Line type="monotone" dataKey="順位" stroke="#388bfd" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 4 }}>主な不満</div>
          {targetReview?.top_complaints.map(c => (<span key={c} className="complaint-tag">{c}</span>))}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 4 }}>主な好評点</div>
          {targetReview?.top_praises.map(p => (<span key={p} className="praise-tag">{p}</span>))}
        </div>
      </div>
    </>
  )
}
