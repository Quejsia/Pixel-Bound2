import { useState } from 'react'

const RARITY_LABELS = {
  common: { label: 'Common', color: '#c9c9c9' },
  uncommon: { label: 'Uncommon', color: '#5fe07a' },
  rare: { label: 'Rare', color: '#7ca8ff' },
}

const SLOT_LABELS = { armor: 'Armor', trinket: 'Trinket', charm: 'Charm' }

const STAT_LABELS = {
  defense: (v) => `+${Math.round(v * 100)}% DEF`,
  maxHp: (v) => `+${v} HP`,
  attack: (v) => `+${Math.round(v * 100)}% ATK`,
  speed: (v) => `+${v} SPD`,
}

export default function InventoryOverlay({ stats, inventory, equipment, onResume, onClose, onEquip, onUnequip, onForge }) {
  const [tab, setTab] = useState('items') // 'items' | 'blacksmith'
  const [showTip, setShowTip] = useState(true)
  const [forgeMsg, setForgeMsg] = useState(null)

  const handleForgeClick = (item) => {
    const result = onForge(item.id)
    if (!result) return
    if (result.ok) {
      setForgeMsg(`${item.name} forged to ${RARITY_LABELS[result.newRarity].label}!`)
    } else if (result.reason === 'not-enough-gold') {
      setForgeMsg(`Need ${result.cost} gold to forge this.`)
    } else if (result.reason === 'max-rarity') {
      setForgeMsg(`${item.name} is already max rarity.`)
    }
    setTimeout(() => setForgeMsg(null), 2200)
  }

  return (
    <div className="overlay inventory-overlay">
      <h2 className="title inventory-title">PAUSED</h2>

      <div className="stats-grid">
        <div className="stat-row"><span>Level</span><span>{stats.level}</span></div>
        <div className="stat-row"><span>Gold</span><span>🪙 {stats.gold}</span></div>
        <div className="stat-row"><span>Attack</span><span>x{stats.attackMultiplier.toFixed(2)}</span></div>
        <div className="stat-row"><span>Defense</span><span>{Math.round(stats.defense * 100)}%</span></div>
        <div className="stat-row"><span>Max HP</span><span>{stats.maxHp}</span></div>
      </div>

      <div className="equipment-row">
        {['armor', 'trinket', 'charm'].map((slot) => {
          const item = equipment[slot]
          const r = item ? RARITY_LABELS[item.rarity] : null
          return (
            <div key={slot} className="equip-slot" style={item ? { borderColor: r.color } : undefined}>
              <span className="equip-slot-label">{SLOT_LABELS[slot]}</span>
              {item ? (
                <>
                  <span className="equip-slot-item" style={{ color: r.color }}>{item.name}</span>
                  <span className="equip-slot-stat">{STAT_LABELS[item.statType](item.statValue)}</span>
                  <button className="mini-btn" onClick={() => onUnequip(slot)}>Unequip</button>
                </>
              ) : (
                <span className="equip-slot-empty">Empty</span>
              )}
            </div>
          )
        })}
      </div>

      <div className="tab-row">
        <button className={`tab-btn ${tab === 'items' ? 'tab-btn-active' : ''}`} onClick={() => setTab('items')}>Items ({inventory.length})</button>
        <button
          className={`tab-btn ${tab === 'blacksmith' ? 'tab-btn-active' : ''}`}
          onClick={() => { setTab('blacksmith'); setShowTip(false) }}
        >
          Blacksmith
        </button>
      </div>

      {tab === 'items' && (
        <div className="inventory-list">
          {inventory.length === 0 && <p className="inventory-empty">No items yet — defeat enemies for a chance to find loot.</p>}
          {inventory.map((item) => {
            const r = RARITY_LABELS[item.rarity]
            return (
              <div key={item.id} className="inventory-item" style={{ borderColor: r.color }}>
                <div className="inventory-item-info">
                  <span className="inventory-item-name">{item.name}</span>
                  <span className="inventory-item-rarity" style={{ color: r.color }}>{r.label} · {STAT_LABELS[item.statType](item.statValue)}</span>
                </div>
                <button className="mini-btn" onClick={() => onEquip(item.id)}>Equip</button>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'blacksmith' && (
        <div className="blacksmith-panel">
          {showTip && (
            <p className="blacksmith-tip">
              The Blacksmith upgrades an item's rarity for gold, boosting its stat. Higher rarity costs more.
            </p>
          )}
          {forgeMsg && <p className="forge-msg">{forgeMsg}</p>}
          <div className="inventory-list">
            {[...inventory, ...Object.values(equipment).filter(Boolean)].length === 0 && (
              <p className="inventory-empty">No items to forge yet.</p>
            )}
            {[...inventory, ...Object.values(equipment).filter(Boolean)].map((item) => {
              const r = RARITY_LABELS[item.rarity]
              const isMax = item.rarity === 'rare'
              return (
                <div key={item.id} className="inventory-item" style={{ borderColor: r.color }}>
                  <div className="inventory-item-info">
                    <span className="inventory-item-name">{item.name}</span>
                    <span className="inventory-item-rarity" style={{ color: r.color }}>{r.label} · {STAT_LABELS[item.statType](item.statValue)}</span>
                  </div>
                  <button className="mini-btn" disabled={isMax} onClick={() => handleForgeClick(item)}>
                    {isMax ? 'MAX' : 'Forge'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="overlay-btn-row">
        <button className="btn-primary" onClick={onResume}>RESUME</button>
        <button className="btn-secondary" onClick={onClose}>QUIT TO MENU</button>
      </div>
    </div>
  )
}
