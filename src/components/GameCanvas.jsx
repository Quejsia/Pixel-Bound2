import { useEffect, useRef, useState, useCallback } from 'react'
import { GameEngine, VIRTUAL_W, VIRTUAL_H } from '../game/engine.js'
import { render } from '../game/renderer.js'
import Joystick from './Joystick.jsx'
import HUD from './HUD.jsx'
import StartScreen from './StartScreen.jsx'
import GameOverScreen from './GameOverScreen.jsx'
import InventoryOverlay from './InventoryOverlay.jsx'

const HUD_UPDATE_INTERVAL = 90 // ms — throttles React state updates for HUD text

export default function GameCanvas() {
  const canvasRef = useRef(null)
  const engineRef = useRef(null)
  const rafRef = useRef(null)
  const lastHudUpdate = useRef(0)

  const [phase, setPhase] = useState('start') // 'start' | 'playing' | 'gameover'
  const [paused, setPaused] = useState(false)
  const [autoAim, setAutoAim] = useState(true)
  const [weapon, setWeaponState] = useState('pistol')
  const [hud, setHud] = useState({
    hp: 100, maxHp: 100, score: 0, wave: 1, dodgeReady: true,
    level: 1, xp: 0, xpToNext: 30, gold: 0, inventoryCount: 0,
    mana: 100, maxMana: 100, skillCooldowns: { nova: 0, heal: 0 },
  })
  const [finalStats, setFinalStats] = useState({ score: 0, wave: 1 })
  const [overlayTick, setOverlayTick] = useState(0)

  const startRenderLoop = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const loop = () => {
      if (engineRef.current) render(ctx, engineRef.current)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
  }, [])

  const beginGame = useCallback(() => {
    const engine = new GameEngine({
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

  const handleMove = useCallback((x, y) => {
    if (engineRef.current) engineRef.current.setMove(x, y)
  }, [])

  const handleAim = useCallback((x, y) => {
    const engine = engineRef.current
    if (!engine) return
    engine.setAim(x, y)
    engine.setShootHeld(Math.hypot(x, y) > 0.25)
  }, [])

  const handleDodge = useCallback(() => {
    if (engineRef.current) engineRef.current.requestDodge()
  }, [])

  const handleWeaponSwitch = useCallback(() => {
    setWeaponState((prev) => {
      const next = prev === 'pistol' ? 'shotgun' : 'pistol'
      if (engineRef.current) engineRef.current.setWeapon(next)
      return next
    })
  }, [])

  const handleUseSkill = useCallback((key) => {
    if (engineRef.current) engineRef.current.useSkill(key)
  }, [])

  const handleRestart = useCallback(() => {
    if (engineRef.current) engineRef.current.stop()
    engineRef.current = null
    beginGame()
  }, [beginGame])

  const handlePause = useCallback(() => {
    if (engineRef.current) engineRef.current.stop()
    setPaused(true)
  }, [])

  const handleResume = useCallback(() => {
    if (engineRef.current) engineRef.current.start()
    setPaused(false)
  }, [])

  const handleQuitToMenu = useCallback(() => {
    if (engineRef.current) engineRef.current.stop()
    engineRef.current = null
    setPaused(false)
    setPhase('start')
  }, [])

  const handleEquip = useCallback((itemId) => {
    if (engineRef.current) engineRef.current.equipItem(itemId)
    setOverlayTick((t) => t + 1)
  }, [])

  const handleUnequip = useCallback((slot) => {
    if (engineRef.current) engineRef.current.unequipItem(slot)
    setOverlayTick((t) => t + 1)
  }, [])

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

  return (
    <div className="game-root">
      <canvas
        ref={canvasRef}
        width={VIRTUAL_W}
        height={VIRTUAL_H}
        className="game-canvas"
      />

      {phase === 'playing' && <HUD {...hud} onPause={handlePause} />}

      {phase === 'playing' && (
        <div className="controls">
          <Joystick onChange={handleMove} />
          {!autoAim && (
            <div className="right-stick-wrap">
              <Joystick onChange={handleAim} />
            </div>
          )}
          <div className="skill-row">
            <button
              className="skill-btn"
              disabled={hud.skillCooldowns.nova > 0 || hud.mana < 25}
              onTouchStart={(e) => { e.preventDefault(); handleUseSkill('nova') }}
              onMouseDown={() => handleUseSkill('nova')}
            >
              <span className="skill-btn-label">NOVA</span>
              {hud.skillCooldowns.nova > 0 && (
                <span className="skill-btn-cooldown">{Math.ceil(hud.skillCooldowns.nova)}</span>
              )}
            </button>
            <button
              className="skill-btn"
              disabled={hud.level < 3 || hud.skillCooldowns.heal > 0 || hud.mana < 40}
              onTouchStart={(e) => { e.preventDefault(); handleUseSkill('heal') }}
              onMouseDown={() => handleUseSkill('heal')}
            >
              <span className="skill-btn-label">{hud.level < 3 ? 'Lv3' : 'HEAL'}</span>
              {hud.level >= 3 && hud.skillCooldowns.heal > 0 && (
                <span className="skill-btn-cooldown">{Math.ceil(hud.skillCooldowns.heal)}</span>
              )}
            </button>
          </div>
          <button
            className={`dodge-btn ${hud.dodgeReady ? '' : 'dodge-btn-cooldown'}`}
            onTouchStart={(e) => { e.preventDefault(); handleDodge() }}
            onMouseDown={handleDodge}
          >
            DODGE
          </button>
          <button
            className="weapon-btn"
            onTouchStart={(e) => { e.preventDefault(); handleWeaponSwitch() }}
            onMouseDown={handleWeaponSwitch}
          >
            {weapon === 'pistol' ? 'PISTOL' : 'SHOTGUN'}
          </button>
        </div>
      )}

      {phase === 'playing' && paused && engineRef.current && (
        <InventoryOverlay
          stats={{
            level: engineRef.current.player.level,
            gold: engineRef.current.player.gold,
            attackMultiplier: engineRef.current.player.attackMultiplier,
            defense: engineRef.current.player.defense,
            maxHp: engineRef.current.player.maxHp,
          }}
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

      {phase === 'start' && (
        <StartScreen
          onStart={beginGame}
          autoAim={autoAim}
          onToggleAutoAim={() => setAutoAim((v) => !v)}
        />
      )}

      {phase === 'gameover' && (
        <GameOverScreen
          score={finalStats.score}
          wave={finalStats.wave}
          onRestart={handleRestart}
        />
      )}
    </div>
  )
}
