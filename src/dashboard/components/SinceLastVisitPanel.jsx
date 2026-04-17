import { memo } from 'react'

/**
 * 前回訪問時からの変化サマリー。
 *
 * PositionView の先頭に挿し、再訪時に「何が変わったか」を一目で示す。
 * ツールの核心価値である「蓄積 → 推移」を現在地タブで即体感させる役割を持つ。
 *
 * 表示ロジック:
 *  - firstVisit (初回): ウェルカム表示
 *  - tooSoon (直近再訪): 何も表示しない (null を返す)
 *  - 有意変化なし: 「前回訪問以降、目立つ変化はありません」
 *  - 有意変化あり: severity 色付きでリスト表示
 */

const SEVERITY_STYLE = {
  positive: { color: '#56d364', bg: 'rgba(86,211,100,0.12)', border: 'rgba(86,211,100,0.35)', icon: '▲' },
  negative: { color: '#f85149', bg: 'rgba(248,81,73,0.12)', border: 'rgba(248,81,73,0.35)', icon: '▼' },
  neutral:  { color: '#e3b341', bg: 'rgba(227,179,65,0.12)', border: 'rgba(227,179,65,0.35)', icon: '●' },
  info:     { color: '#79c0ff', bg: 'rgba(121,192,255,0.12)', border: 'rgba(121,192,255,0.35)', icon: '✎' },
}

function ChangeItem({ change }) {
  const style = SEVERITY_STYLE[change.severity] || SEVERITY_STYLE.neutral
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 10px',
      background: style.bg,
      border: `1px solid ${style.border}`,
      borderRadius: 6,
      minWidth: 0,
    }}>
      <span style={{
        fontSize: 11,
        fontWeight: 700,
        color: style.color,
        minWidth: 14,
        textAlign: 'center',
        flexShrink: 0,
      }}>{style.icon}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#e6edf3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {change.title}
        </div>
        <div style={{ fontSize: 9, color: '#6e7681', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {change.detail}
        </div>
      </div>
    </div>
  )
}

function SinceLastVisitPanel({ summary, onAcknowledge, onReset }) {
  if (!summary) return null
  if (summary.tooSoon) return null

  const { firstVisit, sinceLabel, changes } = summary

  return (
    <div className="panel" style={{ gridColumn: '1 / -1' }}>
      <div className="panel-header">
        <div className="panel-header-left">
          <div className="panel-indicator" style={{ background: '#d2a8ff' }} />
          <span className="panel-title" style={{ color: '#d2a8ff' }}>
            {firstVisit ? 'ようこそ' : '前回訪問からの変化'}
          </span>
          {!firstVisit && sinceLabel && (
            <span className="panel-tag">{sinceLabel}</span>
          )}
          {!firstVisit && changes.length > 0 && (
            <span className="panel-tag" style={{ color: '#d2a8ff' }}>
              {changes.length}件
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {!firstVisit && (
            <button
              type="button"
              onClick={onAcknowledge}
              style={{
                fontSize: 10,
                padding: '3px 10px',
                borderRadius: 4,
                border: '1px solid rgba(210,168,255,0.35)',
                background: 'rgba(210,168,255,0.12)',
                color: '#d2a8ff',
                cursor: 'pointer',
                fontWeight: 600,
              }}
              title="確認済みにして、このパネルをリセット"
            >
              確認済みにする
            </button>
          )}
          {firstVisit && (
            <button
              type="button"
              onClick={onAcknowledge}
              style={{
                fontSize: 10,
                padding: '3px 10px',
                borderRadius: 4,
                border: '1px solid rgba(210,168,255,0.35)',
                background: 'rgba(210,168,255,0.12)',
                color: '#d2a8ff',
                cursor: 'pointer',
                fontWeight: 600,
              }}
              title="基準日を今日に設定して蓄積を開始"
            >
              開始
            </button>
          )}
        </div>
      </div>
      <div className="panel-body" style={{ padding: '10px 14px' }}>
        {firstVisit ? (
          <div style={{ fontSize: 11, color: '#8b949e', lineHeight: 1.6 }}>
            この対象の<strong style={{ color: '#e6edf3' }}>訪問履歴</strong>はまだありません。
            「開始」を押すと今日を基準に蓄積が始まり、次回以降は
            <strong style={{ color: '#d2a8ff' }}>前回訪問からの変化</strong>がここに表示されます。
          </div>
        ) : changes.length === 0 ? (
          <div style={{ fontSize: 11, color: '#8b949e', padding: '4px 0' }}>
            前回訪問以降、目立った変化は検出されませんでした。
            <span style={{ color: '#6e7681', marginLeft: 4 }}>(レビュー/ランキング/トレンド/因果メモ)</span>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 6,
          }}>
            {changes.map(c => (
              <ChangeItem key={c.key} change={c} />
            ))}
          </div>
        )}
        {!firstVisit && onReset && (
          <div style={{ marginTop: 8, fontSize: 9, color: '#484f58', textAlign: 'right' }}>
            <button
              type="button"
              onClick={onReset}
              style={{
                fontSize: 9,
                background: 'transparent',
                border: 'none',
                color: '#484f58',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: 0,
              }}
              title="基準日を初期化 (次回訪問時に初回扱い)"
            >
              基準日をリセット
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default memo(SinceLastVisitPanel)
