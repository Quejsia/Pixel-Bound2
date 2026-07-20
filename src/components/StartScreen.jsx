export default function StartScreen({ onStart, autoAim, onToggleAutoAim }) {
  return (
    <div className="overlay">
      <h1 className="title">PIXEL SHOOTER RPG</h1>
      <p className="subtitle">Phase 1 · Core Loop</p>
      <button className="btn-primary" onClick={onStart}>START GAME</button>
      <button className="btn-secondary" onClick={onToggleAutoAim}>
        Aim Mode: {autoAim ? 'AUTO' : 'MANUAL'}
      </button>
      <p className="hint">
        Left stick to move · {autoAim ? 'Auto-fires at nearest enemy' : 'Right stick to aim & fire'} · Dodge button to roll
      </p>
    </div>
  )
}
