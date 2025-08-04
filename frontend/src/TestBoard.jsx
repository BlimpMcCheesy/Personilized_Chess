import React, { useState } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import './TestBoard.css';

function TestBoard() {
  const [game, setGame] = useState(new Chess());
  const [aiProfile, setAiProfile] = useState(null);
  const [arePiecesDraggable, setArePiecesDraggable] = useState(false);

  const onDrop = (sourceSquare, targetSquare) => {
    console.log("onDrop called with:", sourceSquare, targetSquare);
    let moveMade = false;

    setGame((prevGame) => {
      console.log("Previous game FEN:", prevGame.fen());
      const gameCopy = new Chess(prevGame.fen());
      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });

      if (move === null) {
        console.log("Invalid move attempted:", { from: sourceSquare, to: targetSquare });
        return prevGame;
      }

      console.log("Move made:", move);
      moveMade = true;
      return gameCopy;
    });

    console.log("Returning moveMade:", moveMade);
    return moveMade;
  };

  const handleEnableProfile = () => {
    console.log("Enable AI profile clicked");
    const mockProfile = {
      average_centipawn_loss: 50,
      most_common_blunders: [["e2e4", 10], ["d2d4", 8]],
    };
    setAiProfile(mockProfile);
    console.log("AI Profile set:", mockProfile);
  };

  console.log("Rendering TestBoard. Draggable:", arePiecesDraggable);
  console.log("Current game FEN:", game.fen());

  return (
    <div className="chessboard-container">
      <div style={{ padding: 40 }}>
        <h2>Minimal Chessboard Test</h2>
        <button onClick={handleEnableProfile} style={{ marginBottom: '20px', padding: '10px' }}>
          Enable AI Profile
        </button>
        {aiProfile && (
          <div style={{ marginBottom: '20px' }}>
            <h3>AI Profile Enabled</h3>
            <p>Average Centipawn Loss: {aiProfile.average_centipawn_loss}</p>
            <p>Most Common Blunders: {aiProfile.most_common_blunders.map(blunder => `${blunder[0]} (${blunder[1]})`).join(', ')}</p>
          </div>
        )}
        <Chessboard
          position={game.fen()}
          onPieceDrop={onDrop}
          arePiecesDraggable={arePiecesDraggable}
          boardWidth={800}
        />
      </div>
    </div>
  );
}

export default TestBoard;
