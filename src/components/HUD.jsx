export default function HUD({ hp, maxHp, score, wave, level, xp, xpToNext, gold }) {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100))
  const xpPct = xpToNext ? Math.max(0, Math.min(100, (xp / xpToNext) * 100)) : 0
  return (
    <div className="hud">
      <div className="hud-top">
        <div className="hp-bar-wrap">
          <div className="hp-bar-bg">
            <div
              className="hp-bar-fill"
              style={{ width: `${pct}%`, background: pct < 25 ? '#ff3355' : '#ff5c7a' }}
            />
          </div>
          <span className="hp-text">{hp}/{maxHp}</span>
        </div>
        <div className="wave-text">Wave {wave}</div>
        <div className="score-text">{score}</div>
      </div>
      <div className="hud-second-row">
        <div className="xp-bar-wrap">
          <span className="level-text">Lv{level}</span>
          <div className="xp-bar-bg">
            <div className="xp-bar-fill" style={{ width: `${xpPct}%` }} />
          </div>
        </div>
        <div className="gold-text">🪙 {gold}</div>
      </div>
    </div>
  )
}
