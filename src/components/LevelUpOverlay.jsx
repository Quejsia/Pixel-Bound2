import './LevelUpOverlay.css'

export default function LevelUpOverlay({ level, choices, onChoose }) {
  return (
    <div className="overlay levelup-overlay" role="dialog" aria-modal="true" aria-labelledby="levelup-title">
      <div className="levelup-burst" aria-hidden="true">✦</div>
      <p className="levelup-kicker">POWER INCREASED</p>
      <h2 id="levelup-title" className="title levelup-title">LEVEL {level}</h2>
      <p className="levelup-subtitle">Choose one upgrade</p>

      <div className="upgrade-grid">
        {choices.map((choice) => (
          <button key={choice.id} className="upgrade-card" onClick={() => onChoose(choice.id)}>
            <span className="upgrade-icon" aria-hidden="true">{choice.icon}</span>
            <span className="upgrade-name">{choice.name}</span>
            <span className="upgrade-description">{choice.description}</span>
            <span className="upgrade-detail">{choice.short}</span>
            <span className="upgrade-pick">CHOOSE</span>
          </button>
        ))}
      </div>
      <p className="levelup-hint">Your choice lasts for this run.</p>
    </div>
  )
}
