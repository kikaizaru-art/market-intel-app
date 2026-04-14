import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { ChartTooltip, SentimentBar } from '../shared/index.js'
import { ACCENT_ORANGE } from '../../constants.js'

export default function ReviewsTab({ reviewChartData, latestReview, scoreDiff, totalReviews, targetReview, reviewSource }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: '#6e7681' }}>レビュースコア & レビュー数推移</span>
        {reviewSource && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: 'rgba(56,139,253,0.1)', color: '#388bfd', border: '1px solid rgba(56,139,253,0.3)' }}>出典: {reviewSource}</span>}
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={reviewChartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} tickLine={false} />
          <YAxis yAxisId="left" domain={[0, 5]} tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Bar yAxisId="right" dataKey="レビュー数" fill={`${ACCENT_ORANGE}33`} stroke={`${ACCENT_ORANGE}66`} strokeWidth={1} />
          <Line yAxisId="left" type="monotone" dataKey="スコア" stroke={ACCENT_ORANGE} strokeWidth={2} dot={{ fill: ACCENT_ORANGE, r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <div className="stat-card">
          <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>現在スコア</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: ACCENT_ORANGE }}>★ {latestReview?.score}</div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>前月比</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: parseFloat(scoreDiff) >= 0 ? '#56d364' : '#f85149' }}>
            {parseFloat(scoreDiff) >= 0 ? '▲' : '▼'} {Math.abs(scoreDiff)}
          </div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>累計レビュー</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#e6edf3' }}>{totalReviews.toLocaleString()}件</div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>好意的比率</div>
          <SentimentBar ratio={latestReview?.positive_ratio ?? 0} color={ACCENT_ORANGE} />
        </div>
      </div>

      <div style={{ fontSize: 10, color: '#6e7681', marginTop: 12, marginBottom: 6 }}>月別詳細</div>
      <div style={{ overflowY: 'auto', maxHeight: 160 }}>
        <table className="ads-table">
          <thead><tr><th>月</th><th>スコア</th><th>レビュー数</th><th>好意的</th></tr></thead>
          <tbody>
            {[...targetReview.monthly].reverse().map((m, i) => (
              <tr key={i}>
                <td style={{ fontFamily: 'monospace', fontSize: 10, color: '#6e7681' }}>{m.month}</td>
                <td style={{ color: ACCENT_ORANGE, fontWeight: 600 }}>★ {m.score}</td>
                <td style={{ color: '#e6edf3' }}>{m.count.toLocaleString()}</td>
                <td><SentimentBar ratio={m.positive_ratio} color={ACCENT_ORANGE} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 4 }}>主な不満</div>
          {targetReview.top_complaints.map(c => (<span key={c} className="complaint-tag">{c}</span>))}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 4 }}>主な好評点</div>
          {targetReview.top_praises.map(p => (<span key={p} className="praise-tag">{p}</span>))}
        </div>
      </div>
    </>
  )
}
