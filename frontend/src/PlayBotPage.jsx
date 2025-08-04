import React, { useState, useEffect, useCallback } from 'react';
import { Chessboard } from "react-chessboard";
import { Chess } from 'chess.js';
import './PlayBotPage.css';

const difficultyLevels = {
  easy: 800,
  medium: 1200,
  hard: 1700,
  expert: 2200,
};

function PlayBotPage() {
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(game.fen());
  const [moves, setMoves] = useState([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [playerColor, setPlayerColor] = useState('white');
  const [difficulty, setDifficulty] = useState('medium');
  const [elo, setElo] = useState(difficultyLevels.medium);
  const [status, setStatus] = useState('');

  const getBotMove = useCallback(async (currentFen, currentElo) => {
    try {
      const response = await fetch('/api/bot-move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fen: currentFen, elo: currentElo }),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      if (data.move) {
        const gameCopy = new Chess(currentFen);
        const moveResult = gameCopy.move(data.move);
        if (moveResult) {
          setGame(gameCopy);
          setFen(gameCopy.fen());
          setMoves(prevMoves => [...prevMoves, moveResult.san]);
        }
      } else if (data.error) {
        console.error("Error from bot:", data.error);
        setStatus(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Failed to fetch bot move:", error);
      setStatus("Failed to get bot's move.");
    }
  }, []);

  useEffect(() => {
    if (gameStarted && game.turn() !== playerColor[0]) {
      // If it's the bot's turn right after the game starts (e.g., player chose black)
      const timer = setTimeout(() => getBotMove(fen, elo), 500);
      return () => clearTimeout(timer);
    }
  }, [gameStarted, game, playerColor, fen, elo, getBotMove]);

  useEffect(() => {
    const newElo = difficultyLevels[difficulty];
    setElo(newElo);
  }, [difficulty]);
  
  useEffect(() => {
    if (game.isGameOver()) {
        if (game.isCheckmate()) {
            setStatus(`Checkmate! ${game.turn() === 'w' ? 'Black' : 'White'} wins.`);
        } else if (game.isDraw()) {
            setStatus("Draw!");
        } else if (game.isStalemate()) {
            setStatus("Stalemate!");
        } else if (game.isThreefoldRepetition()) {
            setStatus("Draw by threefold repetition!");
        } else if (game.isInsufficientMaterial()) {
            setStatus("Draw by insufficient material!");
        }
    } else {
        setStatus(`It's ${game.turn() === 'w' ? 'White' : 'Black'}'s turn.`);
    }
  }, [fen, game]);


  const handleStartGame = () => {
    const newGame = new Chess();
    setGame(newGame);
    setFen(newGame.fen());
    setMoves([]);
    setGameStarted(true);
    setStatus(`Game started. It's White's turn.`);
    console.log("Game started, gameStarted set to true.");
  };

  const onDrop = (sourceSquare, targetSquare) => {
    console.log("onDrop triggered");
    console.log("Is game started?", gameStarted);
    console.log("Whose turn is it?", game.turn());
    console.log("What is the player's color?", playerColor);

    if (!gameStarted || game.turn() !== playerColor[0]) {
      console.log("Move blocked by condition.");
      return false;
    }

    const gameCopy = new Chess(fen);
    const move = gameCopy.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: 'q',
    });

    if (move === null) return false;

    setGame(gameCopy);
    setFen(gameCopy.fen());
    setMoves(prevMoves => [...prevMoves, move.san]);

    if (!gameCopy.isGameOver()) {
      setTimeout(() => getBotMove(gameCopy.fen(), elo), 500);
    }
    
    return true;
  };

  const formatMoves = () => {
    const formatted = [];
    for (let i = 0; i < moves.length; i += 2) {
      const moveNumber = i / 2 + 1;
      const whiteMove = moves[i] ? moves[i] : '';
      const blackMove = moves[i + 1] ? moves[i + 1] : '';
      formatted.push(
        <li key={moveNumber}>
          {moveNumber}. <span>{whiteMove}</span> <span>{blackMove}</span>
        </li>
      );
    }
    return formatted;
  };

  return (
    <div className="play-bot-container">
      <div className="sidebar">
        <div className="sidebar-section">
          <h3>Color</h3>
          <div className="button-group">
            <button onClick={() => setPlayerColor('white')} className={playerColor === 'white' ? 'selected' : ''} disabled={gameStarted}>White</button>
            <button onClick={() => setPlayerColor('black')} className={playerColor === 'black' ? 'selected' : ''} disabled={gameStarted}>Black</button>
          </div>
        </div>

        <div className="sidebar-section">
          <h3>Difficulty</h3>
          <div className="button-group">
            {Object.keys(difficultyLevels).map(level => (
              <button key={level} onClick={() => setDifficulty(level)} className={difficulty === level ? 'selected' : ''} disabled={gameStarted}>{level.charAt(0).toUpperCase() + level.slice(1)}</button>
            ))}
          </div>
        </div>

        <div className="sidebar-section elo-slider-container">
          <label htmlFor="elo-slider">Bot ELO: {elo}</label>
          <input
            type="range"
            id="elo-slider"
            min="100"
            max="3000"
            value={elo}
            onChange={(e) => setElo(Number(e.target.value))}
            disabled={gameStarted}
          />
        </div>

        <button onClick={handleStartGame} className="start-game-button">
          {gameStarted ? 'Restart Game' : 'Start Game'}
        </button>
        
        <div className="sidebar-section">
            <h3>Status</h3>
            <div className="game-status">{status}</div>
        </div>

        <div className="sidebar-section">
          <h3>Moves</h3>
          <div className="moves-history">
            <ol>{formatMoves()}</ol>
          </div>
        </div>
      </div>

      <div className="chessboard-container">
        <Chessboard
          key={gameStarted ? "started-board" : "initial-board"}
          position={fen}
          onPieceDrop={(source, target) => { console.log("onPieceDrop callback called!"); return onDrop(source, target); }}
          boardOrientation={playerColor}
          boardWidth={600}
          arePiecesDraggable={true}
        />
      </div>
    </div>
  );
}

export default PlayBotPage;