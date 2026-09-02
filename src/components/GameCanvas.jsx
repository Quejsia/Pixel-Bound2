import { useEffect, useRef, useState, useCallback } from 'react'
import { VIRTUAL_W, VIRTUAL_H } from '../game/engine.js'
import { RogueliteGameEngine } from '../game/rogueliteEngine.js'
import { render } from '../game/renderer.js'
import { preloadSprites } from '../game/spriteAnimator.js'
import { audioManager } from '../game/audioManager.js'
import { loadSave, saveGame, updateSettings, recordRun } from '../game/saveSystem.js'
import Joystick from './Joystick.jsx'
import HUD from './HUD.jsx'
import StartScreen from './StartScreen.jsx'
import LoadoutScreen from './LoadoutScreen.jsx'
import SettingsOverlay from './SettingsOverlay.jsx'
import GameOverScreen from './GameOverScreen.jsx'
import InventoryOverlay from './InventoryOverlay.jsx'
import LevelUpOverlay from './LevelUpOverlay.jsx'

const HUD_UPDATE_INTERVAL = 90

function clientToVirtual(clientX, clientY, canvas) {
  const rect = canvas.getBoundingClientRect()
  const boxAspect = rect.width / rect.height
  const contentAspect = VIRTUAL_W / VIRTUAL_H
  let drawWidth, drawHeight, offsetX, offsetY
  if (boxAspect > contentAspect) {
    drawHeight = rect.height; drawWidth = rect.height * contentAspect
    offsetX = (rect.width - drawWidth) / 2; offsetY = 0
  } else {
    drawWidth = rect.width; drawHeight = rect.width / contentAspect
    offsetX = 0; offsetY = (rect.height - drawHeight) / 2
  }
  const localX = clientX - rect.left - offsetX
  const localY = clientY - rect.top - offsetY
  return { x: (localX / drawWidth) * VIRTUAL_W, y: (localY / drawHeight) * VIRTUAL_H }
}

export default function GameCanvas() {
  const canvasRef = useRef(null)
  const engineRef = useRef(null)
  const rafRef = useRef(null)
  const lastHudUpdate = useRef(0)
  const mousePosRef = useRef({ x: 0, y: 0 })
  const mouseDownRef = useRef(false)
  const pcAimActiveRef = useRef(false)

  const [saveData, setSaveData] = useState(() => loadSave())
  const [phase, setPhase] = useState('start')
  const [paused, setPaused] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [loadoutOpen, setLoadoutOpen] = useState(false)
  const [autoAim, setAutoAim] = useState(() => loadSave().settings.autoAim)
  const [controlMode, setControlMode] = useState(() => loadSave().settings.controlMode || 'mobile')
  const [selectedWeapon, setSelectedWeapon] = useState('pistol')
  const [hud, setHud] = useState({ hp: 100, maxHp: 100, score: 0, wave: 1, dodgeReady: true, level: 1, xp: 0, xpToNext: 30, gold: 0, inventoryCount: 0, mana: 100, maxMana: 100, skillCooldowns: { nova: 0, heal: 0 }, combo: 0, damageNumbers: [], weapon: 'PISTOL', isBossWave: false, bossHp: null, bossMaxHp: null, camera: { x: 0, y: 0 } })
  const [finalStats, setFinalStats] = useState({ score: 0, wave: 1, isNewHighScore: false })
  const [overlayTick, setOverlayTick] = useState(0)
  const [levelUpChoices, setLevelUpChoices] = useState(null)

  useEffect(() => {
    audioManager.setSfxVolume(saveData.settings.sfxVolume)
    audioManager.setBgmVolume(saveData.settings.bgmVolume)
  }, [saveData.settings.sfxVolume, saveData.settings.bgmVolume])

  const startRenderLoop = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const loop = () => {
      const engine = engineRef.current
      if (engine) {
        render(ctx, engine)
        if (pcAimActiveRef.current) {
          const { x: vx, y: vy } = clientToVirtual(mousePosRef.current.x, mousePosRef.current.y, canvas)
          const worldX = engine.camera.x + vx
          const worldY = engine.camera.y + vy
          const dx = worldX - engine.player.x
          const dy = worldY - engine.player.y
          const len = Math.hypot(dx, dy)
          if (len > 0.001) engine.setAim(dx / len, dy / len)
          engine.setShootHeld(mouseDownRef.current)
        }
        const shake = engine.__phase1ScreenShakeEnabled ? engine.__phase1ScreenShake : 0
        if (shake > 0) canvas.style.transform = `translate(${(Math.random() - 0.5) * shake}px, ${(Math.random() - 0.5) * shake}px)`
        else canvas.style.transform = ''
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
  }, [])

  const beginGame = useCallback(async () => {
    // Do not start the simulation until all character atlases are decoded and
    // sliced. This removes the visible primitive/vector fallback during the
    // first seconds of a run and guarantees every current enemy sheet is ready.
    await preloadSprites()

    audioManager.unlock()
    audioManager.setSfxVolume(saveData.settings.sfxVolume)
    audioManager.setBgmVolume(saveData.settings.bgmVolume)
    audioManager.startBgm()

    const engine = new RogueliteGameEngine({
      onHud: (data) => {
        const now = performance.now()
        if (now - lastHudUpdate.current > HUD_UPDATE_INTERVAL) { lastHudUpdate.current = now; setHud(data) }
      },
      onLevelUp: (choices) => setLevelUpChoices(choices),
      onGameOver: ({ score, wave }) => {
        const runGold = engineRef.current?.player.gold || 0
        const current = loadSave()
        const isNewHighScore = score > current.highScore
        const updated = recordRun({ score, wave, gold: runGold })
        setSaveData(updated)
        setFinalStats({ score, wave, isNewHighScore })
        setLevelUpChoices(null)
        setPhase('gameover')
      },
    })
    engine.setAutoAim(autoAim)
    engine.setScreenShakeEnabled?.(saveData.settings.screenShake)
    engine.setWeapon(selectedWeapon)
    setPaused(false)
    setSettingsOpen(false)
    setLoadoutOpen(false)
    setLevelUpChoices(null)
    engineRef.current = engine
    engine.start()
    setPhase('playing')
  }, [autoAim, saveData.settings, selectedWeapon])

  useEffect(() => {
    startRenderLoop()
    return () => { cancelAnimationFrame(rafRef.current); engineRef.current?.stop(); audioManager.stopBgm() }
  }, [startRenderLoop])

  useEffect(() => {
    if (phase !== 'playing' || controlMode !== 'pc' || paused || levelUpChoices) return
    const keys = { up: false, down: false, left: false, right: false }
    const keyMap = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' }
    const updateMove = () => {
      let x = (keys.right ? 1 : 0) - (keys.left ? 1 : 0)
      let y = (keys.down ? 1 : 0) - (keys.up ? 1 : 0)
      const len = Math.hypot(x, y); if (len > 1) { x /= len; y /= len }
      engineRef.current?.setMove(x, y)
    }
    const onKeyDown = (e) => { const k = keyMap[e.code]; if (k) { e.preventDefault(); keys[k] = true; updateMove() } }
    const onKeyUp = (e) => { const k = keyMap[e.code]; if (k) { e.preventDefault(); keys[k] = false; updateMove() } }
    window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp)
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); engineRef.current?.setMove(0, 0) }
  }, [phase, controlMode, paused, levelUpChoices])

  useEffect(() => {
    if (phase !== 'playing' || controlMode !== 'pc' || autoAim || paused || levelUpChoices) return
    const canvas = canvasRef.current
    if (!canvas) return
    const onMouseMove = (e) => { mousePosRef.current = { x: e.clientX, y: e.clientY } }
    const onMouseDown = (e) => { if (e.button === 0) { e.preventDefault(); mouseDownRef.current = true } }
    const onMouseUp = (e) => { if (e.button === 0) mouseDownRef.current = false }
    window.addEventListener('mousemove', onMouseMove); canvas.addEventListener('mousedown', onMouseDown); window.addEventListener('mouseup', onMouseUp)
    pcAimActiveRef.current = true
    return () => { window.removeEventListener('mousemove', onMouseMove); canvas.removeEventListener('mousedown', onMouseDown); window.removeEventListener('mouseup', onMouseUp); pcAimActiveRef.current = false; mouseDownRef.current = false; engineRef.current?.setShootHeld(false) }
  }, [phase, controlMode, autoAim, paused, levelUpChoices])

  const persistPatch = useCallback((patch) => { const next = updateSettings(patch); setSaveData(next); return next }, [])
  const handleSetSfxVolume = useCallback((v) => persistPatch({ sfxVolume: v }), [persistPatch])
  const handleSetBgmVolume = useCallback((v) => persistPatch({ bgmVolume: v }), [persistPatch])
  const handleSetControlMode = useCallback((mode) => { setControlMode(mode); persistPatch({ controlMode: mode }) }, [persistPatch])
  const handleToggleScreenShake = useCallback(() => { persistPatch({ screenShake: !saveData.settings.screenShake }); if (engineRef.current) engineRef.current.setScreenShakeEnabled?.(!saveData.settings.screenShake) }, [persistPatch, saveData.settings.screenShake])
  const handleToggleAutoAim = useCallback(() => {
    const next = !autoAim; setAutoAim(next); persistPatch({ autoAim: next }); engineRef.current?.setAutoAim(next)
  }, [autoAim, persistPatch])
  const handleMove = useCallback((x, y) => { if (!levelUpChoices) engineRef.current?.setMove(x, y) }, [levelUpChoices])
  const handleAim = useCallback((x, y) => { if (!levelUpChoices) { engineRef.current?.setAim(x, y); engineRef.current?.setShootHeld(Math.hypot(x, y) > 0.25) } }, [levelUpChoices])
  const handleDodge = useCallback(() => { if (!levelUpChoices) engineRef.current?.requestDodge() }, [levelUpChoices])
  const handleWeaponSwitch = useCallback(() => {
    if (levelUpChoices) return
    const unlocked = ['pistol', 'shotgun', 'rifle', 'bow', 'staff'].filter((w) => saveData.unlockedWeapons.includes(w))
    const order = unlocked.length ? unlocked : ['pistol']
    const idx = order.indexOf(engineRef.current?.player.weapon || selectedWeapon)
    const next = order[(idx + 1) % order.length]
    engineRef.current?.setWeapon(next); setSelectedWeapon(next)
  }, [levelUpChoices, saveData.unlockedWeapons, selectedWeapon])
  const handleSelectWeapon = useCallback((w) => { setSelectedWeapon(w); engineRef.current?.setWeapon(w) }, [])
  const handleUnlockWeapon = useCallback((weaponId, cost) => {
    if (saveData.unlockedWeapons.includes(weaponId) || saveData.bankedGold < cost) return
    const next = saveGame({ bankedGold: saveData.bankedGold - cost, unlockedWeapons: [...saveData.unlockedWeapons, weaponId] })
    setSaveData(next)
  }, [saveData])
  const handleUseSkill = useCallback((key) => { if (!levelUpChoices) engineRef.current?.useSkill(key) }, [levelUpChoices])
  const handleChoosePerk = useCallback((id) => {
    const engine = engineRef.current
    if (!engine) return
    const result = engine.chooseUpgrade(id)
    if (!result.ok) return
    setLevelUpChoices(engine.awaitingUpgrade ? engine.getUpgradeChoices() : null)
  }, [])
  const handleRestart = useCallback(() => { engineRef.current?.stop(); engineRef.current = null; setLevelUpChoices(null); void beginGame() }, [beginGame])
  const handlePause = useCallback(() => { if (levelUpChoices) return; engineRef.current?.stop(); setPaused(true); setSettingsOpen(false); setLoadoutOpen(false) }, [levelUpChoices])
  const handleResume = useCallback(() => { engineRef.current?.start(); setPaused(false); setSettingsOpen(false); setLoadoutOpen(false) }, [])
  const handleQuitToMenu = useCallback(() => { engineRef.current?.stop(); engineRef.current = null; audioManager.stopBgm(); setPaused(false); setSettingsOpen(false); setLoadoutOpen(false); setLevelUpChoices(null); setPhase('start') }, [])
  const handleEquip = useCallback((id) => { engineRef.current?.equipItem(id); setOverlayTick((t) => t + 1) }, [])
  const handleUnequip = useCallback((slot) => { engineRef.current?.unequipItem(slot); setOverlayTick((t) => t + 1) }, [])
  const handleForge = useCallback((id) => { const result = engineRef.current?.forgeItem(id); setOverlayTick((t) => t + 1); return result }, [])
  const handleBuyShopItem = useCallback((slot) => { const result = engineRef.current?.buyShopItem(slot); setOverlayTick((t) => t + 1); return result }, [])

  const damageNumbers = hud.damageNumbers || []
  return <div className={`game-root ${controlMode === 'pc' ? 'pc-mode' : ''}`}>
    <canvas ref={canvasRef} width={VIRTUAL_W} height={VIRTUAL_H} className="game-canvas" />
    {phase === 'playing' && damageNumbers.map((n, i) => <div key={`${i}-${n.x}-${n.y}-${n.life}`} style={{ position: 'absolute', left: `${((n.x - hud.camera.x) / VIRTUAL_W) * 100}%`, top: `${((n.y - hud.camera.y) / VIRTUAL_H) * 100}%`, transform: 'translate(-50%,-50%)', pointerEvents: 'none', zIndex: 8, fontWeight: 900, fontSize: n.crit ? '18px' : '14px', color: n.crit ? '#ffd34d' : '#fff', textShadow: '2px 2px 0 #111', opacity: Math.min(1, n.life / 0.18) }}>{n.crit ? `CRIT ${n.value}` : n.value}</div>)}
    {phase === 'playing' && hud.combo > 1 && !levelUpChoices && <div className="combo-hud">{hud.combo} HIT COMBO</div>}
    {phase === 'playing' && <HUD {...hud} onPause={handlePause} />}
    {phase === 'playing' && !levelUpChoices && <div className="controls">
      {controlMode === 'mobile' && <Joystick onChange={handleMove} />}
      {!autoAim && controlMode === 'mobile' && <div className="right-stick-wrap"><Joystick onChange={handleAim} /></div>}
      <div className="skill-row">
        <button className="skill-btn" disabled={hud.skillCooldowns.nova > 0 || hud.mana < 25} onTouchStart={(e) => { e.preventDefault(); handleUseSkill('nova') }} onMouseDown={() => handleUseSkill('nova')}><span className="skill-btn-label">NOVA</span>{hud.skillCooldowns.nova > 0 && <span className="skill-btn-cooldown">{Math.ceil(hud.skillCooldowns.nova)}</span>}</button>
        <button className="skill-btn" disabled={hud.level < 3 || hud.skillCooldowns.heal > 0 || hud.mana < 40} onTouchStart={(e) => { e.preventDefault(); handleUseSkill('heal') }} onMouseDown={() => handleUseSkill('heal')}><span className="skill-btn-label">{hud.level < 3 ? 'Lv3' : 'HEAL'}</span>{hud.level >= 3 && hud.skillCooldowns.heal > 0 && <span className="skill-btn-cooldown">{Math.ceil(hud.skillCooldowns.heal)}</span>}</button>
      </div>
      <button className={`dodge-btn ${hud.dodgeReady ? '' : 'dodge-btn-cooldown'}`} onTouchStart={(e) => { e.preventDefault(); handleDodge() }} onMouseDown={handleDodge}>DODGE</button>
      <button className="weapon-btn" onTouchStart={(e) => { e.preventDefault(); handleWeaponSwitch() }} onMouseDown={handleWeaponSwitch}>{hud.weapon || selectedWeapon.toUpperCase()}</button>
      {controlMode === 'pc' && <button className="aim-toggle-btn" onClick={handleToggleAutoAim}>AIM: {autoAim ? 'AUTO' : 'MANUAL'}</button>}
    </div>}
    {phase === 'playing' && levelUpChoices && <LevelUpOverlay level={hud.level} choices={levelUpChoices} onChoose={handleChoosePerk} />}
    {phase === 'playing' && paused && engineRef.current && !settingsOpen && !loadoutOpen && !levelUpChoices && <InventoryOverlay stats={{ level: engineRef.current.player.level, gold: engineRef.current.player.gold, attackMultiplier: engineRef.current.player.attackMultiplier, defense: engineRef.current.player.defense, maxHp: engineRef.current.player.maxHp }} inventory={engineRef.current.inventory} equipment={engineRef.current.player.equipment} shop={engineRef.current.shop} onResume={handleResume} onClose={handleQuitToMenu} onEquip={handleEquip} onUnequip={handleUnequip} onForge={handleForge} onBuyShopItem={handleBuyShopItem} onOpenSettings={() => setSettingsOpen(true)} onOpenLoadout={() => setLoadoutOpen(true)} overlayTick={overlayTick} />}
    {phase === 'playing' && paused && settingsOpen && <SettingsOverlay controlMode={controlMode} onSetControlMode={handleSetControlMode} sfxVolume={saveData.settings.sfxVolume} bgmVolume={saveData.settings.bgmVolume} screenShake={saveData.settings.screenShake} autoAim={autoAim} onSetSfxVolume={handleSetSfxVolume} onSetBgmVolume={handleSetBgmVolume} onToggleScreenShake={handleToggleScreenShake} onToggleAutoAim={handleToggleAutoAim} onBack={() => setSettingsOpen(false)} />}
    {phase === 'playing' && paused && loadoutOpen && <LoadoutScreen saveData={saveData} selectedWeapon={selectedWeapon} onSelectWeapon={handleSelectWeapon} onUnlockWeapon={handleUnlockWeapon} onBack={() => setLoadoutOpen(false)} />}
    {phase === 'start' && <StartScreen onStart={() => setPhase('loadout')} autoAim={autoAim} onToggleAutoAim={handleToggleAutoAim} saveData={saveData} />}
    {phase === 'loadout' && <LoadoutScreen saveData={saveData} selectedWeapon={selectedWeapon} onSelectWeapon={handleSelectWeapon} onUnlockWeapon={handleUnlockWeapon} onBegin={beginGame} onBack={() => setPhase('start')} />}
    {phase === 'gameover' && <GameOverScreen score={finalStats.score} wave={finalStats.wave} isNewHighScore={finalStats.isNewHighScore} onRestart={handleRestart} />}
  </div>
}
