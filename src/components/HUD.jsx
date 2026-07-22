export default function HUD({ hp, maxHp, score, wave, level, xp, xpToNext, gold, mana, maxMana, onPause }) {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100))
  const manaPct = maxMana ? Math.max(0, Math.min(100, (mana / maxMana) * 100)) : 0
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
        <button
          className="menu-inline-btn"
          onTouchStart={(e) => { e.preventDefault(); onPause && onPause() }}
          onMouseDown={onPause}
        >
          ☰
        </button>
        <div className="wave-text">Wave {wave}</div>
        <div className="score-text">{score}</div>
      </div>
      <div className="hud-mana-row">
        <div className="mana-bar-bg">
          <div className="mana-bar-fill" style={{ width: `${manaPct}%` }} />
        </div>
        <span className="mana-text">{mana}/{maxMana}</span>
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
