import './LevelUpOverlay.css'

export default function LevelUpOverlay({ level = null, choices = [], onChoose }) {
  return (
    <div className="overlay levelup-overlay" role="dialog" aria-modal="true">
      <div className="levelup-burst" aria-hidden="true">✦</div>
      <p className="levelup-kicker">POWER INCREASED</p>
      <h2 className="title levelup-title">{level ? `LEVEL ${level}` : 'LEVEL UP!'}</h2>
      <p className="levelup-subtitle">Choose one upgrade</p>
      <div className="upgrade-grid perk-grid">
        {choices.map((choice) => (
          <button key={choice.id} className="upgrade-card perk-card" onClick={() => onChoose(choice.id)}>
            <span className="upgrade-icon" aria-hidden="true">{choice.icon || '✦'}</span>
            <span className="upgrade-name">{choice.name || choice.label}</span>
            <span className="upgrade-description">{choice.description}</span>
            <span className="upgrade-detail">{choice.short || ''}</span>
            <span className="upgrade-pick">CHOOSE</span>
          </button>
        ))}
      </div>
      <p className="levelup-hint">Your choice lasts for this run.</p>
    </div>
  )
}
