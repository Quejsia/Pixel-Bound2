import { useEffect, useRef, useState, useCallback } from 'react'
import { VIRTUAL_W, VIRTUAL_H } from '../game/engine.js'
import { Phase1_5GameEngine } from '../game/phase1_5Engine.js'
import { render } from '../game/renderer.js'
import Joystick from './Joystick.jsx'
import HUD from './HUD.jsx'
import StartScreen from './StartScreen.jsx'
import GameOverScreen from './GameOverScreen.jsx'
import InventoryOverlay from './InventoryOverlay.jsx'

const HUD_UPDATE_INTERVAL = 90
const WEAPON_ORDER = ['pistol', 'shotgun', 'rifle', 'bow', 'staff']

export default function GameCanvas() {
  const canvasRef = useRef(null)
  const engineRef = useRef(null)
  const rafRef = useRef(null)
  const lastHudUpdate = useRef(0)

  const [phase, setPhase] = useState('start')
  const [paused, setPaused] = useState(false)
  const [autoAim, setAutoAim] = useState(true)
  const [weapon, setWeaponState] = useState('pistol')
  const [hud, setHud] = useState({
    hp: 100, maxHp: 100, score: 0, wave: 1, dodgeReady: true,
    level: 1, xp: 0, xpToNext: 30, gold: 0, inventoryCount: 0,
    mana: 100, maxMana: 100, skillCooldowns: { nova: 0, heal: 0 },
    combo: 0, damageNumbers: [], weapon: 'PISTOL',
  })
  const [finalStats, setFinalStats] = useState({ score: 0, wave: 1 })
  const [overlayTick, setOverlayTick] = useState(0)

  const startRenderLoop = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const loop = () => {
      const engine = engineRef.current
      if (engine) {
        render(ctx, engine)
        const shake = engine.__phase1ScreenShakeEnabled ? engine.__phase1ScreenShake : 0
        if (shake > 0) {
          const x = (Math.random() - 0.5) * shake
          const y = (Math.random() - 0.5) * shake
          canvas.style.transform = `translate(${x}px, ${y}px)`
        } else {
          canvas.style.transform = ''
        }
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
  }, [])

  const beginGame = useCallback(() => {
    const engine = new Phase1_5GameEngine({
      onHud: (data) => {
        const now = performance.now()
        if (now - lastHudUpdate.current > HUD_UPDATE_INTERVAL) {
          lastHudUpdate.current = now
          setHud(data)
        }
      },
      onGameOver: ({ score, wave }) => {
        setFinalStats({ score, wave })
        setPhase('gameover')
      },
    })
    engine.setAutoAim(autoAim)
    engine.setWeapon('pistol')
    setWeaponState('pistol')
    setPaused(false)
    engineRef.current = engine
    engine.start()
    setPhase('playing')
  }, [autoAim])

  useEffect(() => {
    startRenderLoop()
    return () => {
      cancelAnimationFrame(rafRef.current)
      if (engineRef.current) engineRef.current.stop()
    }
  }, [startRenderLoop])

  const handleMove = useCallback((x, y) => { if (engineRef.current) engineRef.current.setMove(x, y) }, [])
  const handleAim = useCallback((x, y) => {
    const engine = engineRef.current
    if (!engine) return
    engine.setAim(x, y)
    engine.setShootHeld(Math.hypot(x, y) > 0.25)
  }, [])
  const handleDodge = useCallback(() => { if (engineRef.current) engineRef.current.requestDodge() }, [])
  const handleWeaponSwitch = useCallback(() => {
    setWeaponState((prev) => {
      const currentIndex = WEAPON_ORDER.indexOf(prev)
      const next = WEAPON_ORDER[(currentIndex + 1) % WEAPON_ORDER.length]
      if (engineRef.current) engineRef.current.setWeapon(next)
      return next
    })
  }, [])
  const handleUseSkill = useCallback((key) => { if (engineRef.current) engineRef.current.useSkill(key) }, [])
  const handleRestart = useCallback(() => {
    if (engineRef.current) engineRef.current.stop()
    engineRef.current = null
    beginGame()
  }, [beginGame])
  const handlePause = useCallback(() => { if (engineRef.current) engineRef.current.stop(); setPaused(true) }, [])
  const handleResume = useCallback(() => { if (engineRef.current) engineRef.current.start(); setPaused(false) }, [])
  const handleQuitToMenu = useCallback(() => {
    if (engineRef.current) engineRef.current.stop()
    engineRef.current = null
    setPaused(false)
    setPhase('start')
  }, [])
  const handleEquip = useCallback((itemId) => { if (engineRef.current) engineRef.current.equipItem(itemId); setOverlayTick((t) => t + 1) }, [])
  const handleUnequip = useCallback((slot) => { if (engineRef.current) engineRef.current.unequipItem(slot); setOverlayTick((t) => t + 1) }, [])
  const handleForge = useCallback((itemId) => {
    if (!engineRef.current) return null
    const result = engineRef.current.forgeItem(itemId)
    setOverlayTick((t) => t + 1)
    return result
  }, [])
  const handleBuyShopItem = useCallback((slotIndex) => {
    if (!engineRef.current) return null
    const result = engineRef.current.buyShopItem(slotIndex)
    setOverlayTick((t) => t + 1)
    return result
  }, [])

  const damageNumbers = hud.damageNumbers || []

  return (
    <div className="game-root">
      <canvas ref={canvasRef} width={VIRTUAL_W} height={VIRTUAL_H} className="game-canvas" />
      {phase === 'playing' && damageNumbers.map((n, index) => (
        <div key={`${index}-${n.x}-${n.y}-${n.life}`} style={{ position: 'absolute', left: `${(n.x / VIRTUAL_W) * 100}%`, top: `${(n.y / VIRTUAL_H) * 100}%`, transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 8, fontWeight: 900, fontSize: n.crit ? '18px' : '14px', lineHeight: 1, color: n.crit ? '#ffd34d' : '#ffffff', textShadow: '2px 2px 0 #111, -1px -1px 0 #111', opacity: Math.min(1, n.life / 0.18) }}>
          {n.crit ? `CRIT ${n.value}` : n.value}
        </div>
      ))}
      {phase === 'playing' && hud.combo > 1 && (
        <div style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none', zIndex: 7, fontWeight: 900, fontSize: '18px', color: '#ffd34d', textShadow: '2px 2px 0 #111' }}>
          {hud.combo} HIT COMBO
        </div>
      )}
      {phase === 'playing' && <HUD {...hud} onPause={handlePause} />}
      {phase === 'playing' && (
        <div className="controls">
          <Joystick onChange={handleMove} />
          {!autoAim && <div className="right-stick-wrap"><Joystick onChange={handleAim} /></div>}
          <div className="skill-row">
            <button className="skill-btn" disabled={hud.skillCooldowns.nova > 0 || hud.mana < 25} onTouchStart={(e) => { e.preventDefault(); handleUseSkill('nova') }} onMouseDown={() => handleUseSkill('nova')}>
              <span className="skill-btn-label">NOVA</span>
              {hud.skillCooldowns.nova > 0 && <span className="skill-btn-cooldown">{Math.ceil(hud.skillCooldowns.nova)}</span>}
            </button>
            <button className="skill-btn" disabled={hud.level < 3 || hud.skillCooldowns.heal > 0 || hud.mana < 40} onTouchStart={(e) => { e.preventDefault(); handleUseSkill('heal') }} onMouseDown={() => handleUseSkill('heal')}>
              <span className="skill-btn-label">{hud.level < 3 ? 'Lv3' : 'HEAL'}</span>
              {hud.level >= 3 && hud.skillCooldowns.heal > 0 && <span className="skill-btn-cooldown">{Math.ceil(hud.skillCooldowns.heal)}</span>}
            </button>
          </div>
          <button className={`dodge-btn ${hud.dodgeReady ? '' : 'dodge-btn-cooldown'}`} onTouchStart={(e) => { e.preventDefault(); handleDodge() }} onMouseDown={handleDodge}>DODGE</button>
          <button className="weapon-btn" onTouchStart={(e) => { e.preventDefault(); handleWeaponSwitch() }} onMouseDown={handleWeaponSwitch}>{hud.weapon || weapon.toUpperCase()}</button>
        </div>
      )}
      {phase === 'playing' && paused && engineRef.current && (
        <InventoryOverlay
          stats={{ level: engineRef.current.player.level, gold: engineRef.current.player.gold, attackMultiplier: engineRef.current.player.attackMultiplier, defense: engineRef.current.player.defense, maxHp: engineRef.current.player.maxHp }}
          inventory={engineRef.current.inventory}
          equipment={engineRef.current.player.equipment}
          shop={engineRef.current.shop}
          onResume={handleResume}
          onClose={handleQuitToMenu}
          onEquip={handleEquip}
          onUnequip={handleUnequip}
          onForge={handleForge}
          onBuyShopItem={handleBuyShopItem}
        />
      )}
      {phase === 'start' && <StartScreen onStart={beginGame} autoAim={autoAim} onToggleAutoAim={() => setAutoAim((v) => !v)} />}
      {phase === 'gameover' && <GameOverScreen score={finalStats.score} wave={finalStats.wave} onRestart={handleRestart} />}
    </div>
  )
}
