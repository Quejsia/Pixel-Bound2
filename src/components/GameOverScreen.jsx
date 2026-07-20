export default function GameOverScreen({ score, wave, onRestart }) {
  return (
    <div className="overlay">
      <h1 className="title">GAME OVER</h1>
      <p className="subtitle">You reached Wave {wave}</p>
      <p className="score-final">Score: {score}</p>
      <button className="btn-primary" onClick={onRestart}>RESTART</button>
    </div>
  )
}
