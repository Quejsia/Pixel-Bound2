import { WEAPONS } from '../game/phase1Engine.js'
import { WEAPON_ORDER, WEAPON_COSTS } from '../game/saveSystem.js'

export default function LoadoutScreen({ saveData, selectedWeapon, onSelectWeapon, onUnlockWeapon, onBegin, onBack }) {
  const unlocked = WEAPON_ORDER.filter((w) => saveData.unlockedWeapons.includes(w))
  const locked = WEAPON_ORDER.filter((w) => !saveData.unlockedWeapons.includes(w))
  return (
    <div className="overlay start-overlay">
      <h2 className="title inventory-title">LOADOUT</h2>
      <p className="hint">{onBegin ? 'Pick your starting weapon.' : 'Switch weapon or unlock a new one.'}</p>
      <h3 className="inventory-subheading">Your Weapons</h3>
      <div className="inventory-list">
        {unlocked.map((w) => <div key={w} className="inventory-item" style={{ borderColor: selectedWeapon === w ? '#7ce3ff' : 'rgba(124,227,255,.25)' }}><div className="inventory-item-info"><span className="inventory-item-name">{WEAPONS[w]?.label || w.toUpperCase()}</span></div><button className="mini-btn" disabled={selectedWeapon === w} onClick={() => onSelectWeapon(w)}>{selectedWeapon === w ? 'SELECTED' : 'SELECT'}</button></div>)}
      </div>
      {locked.length > 0 && <>
        <h3 className="blacksmith-subheading">Weapon Locker <span className="shop-timer">🪙 {saveData.bankedGold} banked</span></h3>
        <div className="inventory-list">
          {locked.map((w) => { const cost = WEAPON_COSTS[w]; const canAfford = saveData.bankedGold >= cost; return <div key={w} className="inventory-item"><div className="inventory-item-info"><span className="inventory-item-name">{WEAPONS[w]?.label || w.toUpperCase()}</span></div><button className="mini-btn" disabled={!canAfford} onClick={() => onUnlockWeapon(w, cost)}>🪙{cost}</button></div> })}
        </div>
        <p className="hint">Gold from completed runs becomes permanent banked currency for weapon unlocks.</p>
      </>}
      <div className="overlay-btn-row">{onBegin && <button className="btn-primary" onClick={onBegin}>BEGIN</button>}<button className={onBegin ? 'btn-secondary' : 'btn-primary'} onClick={onBack}>{onBegin ? 'BACK' : 'CLOSE'}</button></div>
    </div>
  )
}
