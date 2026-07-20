import { useEffect, useRef, useState, useCallback } from 'react'
import { GameEngine, VIRTUAL_W, VIRTUAL_H } from '../game/engine.js'
import { render } from '../game/renderer.js'
import Joystick from './Joystick.jsx'
import HUD from './HUD.jsx'
import StartScreen from './StartScreen.jsx'
import GameOverScreen from './GameOverScreen.jsx'

const HUD_UPDATE_INTERVAL = 90 // ms — throttles React state updates for HUD text

export default function GameCanvas() {
  const canvasRef = useRef(null)
  const engineRef = useRef(null)
  const rafRef = useRef(null)
  const lastHudUpdate = useRef(0)

  const [phase, setPhase] = useState('start') // 'start' | 'playing' | 'gameover'
  const [autoAim, setAutoAim] = useState(true)
  const [hud, setHud] = useState({ hp: 100, maxHp: 100, score: 0, wave: 1, dodgeReady: true })
  const [finalStats, setFinalStats] = useState({ score: 0, wave: 1 })

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

  const handleRestart = useCallback(() => {
    if (engineRef.current) engineRef.current.stop()
    engineRef.current = null
    beginGame()
  }, [beginGame])

  return (
    <div className="game-root">
      <canvas
        ref={canvasRef}
        width={VIRTUAL_W}
        height={VIRTUAL_H}
        className="game-canvas"
      />

      {phase === 'playing' && <HUD {...hud} />}

      {phase === 'playing' && (
        <div className="controls">
          <Joystick onChange={handleMove} />
          {!autoAim && (
            <div className="right-stick-wrap">
              <Joystick onChange={handleAim} />
            </div>
          )}
          <button
            className={`dodge-btn ${hud.dodgeReady ? '' : 'dodge-btn-cooldown'}`}
            onTouchStart={(e) => { e.preventDefault(); handleDodge() }}
            onMouseDown={handleDodge}
          >
            DODGE
          </button>
        </div>
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
