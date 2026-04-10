import { TYPE_COLORS } from '../../constants.js'

export default function EventsTab({ target, targetEvents, targetCausation }) {
  return (
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
  )
}
