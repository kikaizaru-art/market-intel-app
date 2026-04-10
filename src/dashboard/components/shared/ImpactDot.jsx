import { IMPACT_COLORS } from '../../constants.js'

export default function ImpactDot({ impact }) {
  return (
    <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: IMPACT_COLORS[impact], marginRight: 4 }} />
  )
}
