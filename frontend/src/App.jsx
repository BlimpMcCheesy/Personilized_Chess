import './App.css';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './Home';
import PlayBotPage from './PlayBotPage';
import AnalysisPage from './AnalysisPage';
import TestBoard from './TestBoard';

function App() {
  return (
    <Router>
      <div className="App">
        <nav className="app-nav">
          <div className="nav-links">
            <Link to="/">Home</Link>
            <Link to="/play">Play Bot</Link>
            <Link to="/analysis">Analysis</Link>
            <Link to="/testboard">Test Board</Link> {/* New link for TestBoard */}
          </div>
          <button className="login-button">Login</button>
        </nav>
        <main className="app-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/play" element={<PlayBotPage />} /> {/* Reverted to PlayBotPage */}
            <Route path="/analysis" element={<AnalysisPage />} />
            <Route path="/testboard" element={<TestBoard />} /> {/* TestBoard route */}
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
