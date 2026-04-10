import { useState, useMemo, memo } from 'react'
import {
  ComposedChart, Bar, Line, LineChart, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'

const ACCENT = '#f0883e'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6, padding: '8px 12px', fontSize: 11 }}>
      <p style={{ color: '#8b949e', marginBottom: 4 }}>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey || p.name} style={{ color: p.color ?? ACCENT }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

function SentimentBar({ ratio, color }) {
  const pct = Math.round(ratio * 100)
  return (
    <div className="sentiment-bar-wrap">
      <div className="sentiment-bar-track">
        <div className="sentiment-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="sentiment-bar-label" style={{ color }}>{pct}%</span>
    </div>
  )
}

const TYPE_COLORS = {
  'ガチャ': '#d2a8ff', 'コラボ': '#f0883e', 'シーズン': '#56d364',
  'キャンペーン': '#388bfd', 'アップデート': '#8b949e',
}

const STATUS_COLORS = { '運営中': '#56d364', '開発中': '#388bfd' }

export default memo(function AppInfoView({ target, reviews, fundamentals, events, corporate, causation }) {
  const [tab, setTab] = useState('overview')

  const TABS = [
    { key: 'overview', label: '概要' },
    { key: 'reviews', label: 'レビュー' },
    { key: 'ranking', label: 'ランキング' },
    { key: 'events', label: 'イベント' },
    { key: 'corporate', label: '企業' },
  ]

  // Extract target app data only
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

  // Review chart data
  const reviewChartData = useMemo(() =>
    targetReview?.monthly.map(m => ({
      month: m.month.slice(5) + '月',
      スコア: m.score,
      レビュー数: m.count,
      好意的: Math.round(m.positive_ratio * 100),
    })) || [], [targetReview])

  // Ranking chart data
  const rankChartData = useMemo(() =>
    targetFundamental?.weekly_sales_rank.map(d => ({
      date: d.date,
      順位: d.rank,
    })) || [], [targetFundamental])

  // Summary stats
  const latestReview = targetReview?.monthly[targetReview.monthly.length - 1]
  const prevReview = targetReview?.monthly[targetReview.monthly.length - 2]
  const scoreDiff = latestReview && prevReview ? (latestReview.score - prevReview.score).toFixed(1) : '0.0'
  const totalReviews = targetReview?.monthly.reduce((s, m) => s + m.count, 0) || 0

  const latestRank = targetFundamental?.weekly_sales_rank[targetFundamental.weekly_sales_rank.length - 1]?.rank
  const prevRank = targetFundamental?.weekly_sales_rank[targetFundamental.weekly_sales_rank.length - 5]?.rank
  const rankDiff = latestRank && prevRank ? prevRank - latestRank : 0

  const latestQ = targetCompany?.quarterly_financials?.[targetCompany.quarterly_financials.length - 1]
  const prevQ = targetCompany?.quarterly_financials?.[targetCompany.quarterly_financials.length - 2]

  // Corporate chart data
  const quarterlyData = useMemo(() =>
    targetCompany?.quarterly_financials?.map(q => ({
      quarter: q.quarter,
      売上: q.revenue_b,
      営業利益: q.op_profit_b,
      営業利益率: q.op_margin,
    })) || [], [targetCompany])

  function formatDate(dateStr) {
    const [, month, day] = dateStr.split('-')
    return day === '05' || day === '04' || day === '01' ? `${parseInt(month)}月` : ''
  }

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
          <>
            <div className="appinfo-overview-grid">
              <div className="stat-card">
                <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>レビュースコア</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: ACCENT }}>★ {latestReview?.score ?? '-'}</span>
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
                <SentimentBar ratio={latestReview?.positive_ratio ?? 0} color={ACCENT} />
              </div>
            </div>

            {/* Mini review trend */}
            <div style={{ fontSize: 10, color: '#6e7681', marginTop: 12, marginBottom: 4 }}>レビュースコア推移</div>
            <ResponsiveContainer width="100%" height={100}>
              <LineChart data={reviewChartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} tickLine={false} />
                <YAxis domain={[3, 5]} tick={{ fontSize: 9, fill: '#6e7681' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="スコア" stroke={ACCENT} strokeWidth={2} dot={{ fill: ACCENT, r: 2 }} />
              </LineChart>
            </ResponsiveContainer>

            {/* Mini rank trend */}
            <div style={{ fontSize: 10, color: '#6e7681', marginTop: 10, marginBottom: 4 }}>セールスランキング推移</div>
            <ResponsiveContainer width="100%" height={100}>
              <LineChart data={rankChartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 9, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} tickLine={false} />
                <YAxis reversed domain={[1, 100]} tick={{ fontSize: 9, fill: '#6e7681' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="順位" stroke="#388bfd" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>

            {/* Complaints & Praises */}
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
        )}

        {tab === 'reviews' && targetReview && (
          <>
            <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 4 }}>レビュースコア & レビュー数推移</div>
            <ResponsiveContainer width="100%" height={180}>
              <ComposedChart data={reviewChartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} tickLine={false} />
                <YAxis yAxisId="left" domain={[0, 5]} tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar yAxisId="right" dataKey="レビュー数" fill={`${ACCENT}33`} stroke={`${ACCENT}66`} strokeWidth={1} />
                <Line yAxisId="left" type="monotone" dataKey="スコア" stroke={ACCENT} strokeWidth={2} dot={{ fill: ACCENT, r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <div className="stat-card">
                <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>現在スコア</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: ACCENT }}>★ {latestReview?.score}</div>
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
                <SentimentBar ratio={latestReview?.positive_ratio ?? 0} color={ACCENT} />
              </div>
            </div>

            {/* Monthly breakdown */}
            <div style={{ fontSize: 10, color: '#6e7681', marginTop: 12, marginBottom: 6 }}>月別詳細</div>
            <div style={{ overflowY: 'auto', maxHeight: 160 }}>
              <table className="ads-table">
                <thead><tr><th>月</th><th>スコア</th><th>レビュー数</th><th>好意的</th></tr></thead>
                <tbody>
                  {[...targetReview.monthly].reverse().map((m, i) => (
                    <tr key={i}>
                      <td style={{ fontFamily: 'monospace', fontSize: 10, color: '#6e7681' }}>{m.month}</td>
                      <td style={{ color: ACCENT, fontWeight: 600 }}>★ {m.score}</td>
                      <td style={{ color: '#e6edf3' }}>{m.count.toLocaleString()}</td>
                      <td><SentimentBar ratio={m.positive_ratio} color={ACCENT} /></td>
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
        )}

        {tab === 'ranking' && targetFundamental && (
          <>
            <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 4 }}>セールスランキング推移 (低い=上位)</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={rankChartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} tickLine={false} />
                <YAxis reversed domain={[1, 100]} tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
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
        )}

        {tab === 'events' && (
          <>
            <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 6 }}>
              {target.appName} のイベント — {targetEvents.length}件
            </div>
            {targetEvents.length === 0 ? (
              <div style={{ fontSize: 11, color: '#484f58', padding: 16, textAlign: 'center' }}>イベントなし</div>
            ) : (
              <>
                <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {targetEvents.map((event, i) => (
                    <div key={i} className="event-item" style={{ borderLeftColor: TYPE_COLORS[event.type] || '#8b949e' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span className="event-type-badge" style={{ background: `${TYPE_COLORS[event.type] || '#8b949e'}22`, color: TYPE_COLORS[event.type] || '#8b949e', borderColor: `${TYPE_COLORS[event.type] || '#8b949e'}44` }}>{event.type}</span>
                        <span style={{ fontSize: 9, color: '#484f58', marginLeft: 'auto' }}>{event.source}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#e6edf3', fontWeight: 500 }}>{event.name}</div>
                      <div style={{ fontSize: 9, color: '#6e7681', fontFamily: 'monospace' }}>{event.start}{event.end ? ` → ${event.end}` : ''}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  {Object.entries(TYPE_COLORS).map(([type, color]) => {
                    const count = targetEvents.filter(e => e.type === type).length
                    if (count === 0) return null
                    return (
                      <div key={type} className="stat-card">
                        <div style={{ fontSize: 9, color: '#6e7681' }}>{type}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color }}>{count}<span style={{ fontSize: 9, color: '#6e7681' }}>件</span></div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* Causation notes for target app */}
            {targetCausation.length > 0 && (
              <>
                <div style={{ fontSize: 10, color: '#6e7681', marginTop: 12, marginBottom: 6 }}>因果メモ</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {targetCausation.map(note => (
                    <div key={note.id} className={`note-card ${note.impact}`}>
                      <div className="note-header">
                        <span className="note-date">{note.date}</span>
                        <span className={`note-layer-badge layer-${note.layer}`}>{note.layer}</span>
                      </div>
                      <div className="note-event">{note.event}</div>
                      <div className="note-memo">{note.memo}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {tab === 'corporate' && targetCompany && (
          <>
            <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 6 }}>
              {targetCompany.name} — {targetCompany.segment}
            </div>

            {/* Financials chart */}
            <ResponsiveContainer width="100%" height={170}>
              <ComposedChart data={quarterlyData} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                <XAxis dataKey="quarter" tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 40]} tick={{ fontSize: 10, fill: '#6e7681' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar yAxisId="left" dataKey="売上" fill={`${ACCENT}55`} stroke={ACCENT} strokeWidth={1} />
                <Bar yAxisId="left" dataKey="営業利益" fill="#56d36444" stroke="#56d364" strokeWidth={1} />
                <Line yAxisId="right" type="monotone" dataKey="営業利益率" name="営業利益率(%)" stroke="#e3b341" strokeWidth={2} dot={{ fill: '#e3b341', r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>

            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {latestQ && prevQ && (
                <div className="stat-card">
                  <div style={{ fontSize: 10, color: '#6e7681' }}>売上 ({latestQ.quarter})</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT }}>
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

            {/* Titles */}
            <div style={{ fontSize: 10, color: '#6e7681', marginTop: 12, marginBottom: 6 }}>タイトル一覧 ({targetCompany.titles.length}本)</div>
            <div style={{ overflowY: 'auto', maxHeight: 140 }}>
              <table className="ads-table">
                <thead><tr><th>タイトル</th><th>ジャンル</th><th>ステータス</th><th>リリース</th></tr></thead>
                <tbody>
                  {targetCompany.titles.map((t, i) => (
                    <tr key={i}>
                      <td style={{ color: t.name === target.appName ? ACCENT : '#e6edf3', fontWeight: t.name === target.appName ? 700 : 500 }}>{t.name}</td>
                      <td style={{ color: '#8b949e' }}>{t.genre}</td>
                      <td><span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: `${STATUS_COLORS[t.status]}22`, color: STATUS_COLORS[t.status], border: `1px solid ${STATUS_COLORS[t.status]}44` }}>{t.status}</span></td>
                      <td style={{ fontSize: 10, color: '#6e7681', fontFamily: 'monospace' }}>{t.release}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Hiring */}
            {targetCompany.hiring_roles.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 4 }}>採用中ポジション</div>
                <div>{targetCompany.hiring_roles.map(r => (<span key={r} className="hiring-tag">{r}</span>))}</div>
              </div>
            )}
          </>
        )}
      </div>
      <div className="panel-footer">generated data — 対象アプリの情報を抽出表示</div>
    </div>
  )
})
