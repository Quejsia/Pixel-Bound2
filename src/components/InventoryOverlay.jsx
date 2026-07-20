const RARITY_LABELS = {
  common: { label: 'Common', color: '#c9c9c9' },
  uncommon: { label: 'Uncommon', color: '#5fe07a' },
  rare: { label: 'Rare', color: '#7ca8ff' },
}

export default function InventoryOverlay({ stats, inventory, onClose, onResume }) {
  return (
    <div className="overlay inventory-overlay">
      <h2 className="title inventory-title">PAUSED</h2>

      <div className="stats-grid">
        <div className="stat-row"><span>Level</span><span>{stats.level}</span></div>
        <div className="stat-row"><span>Gold</span><span>🪙 {stats.gold}</span></div>
        <div className="stat-row"><span>Attack</span><span>x{stats.attackMultiplier.toFixed(2)}</span></div>
        <div className="stat-row"><span>Max HP</span><span>{stats.maxHp}</span></div>
      </div>

      <h3 className="inventory-subheading">Items ({inventory.length})</h3>
      <div className="inventory-list">
        {inventory.length === 0 && <p className="inventory-empty">No items yet — defeat enemies for a chance to find loot.</p>}
        {inventory.map((item) => {
          const r = RARITY_LABELS[item.rarity] || RARITY_LABELS.common
          return (
            <div key={item.id} className="inventory-item" style={{ borderColor: r.color }}>
              <span className="inventory-item-name">{item.name}</span>
              <span className="inventory-item-rarity" style={{ color: r.color }}>{r.label}</span>
            </div>
          )
        })}
      </div>

      <div className="overlay-btn-row">
        <button className="btn-primary" onClick={onResume}>RESUME</button>
        <button className="btn-secondary" onClick={onClose}>QUIT TO MENU</button>
      </div>
    </div>
  )
}
