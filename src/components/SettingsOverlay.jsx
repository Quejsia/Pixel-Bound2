export default function SettingsOverlay({ controlMode, onSetControlMode, sfxVolume, bgmVolume, screenShake, autoAim, onSetSfxVolume, onSetBgmVolume, onToggleScreenShake, onToggleAutoAim, onBack }) {
  return (
    <div className="overlay settings-overlay">
      <h2 className="title inventory-title">SETTINGS</h2>
      <h3 className="inventory-subheading">Controls</h3>
      <div className="tab-row" style={{ maxWidth: 280 }}>
        <button className={`tab-btn ${controlMode === 'mobile' ? 'tab-btn-active' : ''}`} onClick={() => onSetControlMode('mobile')}>MOBILE</button>
        <button className={`tab-btn ${controlMode === 'pc' ? 'tab-btn-active' : ''}`} onClick={() => onSetControlMode('pc')}>PC</button>
      </div>
      <p className="hint">{controlMode === 'pc' ? 'PC: WASD / arrows to move. Manual aim follows the mouse; hold left click to fire.' : 'Mobile: move with the left virtual joystick and use the on-screen controls.'}</p>
      <button className="settings-toggle" onClick={onToggleAutoAim}><span><strong>Auto Aim</strong><small>Target the nearest enemy automatically</small></span><b>{autoAim ? 'ON' : 'OFF'}</b></button>
      <button className="settings-toggle" onClick={onToggleScreenShake}><span><strong>Screen Shake</strong><small>Combat impact feedback</small></span><b>{screenShake ? 'ON' : 'OFF'}</b></button>
      <div className="settings-row"><div><strong>Sound Effects</strong><span>Combat, pickups and abilities</span></div><div className="range-wrap"><input aria-label="Sound effects volume" type="range" min="0" max="1" step="0.05" value={sfxVolume} onChange={(e) => onSetSfxVolume(Number(e.target.value))} /><b>{Math.round(sfxVolume * 100)}%</b></div></div>
      <div className="settings-row"><div><strong>Music</strong><span>Procedural background music</span></div><div className="range-wrap"><input aria-label="Music volume" type="range" min="0" max="1" step="0.05" value={bgmVolume} onChange={(e) => onSetBgmVolume(Number(e.target.value))} /><b>{Math.round(bgmVolume * 100)}%</b></div></div>
      <div className="overlay-btn-row"><button className="btn-primary" onClick={onBack}>BACK</button></div>
    </div>
  )
}
