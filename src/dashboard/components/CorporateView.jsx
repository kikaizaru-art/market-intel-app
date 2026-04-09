import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, ComposedChart,
} from 'recharts'
import corpData from '../../../data/mock/corporate.json'

const COMPANY_COLORS = ['#388bfd', '#d2a8ff', '#56d364', '#e3b341']
const TREND_LABELS = { increasing: '増員中', stable: '横ばい', decreasing: '減員中' }
const TREND_COLORS = { increasing: '#56d364', stable: '#e3b341', decreasing: '#f85149' }
const STATUS_COLORS = { '運営中': '#56d364', '開発中': '#388bfd' }

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#161b22', border: '1px solid #30363d',
      borderRadius: 6, padding: '8px 12px', fontSize: 11,
    }}>
      <p style={{ color: '#8b949e', marginBottom: 4 }}>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey || p.name} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}{p.dataKey?.includes('margin') ? '%' : p.dataKey?.includes('_b') ? '億' : ''}</strong>
        </p>
      ))}
    </div>
  )
}

export default function CorporateView() {
  const [selectedCompany, setSelectedCompany] = useState('company-a')
  const [tab, setTab] = useState('financial') // financial | pipeline | structure

  const company = corpData.companies.find(c => c.id === selectedCompany)
  const colorIdx = corpData.companies.findIndex(c => c.id === selectedCompany)

  const TABS = [
    { key: 'financial', label: '決算' },
    { key: 'pipeline', label: 'タイトル' },
    { key: 'structure', label: '体制' },
  ]

  // 全社比較用: 最新四半期売上
  const companyComparison = useMemo(() =>
    corpData.companies.map((c, i) => {
      const latest = c.quarterly_financials[c.quarterly_financials.length - 1]
      const prev = c.quarterly_financials[c.quarterly_financials.length - 2]
      return {
        name: c.name,
        revenue: latest.revenue_b,
        margin: latest.op_margin,
        revenue_change: ((latest.revenue_b - prev.revenue_b) / prev.revenue_b * 100).toFixed(1),
        color: COMPANY_COLORS[i],
      }
    }), [])

  // 選択企業の四半期推移
  const quarterlyData = company.quarterly_financials.map(q => ({
    quarter: q.quarter,
    売上: q.revenue_b,
    営業利益: q.op_profit_b,
    営業利益率: q.op_margin,
  }))

  const latestQ = company.quarterly_financials[company.quarterly_financials.length - 1]
  const prevQ = company.quarterly_financials[company.quarterly_financials.length - 2]

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-header-left">
          <div className="panel-indicator corporate-indicator" />
          <span className="panel-title corporate-title">企業分析</span>
          <span className="panel-tag">ファンダメンタル</span>
        </div>
      </div>

      <div className="panel-body">
        {/* 企業選択 */}
        <div className="app-selector" style={{ marginBottom: 6 }}>
          {corpData.companies.map((c, i) => (
            <button
              key={c.id}
              className={`app-btn ${selectedCompany === c.id ? 'active' : ''}`}
              style={selectedCompany === c.id ? {
                background: `${COMPANY_COLORS[i]}22`,
                borderColor: `${COMPANY_COLORS[i]}66`,
                color: COMPANY_COLORS[i],
              } : {}}
              onClick={() => setSelectedCompany(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* タブ切替 */}
        <div className="fundamental-tabs" style={{ marginBottom: 8 }}>
          {TABS.map(t => (
            <button
              key={t.key}
              className={`fundamental-tab corporate-tab ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'financial' && (
          <>
            <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 4 }}>
              {company.name} — {company.segment} 四半期推移 (億円)
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <ComposedChart data={quarterlyData} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                <XAxis dataKey="quarter" tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 40]} tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar yAxisId="left" dataKey="売上" fill={`${COMPANY_COLORS[colorIdx]}55`} stroke={COMPANY_COLORS[colorIdx]} strokeWidth={1} />
                <Bar yAxisId="left" dataKey="営業利益" fill={`#56d36444`} stroke="#56d364" strokeWidth={1} />
                <Line yAxisId="right" type="monotone" dataKey="営業利益率" name="営業利益率(%)" stroke="#e3b341" strokeWidth={2} dot={{ fill: '#e3b341', r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <div className="stat-card">
                <div style={{ fontSize: 10, color: '#6e7681' }}>売上 ({latestQ.quarter})</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: COMPANY_COLORS[colorIdx] }}>
                  {latestQ.revenue_b}億
                  <span style={{ fontSize: 10, marginLeft: 4, color: latestQ.revenue_b >= prevQ.revenue_b ? '#56d364' : '#f85149' }}>
                    {latestQ.revenue_b >= prevQ.revenue_b ? '▲' : '▼'}
                    {Math.abs(((latestQ.revenue_b - prevQ.revenue_b) / prevQ.revenue_b * 100)).toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="stat-card">
                <div style={{ fontSize: 10, color: '#6e7681' }}>営業利益率</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#e3b341' }}>{latestQ.op_margin}%</div>
              </div>
              <div className="stat-card">
                <div style={{ fontSize: 10, color: '#6e7681' }}>上場</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#8b949e' }}>
                  {company.listed ? company.ticker : '非上場'}
                </div>
              </div>
            </div>
          </>
        )}

        {tab === 'pipeline' && (
          <>
            <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 6 }}>
              {company.name} — タイトル一覧 ({company.titles.length}本)
            </div>
            <div style={{ overflowY: 'auto', maxHeight: 200 }}>
              <table className="ads-table">
                <thead>
                  <tr>
                    <th>タイトル</th>
                    <th>ジャンル</th>
                    <th>ステータス</th>
                    <th>リリース</th>
                  </tr>
                </thead>
                <tbody>
                  {company.titles.map((t, i) => (
                    <tr key={i}>
                      <td style={{ color: '#e6edf3', fontWeight: 500 }}>{t.name}</td>
                      <td style={{ color: '#8b949e' }}>{t.genre}</td>
                      <td>
                        <span style={{
                          fontSize: 10, padding: '1px 6px', borderRadius: 10,
                          background: `${STATUS_COLORS[t.status]}22`,
                          color: STATUS_COLORS[t.status],
                          border: `1px solid ${STATUS_COLORS[t.status]}44`,
                        }}>
                          {t.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 10, color: '#6e7681', fontFamily: 'monospace' }}>{t.release}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <div className="stat-card">
                <div style={{ fontSize: 10, color: '#6e7681' }}>運営中</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#56d364' }}>
                  {company.titles.filter(t => t.status === '運営中').length}本
                </div>
              </div>
              <div className="stat-card">
                <div style={{ fontSize: 10, color: '#6e7681' }}>開発中</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#388bfd' }}>
                  {company.titles.filter(t => t.status === '開発中').length}本
                </div>
              </div>
            </div>
          </>
        )}

        {tab === 'structure' && (
          <>
            <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 8 }}>
              {company.name} — 開発体制
            </div>
            {/* 全社比較バー */}
            <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 4 }}>従業員数比較</div>
            <div className="structure-bars">
              {corpData.companies.map((c, i) => {
                const max = Math.max(...corpData.companies.map(co => co.headcount))
                const pct = c.headcount / max * 100
                return (
                  <div key={c.id} className="structure-bar-row">
                    <span className="structure-bar-label">{c.name}</span>
                    <div className="structure-bar-track">
                      <div
                        className="structure-bar-fill"
                        style={{
                          width: `${pct}%`,
                          background: COMPANY_COLORS[i],
                          opacity: c.id === selectedCompany ? 1 : 0.4,
                        }}
                      />
                    </div>
                    <span className="structure-bar-value" style={{ color: COMPANY_COLORS[i] }}>
                      {c.headcount}名
                    </span>
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <div className="stat-card">
                <div style={{ fontSize: 10, color: '#6e7681' }}>人員動向</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: TREND_COLORS[company.headcount_trend] }}>
                  {TREND_LABELS[company.headcount_trend]}
                </div>
              </div>
              <div className="stat-card" style={{ flex: 2 }}>
                <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 3 }}>採用中ポジション</div>
                <div>
                  {company.hiring_roles.length > 0 ? company.hiring_roles.map(r => (
                    <span key={r} className="hiring-tag">{r}</span>
                  )) : (
                    <span style={{ fontSize: 10, color: '#484f58' }}>採用情報なし</span>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="panel-footer">
        mock data — 実データ: 決算短信 / IR / 採用ページ
      </div>
    </div>
  )
}
