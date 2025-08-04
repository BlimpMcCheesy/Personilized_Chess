import React from 'react';
import { Link } from 'react-router-dom';

function Home() {
  return (
    <div className="home-container">
      <header className="home-header">
        <h1>Welcome to Your Personalized Chess AI Coach!</h1>
        <p>Analyze your games, understand your weaknesses, and play against a bot tailored to your level.</p>
      </header>
      <section className="home-actions">
        <Link to="/play" className="action-button">
          <h2>Play Now</h2>
          <p>Challenge the bot and test your skills.</p>
        </Link>
        <Link to="/analysis" className="action-button">
          <h2>Analyze Games</h2>
          <p>Import your games and get a detailed breakdown.</p>
        </Link>
      </section>
    </div>
  );
}

export default Home;
