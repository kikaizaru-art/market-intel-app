import { useMemo } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { ChartTooltip } from '../shared/index.js'
import { ACCENT_ORANGE, STATUS_COLORS } from '../../constants.js'

export default function CorporateTab({ target, targetCompany }) {
  const quarterlyData = useMemo(() =>
    targetCompany?.quarterly_financials?.map(q => ({
      quarter: q.quarter,
      売上: q.revenue_b,
      営業利益: q.op_profit_b,
      営業利益率: q.op_margin,
    })) || [], [targetCompany])

  const latestQ = targetCompany?.quarterly_financials?.[targetCompany.quarterly_financials.length - 1]
  const prevQ = targetCompany?.quarterly_financials?.[targetCompany.quarterly_financials.length - 2]

  return (
    <>
      <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 6 }}>
        {targetCompany.name} — {targetCompany.segment}
      </div>

      <ResponsiveContainer width="100%" height={170}>
        <ComposedChart data={quarterlyData} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
          <XAxis dataKey="quarter" tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} tickLine={false} />
          <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="right" orientation="right" domain={[0, 40]} tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Bar yAxisId="left" dataKey="売上" fill={`${ACCENT_ORANGE}55`} stroke={ACCENT_ORANGE} strokeWidth={1} />
          <Bar yAxisId="left" dataKey="営業利益" fill="#56d36444" stroke="#56d364" strokeWidth={1} />
          <Line yAxisId="right" type="monotone" dataKey="営業利益率" name="営業利益率(%)" stroke="#e3b341" strokeWidth={2} dot={{ fill: '#e3b341', r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>

      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        {latestQ && prevQ && (
          <div className="stat-card">
            <div style={{ fontSize: 10, color: '#6e7681' }}>売上 ({latestQ.quarter})</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT_ORANGE }}>
              {latestQ.revenue_b}億
              <span style={{ fontSize: 10, marginLeft: 4, color: latestQ.revenue_b >= prevQ.revenue_b ? '#56d364' : '#f85149' }}>
                {latestQ.revenue_b >= prevQ.revenue_b ? '▲' : '▼'}{Math.abs(((latestQ.revenue_b - prevQ.revenue_b) / prevQ.revenue_b * 100)).toFixed(0)}%
              </span>
            </div>
          </div>
        )}
        {latestQ && (
          <div className="stat-card">
            <div style={{ fontSize: 10, color: '#6e7681' }}>営業利益率</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#e3b341' }}>{latestQ.op_margin}%</div>
          </div>
        )}
        <div className="stat-card">
          <div style={{ fontSize: 10, color: '#6e7681' }}>上場</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#8b949e' }}>{targetCompany.listed ? targetCompany.ticker : '非上場'}</div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: 10, color: '#6e7681' }}>従業員数</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#e6edf3' }}>{targetCompany.headcount}名</div>
        </div>
      </div>

      <div style={{ fontSize: 10, color: '#6e7681', marginTop: 12, marginBottom: 6 }}>タイトル一覧 ({targetCompany.titles.length}本)</div>
      <div style={{ overflowY: 'auto', maxHeight: 140 }}>
        <table className="ads-table">
          <thead><tr><th>タイトル</th><th>ジャンル</th><th>ステータス</th><th>リリース</th></tr></thead>
          <tbody>
            {targetCompany.titles.map((t, i) => (
              <tr key={i}>
                <td style={{ color: t.name === target.appName ? ACCENT_ORANGE : '#e6edf3', fontWeight: t.name === target.appName ? 700 : 500 }}>{t.name}</td>
                <td style={{ color: '#8b949e' }}>{t.genre}</td>
                <td><span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: `${STATUS_COLORS[t.status]}22`, color: STATUS_COLORS[t.status], border: `1px solid ${STATUS_COLORS[t.status]}44` }}>{t.status}</span></td>
                <td style={{ fontSize: 10, color: '#6e7681', fontFamily: 'monospace' }}>{t.release}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {targetCompany.hiring_roles.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 4 }}>採用中ポジション</div>
          <div>{targetCompany.hiring_roles.map(r => (<span key={r} className="hiring-tag">{r}</span>))}</div>
        </div>
      )}
    </>
  )
}
