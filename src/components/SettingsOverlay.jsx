import './settings.css'

export default function SettingsOverlay({ settings, onChange, onBack }) {
  return (
    <div className="overlay settings-overlay">
      <h2 className="title inventory-title">SETTINGS</h2>
      <div className="settings-list">
        <div className="settings-row">
          <div><strong>Sound Effects</strong><span>Shots, hits, pickups and abilities</span></div>
          <div className="range-wrap"><input aria-label="Sound effects volume" type="range" min="0" max="1" step="0.05" value={settings.sfxVolume} onChange={(e) => onChange({ sfxVolume: Number(e.target.value) })} /><b>{Math.round(settings.sfxVolume * 100)}%</b></div>
        </div>
        <div className="settings-row">
          <div><strong>Music</strong><span>Procedural background music</span></div>
          <div className="range-wrap"><input aria-label="Music volume" type="range" min="0" max="1" step="0.05" value={settings.bgmVolume} onChange={(e) => onChange({ bgmVolume: Number(e.target.value) })} /><b>{Math.round(settings.bgmVolume * 100)}%</b></div>
        </div>
        <button className="settings-toggle" onClick={() => onChange({ screenShake: !settings.screenShake })}>
          <span><strong>Screen Shake</strong><small>Combat impact feedback</small></span>
          <b>{settings.screenShake ? 'ON' : 'OFF'}</b>
        </button>
        <button className="settings-toggle" onClick={() => onChange({ autoAim: !settings.autoAim })}>
          <span><strong>Auto Aim</strong><small>Automatically target the nearest enemy</small></span>
          <b>{settings.autoAim ? 'ON' : 'OFF'}</b>
        </button>
      </div>
      <button className="btn-primary" onClick={onBack}>BACK</button>
    </div>
  )
}
