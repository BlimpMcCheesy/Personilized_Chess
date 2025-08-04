import './App.css';
import { Chessboard } from "react-chessboard";
import { useState, useEffect } from 'react';

function AnalysisPage() {
  const [message, setMessage] = useState('');
  const [username, setUsername] = useState('');
  const [games, setGames] = useState([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [loadingAggregateAnalysis, setLoadingAggregateAnalysis] = useState(false);
  const [error, setError] = useState(null);
  const [analyzedGame, setAnalyzedGame] = useState(null);
  const [totalCentipawnLoss, setTotalCentipawnLoss] = useState(null);
  const [topBlunders, setTopBlunders] = useState([]);
  const [aggregateAnalysis, setAggregateAnalysis] = useState(null);
  const [boardPosition, setBoardPosition] = useState("start"); // To display game positions

  useEffect(() => {
    fetch('http://127.0.0.1:5000/api/hello')
      .then(response => response.json())
      .then(data => setMessage(data.message))
      .catch(error => console.error('Error fetching data:', error));
  }, []);


  const handleFetchGames = () => {
    setLoadingGames(true);
    setError(null);
    setGames([]);
    setAnalyzedGame(null); 
    setTotalCentipawnLoss(null);
    setTopBlunders([]);
    setAggregateAnalysis(null);
    fetch(`http://127.0.0.1:5000/api/games/${username}`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        if (data.error) {
          throw new Error(data.error);
        }
        setGames(data.games);
      })
      .catch(e => {
        console.error('Error fetching games:', e);
        setError(e.message);
      })
      .finally(() => {
        setLoadingGames(false);
      });
  };

  const handleAnalyzeGame = (gameMoves) => {
    setLoadingAnalysis(true);
    setError(null);
    setAnalyzedGame(null);
    setTotalCentipawnLoss(null);
    setTopBlunders([]);
    fetch('http://127.0.0.1:5000/api/analyze_game', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ moves: gameMoves }),
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        if (data.error) {
          throw new Error(data.error);
        }
        setAnalyzedGame(data.analysis);
        setTotalCentipawnLoss(data.total_centipawn_loss);
        setTopBlunders(data.top_blunders);
      })
      .catch(e => {
        console.error('Error analyzing game:', e);
        setError(e.message);
      })
      .finally(() => {
        setLoadingAnalysis(false);
      });
  };

  const handleAggregateAnalysis = async () => {
    setLoadingAggregateAnalysis(true);
    setError(null);
    setAggregateAnalysis(null);

    try {
      const allAnalyses = [];
      for (const game of games) {
        const response = await fetch('http://127.0.0.1:5000/api/analyze_game', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ moves: game.moves }),
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data.error) {
          throw new Error(data.error);
        }
        allAnalyses.push(data.analysis);
      }

      const aggregateResponse = await fetch('http://127.0.0.1:5000/api/aggregate_analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ analyses: allAnalyses }),
      });
      if (!aggregateResponse.ok) {
        throw new Error(`HTTP error! status: ${aggregateResponse.status}`);
      }
      const aggregateData = await aggregateResponse.json();
      if (aggregateData.error) {
        throw new Error(aggregateData.error);
      }
      setAggregateAnalysis(aggregateData);

    } catch (e) {
      console.error('Error in aggregate analysis:', e);
      setError(e.message);
    } finally {
      setLoadingAggregateAnalysis(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <p>{message}</p>
        <div style={{ width: "500px", margin: "20px auto" }}>
          <Chessboard position={boardPosition} boardWidth={600} />
        </div>
        <div>
          <input
            type="text"
            placeholder="Enter Chess.com Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ marginRight: '10px', padding: '8px', fontSize: '16px' }}
          />
          <button
            onClick={handleFetchGames}
            style={{ padding: '8px 15px', fontSize: '16px' }}
            disabled={loadingGames}
          >
            {loadingGames ? 'Fetching...' : 'Fetch Games'}
          </button>
        </div>
        {error && <p style={{ color: 'red' }}>Error: {error}</p>}

        {games.length > 0 && (
          <div>
            <h3>Your Games ({games.length}):</h3>
            <button
              onClick={handleAggregateAnalysis}
              style={{ margin: '10px 0', padding: '8px 15px', fontSize: '16px' }}
              disabled={loadingAggregateAnalysis || loadingAnalysis}
            >
              {loadingAggregateAnalysis ? 'Building Your Profile...' : 'Create My AI Profile'}
            </button>
            <ul>
              {games.map((game, index) => (
                <li key={index} style={{ marginBottom: '10px'}}>
                  {game.headers.White} vs. {game.headers.Black} - {game.headers.Result}
                  <button
                    onClick={() => handleAnalyzeGame(game.moves)}
                    style={{ marginLeft: '10px', padding: '5px 10px' }}
                    disabled={loadingAnalysis || loadingAggregateAnalysis}
                  >
                    {loadingAnalysis ? 'Analyzing...' : 'Analyze Game'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {loadingAggregateAnalysis && <p>Performing aggregate analysis...</p>}

        {aggregateAnalysis && (
          <div style={{'textAlign': 'left', 'marginTop': '20px'}}>
            <h3>Your Personalized AI Profile:</h3>
            <p>
              Across {aggregateAnalysis.total_games_analyzed} games and {aggregateAnalysis.total_moves_analyzed} moves, your average centipawn loss is{' '}
              <strong>{aggregateAnalysis.average_centipawn_loss.toFixed(2)}</strong>.
            </p>
            <h4>Your Most Common Blunders (Moves with &gt; 100 CPL):</h4>
            <ul>
              {aggregateAnalysis.most_common_blunders.map(([move, count], index) => (
                <li key={index}>
                  Move: <strong>{move}</strong> (Made {count} time(s))
                </li>
              ))}
            </ul>
          </div>
        )}

        {loadingAnalysis && <p>Analyzing game...</p>}

        {analyzedGame && (
          <div style={{'width': '80%', 'marginTop': '20px'}}>
            <h3>Game Analysis:</h3>
            {totalCentipawnLoss !== null && (
              <p>Total Centipawn Loss for this game: {totalCentipawnLoss}</p>
            )}
            {topBlunders.length > 0 && (
              <div>
                <h4>Top Blunders:</h4>
                <ul>
                  {topBlunders.map((blunder, index) => (
                    <li key={index}>
                      Move {blunder.move_number}: {blunder.move_uci} (Loss: {blunder.centipawn_loss})
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{'border': '1px solid white', 'padding': '8px'}}>Move #</th>
                  <th style={{'border': '1px solid white', 'padding': '8px'}}>Move Played</th>
                  <th style={{'border': '1px solid white', 'padding': '8px'}}>Best Move</th>
                  <th style={{'border': '1px solid white', 'padding': '8px'}}>Eval Before</th>
                  <th style={{'border': '1px solid white', 'padding': '8px'}}>Eval After</th>
                  <th style={{'border': '1px solid white', 'padding': '8px'}}>Centipawn Loss</th>
                </tr>
              </thead>
              <tbody>
                {analyzedGame.map((moveAnalysis, index) => (
                  <tr key={index}>
                    <td style={{'border': '1px solid white', 'padding': '8px'}}>{moveAnalysis.move_number}</td>
                    <td style={{'border': '1px solid white', 'padding': '8px'}}>{moveAnalysis.move_uci}</td>
                    <td style={{'border': '1px solid white', 'padding': '8px'}}>{moveAnalysis.best_move_uci}</td>
                    <td style={{'border': '1px solid white', 'padding': '8px'}}>{moveAnalysis.evaluation_before}</td>
                    <td style={{'border': '1px solid white', 'padding': '8px'}}>{moveAnalysis.evaluation_after}</td>
                    <td style={{'border': '1px solid white', 'padding': '8px'}}>{moveAnalysis.centipawn_loss}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </header>
    </div>
  );
}

export default AnalysisPage;