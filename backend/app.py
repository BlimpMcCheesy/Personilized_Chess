from flask import Flask, jsonify, request, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_bcrypt import Bcrypt
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user

import requests
import chess.pgn
import chess.engine
import io
import os
from collections import Counter


# Point to the React build folder for serving static files
app = Flask(__name__, static_folder='../frontend/build')
# CORS(app) # No longer needed

app.config['SECRET_KEY'] = 'your_super_secret_key' # !! CHANGE THIS IN PRODUCTION !!
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///site.db'

engine = None
_engine_loaded = False

@app.before_request
def load_engine_once():
    global engine
    global _engine_loaded
    if not _engine_loaded:
        try:
            # Adjust the path to Stockfish based on your installation
            # On macOS with Homebrew, it's usually /opt/homebrew/bin/stockfish
            engine = chess.engine.SimpleEngine.popen_uci("/opt/homebrew/bin/stockfish")
            print("Stockfish engine loaded successfully.")
            _engine_loaded = True
        except Exception as e:
            print(f"Error loading Stockfish engine: {e}")
            engine = None
            _engine_loaded = False # Keep false if loading fails

@app.teardown_appcontext
def shutdown_engine(exception):
    global engine
    global _engine_loaded
    if _engine_loaded and engine:
        engine.quit()
        _engine_loaded = False # Reset flag on shutdown
        print("Stockfish engine shut down.")


# This route is now handled by the catch-all `serve` function
# @app.route('/')
# def hello_world():
#     return 'Hello, Flask Backend!'

@app.route('/api/hello')
def api_hello():
    return jsonify(message='Hello from the backend API!')

@app.route('/api/games/<username>')
def get_player_games(username):
    games_data = []
    archives_url = f"https://api.chess.com/pub/player/{username}/games/archives"
    try:
        archives_response = requests.get(archives_url)
        archives_response.raise_for_status()  # Raise an exception for bad status codes
        archives = archives_response.json()

        for archive_url in archives['archives']:
            pgn_response = requests.get(archive_url)
            pgn_response.raise_for_status()
            pgn_data = pgn_response.text
            
            # Parse PGN data
            pgn_io = io.StringIO(pgn_data)
            while True:
                game = chess.pgn.read_game(pgn_io)
                if game is None:
                    break
                games_data.append({
                    'headers': dict(game.headers),
                    'moves': [move.uci() for move in game.mainline_moves()]
                })

    except requests.exceptions.RequestException as e:
        return jsonify(error=f"Error fetching data from Chess.com: {e}"), 500
    except Exception as e:
        return jsonify(error=f"An unexpected error occurred: {e}"), 500

    return jsonify(games=games_data)

@app.route('/api/analyze', methods=['POST'])
def analyze_position():
    if not engine:
        return jsonify(error="Chess engine not loaded."), 500
    
    data = request.json
    fen = data.get('fen')
    moves_uci = data.get('moves', []) # List of UCI moves to apply to an empty board

    board = chess.Board()

    if fen:
        try:
            board.set_fen(fen)
        except ValueError:
            return jsonify(error="Invalid FEN string."), 400
    elif moves_uci:
        for move_uci in moves_uci:
            try:
                board.push_uci(move_uci)
            except ValueError:
                return jsonify(error=f"Invalid move UCI: {move_uci}"), 400
    else:
        return jsonify(error="No FEN or moves provided for analysis."), 400
    
    try:
        info = engine.analyse(board, chess.engine.Limit(time=0.1))
        best_move = info.get("pv", [])[0].uci() if "pv" in info and info["pv"] else None
        score = info.get("score").white().score(mate_score=100000) if info.get("score") else None

        return jsonify({
            'best_move': best_move,
            'evaluation': score # Score in centipawns, positive for White, negative for Black
        })
    except Exception as e:
        return jsonify(error=f"Error analyzing position: {e}"), 500

def get_score(pov_score, board):
    """Converts a Score object to a centipawn value from White's perspective."""
    if pov_score.is_mate():
        # Assign a very high score for mate
        return 100000 if pov_score.white().mate() > 0 else -100000
    else:
        return pov_score.white().score(mate_score=100000)

@app.route('/api/analyze_game', methods=['POST'])
def analyze_game():
    if not engine:
        return jsonify(error="Chess engine not loaded."), 500

    data = request.json
    moves_uci = data.get('moves')

    if not moves_uci:
        return jsonify(error="No moves provided for analysis."), 400

    board = chess.Board()
    analysis_results = []

    try:
        for i, move_uci in enumerate(moves_uci):
            # Analyze the position *before* the move to find the best move
            info_before = engine.analyse(board, chess.engine.Limit(time=0.1))
            best_move_before = info_before.get("pv", [])[0] if "pv" in info_before and info_before["pv"] else None
            eval_before = get_score(info_before["score"], board)

            # Apply the actual move from the game
            move = chess.Move.from_uci(move_uci)
            if move not in board.legal_moves:
                 return jsonify(error=f"Illegal move {move_uci} at position {i+1}"), 400
            board.push(move)

            # Analyze the position *after* the move
            info_after = engine.analyse(board, chess.engine.Limit(time=0.1))
            eval_after = get_score(info_after["score"], board)
            
            # Determine centipawn loss
            # The player whose turn it was just moved. Their evaluation changed from eval_before to eval_after.
            # If it was white's turn (board.turn is now black), the loss is eval_before - eval_after
            # If it was black's turn (board.turn is now white), the loss is -(eval_before - eval_after)
            if board.turn == chess.BLACK: # White just moved
                centipawn_loss = eval_before - eval_after
            else: # Black just moved
                centipawn_loss = (eval_before - eval_after) * -1


            analysis_results.append({
                'move_number': i + 1,
                'move_uci': move_uci,
                'best_move_uci': best_move_before.uci() if best_move_before else None,
                'evaluation_before': eval_before,
                'evaluation_after': eval_after,
                'centipawn_loss': centipawn_loss,
            })

        # Calculate total centipawn loss for the game
        total_centipawn_loss = sum(abs(res['centipawn_loss']) for res in analysis_results)

        # Find top 3 moves with highest centipawn loss
        top_blunders = sorted(analysis_results, key=lambda x: abs(x['centipawn_loss']), reverse=True)[:3]
        
    except Exception as e:
        return jsonify(error=f"An error occurred during analysis: {e}"), 500
    
    return jsonify(analysis=analysis_results, total_centipawn_loss=total_centipawn_loss, top_blunders=top_blunders)


@app.route('/api/bot-move', methods=['POST'])
def get_bot_move():
    if not engine:
        return jsonify(error="Chess engine not loaded."), 500

    data = request.json
    fen = data.get('fen')
    elo = data.get('elo', 1200) # Default ELO if not provided

    if not fen:
        return jsonify(error="FEN string is required."), 400

    try:
        board = chess.Board(fen)
    except ValueError:
        return jsonify(error="Invalid FEN string."), 400

    if board.is_game_over():
        return jsonify(error="Game is already over."), 400

    try:
        # Configure engine for strength
        engine.configure({"UCI_LimitStrength": True, "UCI_Elo": elo})
        
        # Get the best move from the engine
        result = engine.play(board, chess.engine.Limit(time=0.5)) # Limit time to 0.5s
        
        if result.move:
            return jsonify(move=result.move.uci())
        else:
            return jsonify(error="Engine could not find a move."), 500
            
    except Exception as e:
        return jsonify(error=f"An error occurred while getting bot move: {e}"), 500


from collections import Counter

@app.route('/api/aggregate_analysis', methods=['POST'])
def aggregate_analysis():
    data = request.json
    all_analyses = data.get('analyses') # Expecting a list of analysis results

    if not all_analyses:
        return jsonify(error="No analysis data provided."), 400

    total_moves = 0
    total_cp_loss = 0
    blunder_moves = []

    for game_analysis in all_analyses:
        for move_data in game_analysis:
            total_moves += 1
            cp_loss = move_data.get('centipawn_loss', 0)
            total_cp_loss += cp_loss

            # Define a blunder as a move with a centipawn loss of 100 or more
            if cp_loss >= 100:
                blunder_moves.append(move_data['move_uci'])
    
    average_cp_loss = total_cp_loss / total_moves if total_moves > 0 else 0

    # Count the frequency of each blunder
    most_common_blunders = Counter(blunder_moves).most_common(5) # Top 5 most common blunders

    return jsonify({
        'average_centipawn_loss': average_cp_loss,
        'most_common_blunders': most_common_blunders,
        'total_games_analyzed': len(all_analyses),
        'total_moves_analyzed': total_moves,
    })


@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory(os.path.join(app.static_folder, 'static'), path)

# Serve React App
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if(path != "" and os.path.exists(os.path.join(app.static_folder, path))):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    # This part is for development only and won't be used by gunicorn
    app.run(debug=True, use_reloader=False)