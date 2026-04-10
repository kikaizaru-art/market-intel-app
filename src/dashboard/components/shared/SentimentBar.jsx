/**
 * 好意的比率バー — レビュー系で再利用
 */
export default function SentimentBar({ ratio, color }) {
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
