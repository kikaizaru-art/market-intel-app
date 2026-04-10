import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { ChartTooltip } from '../shared/index.js'
import { formatDate } from '../../utils.js'

export default function RankingTab({ rankChartData, latestRank, rankDiff, targetFundamental }) {
  return (
    <>
      <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 4 }}>セールスランキング推移 (低い=上位)</div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={rankChartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
          <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} tickLine={false} />
          <YAxis reversed domain={[1, 100]} tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Line type="monotone" dataKey="順位" stroke="#388bfd" strokeWidth={2} dot={{ fill: '#388bfd', r: 2 }} />
        </LineChart>
      </ResponsiveContainer>

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <div className="stat-card">
          <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>現在順位</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#388bfd' }}>{latestRank}位</div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>変動 (4週)</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: rankDiff > 0 ? '#56d364' : rankDiff < 0 ? '#f85149' : '#6e7681' }}>
            {rankDiff > 0 ? `▲${rankDiff}` : rankDiff < 0 ? `▼${Math.abs(rankDiff)}` : '→'}
          </div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>最高順位</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#56d364' }}>
            {Math.min(...targetFundamental.weekly_sales_rank.map(d => d.rank))}位
          </div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>平均順位</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#8b949e' }}>
            {Math.round(targetFundamental.weekly_sales_rank.reduce((s, d) => s + d.rank, 0) / targetFundamental.weekly_sales_rank.length)}位
          </div>
        </div>
      </div>
    </>
  )
}
