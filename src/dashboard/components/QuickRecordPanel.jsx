import { useCallback, memo } from 'react'
import EventQuickInput from './EventQuickInput.jsx'
import { loadCausalNotes, saveCausalNotes } from '../services/patternStore.js'

/**
 * 施策記録パネル (ActionsView トップ配置用)
 *
 * CausationView を開かなくても施策が記録できるよう、EventQuickInput を薄くラップし、
 * IndexedDB (patternStore) に直接保存する。保存後は subscribeCausalNotes 経由で
 * RecommendedActions / HistoryView のオーバレイが自動更新される。
 */
export default memo(function QuickRecordPanel() {
  const handleAdd = useCallback((note) => {
    const current = loadCausalNotes() || []
    saveCausalNotes([note, ...current])
  }, [])

  return (
    <div className="panel" style={{ gridColumn: '1 / -1' }}>
      <div className="panel-header">
        <div className="panel-header-left">
          <div className="panel-indicator" style={{ background: '#f0883e' }} />
          <span className="panel-title" style={{ color: '#f0883e' }}>施策記録</span>
          <span className="panel-tag">何をしたか残す</span>
        </div>
      </div>
      <div className="panel-body">
        <EventQuickInput onAddNote={handleAdd} />
      </div>
      <div className="panel-footer" style={{ fontSize: 9, color: '#484f58' }}>
        記録した施策は推奨アクションの学習と、推移タブのチャート上マーカーに反映されます。
      </div>
    </div>
  )
})
