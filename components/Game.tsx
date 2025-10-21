import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import Script from 'next/script';

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playerName, setPlayerName] = useState('');
  const [showNameInput, setShowNameInput] = useState(true);
  const [scriptsLoaded, setScriptsLoaded] = useState(false);

  useEffect(() => {
    // Check for saved player name
    const savedName = localStorage.getItem('playerName');
    if (savedName) {
      setPlayerName(savedName);
    }
  }, []);

  const handleStartGame = () => {
    if (playerName.trim()) {
      localStorage.setItem('playerName', playerName);
      setShowNameInput(false);
      // Call the global setPlayerName function once the game is initialized
      if (typeof window !== 'undefined' && (window as any).setPlayerName) {
        // Wait for game to be initialized before calling setPlayerName
        const checkGameInitialized = () => {
          if ((window as any).game && (window as any).game.socket) {
            (window as any).setPlayerName();
          } else {
            // Retry after a short delay if game isn't ready yet
            setTimeout(checkGameInitialized, 100);
          }
        };
        checkGameInitialized();
      }
    }
  };

  const handleScriptsLoad = () => {
    setScriptsLoaded(true);
    // Ensure game_core is available before initializing
    if (typeof window !== 'undefined' && (window as any).game_core) {
      console.log('Game core constructor is available');
    } else {
      console.error('Game core constructor not found');
    }
  };

  return (
    <>
      <Head>
        <title>Sigil Crosses</title>
      </Head>

      {/* Load jQuery first */}
      <Script
        src="/lib/jquery-2.1.4.min.js"
        strategy="beforeInteractive"
      />

      {/* Load Socket.io client */}
      <Script
        src="/socket.io/socket.io.js"
        strategy="beforeInteractive"
      />

      {/* Load dat.gui */}
      <Script
        src="/lib/dat.gui.min.js"
        strategy="beforeInteractive"
      />

      {/* Load game client code */}
      <Script
        src="/game.core.client.js"
        strategy="afterInteractive"
        onLoad={handleScriptsLoad}
      />

      {showNameInput && (
        <div
          id="name-input"
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0,0,0,0.8)',
            padding: '20px',
            borderRadius: '10px',
            color: 'white',
            textAlign: 'center',
            zIndex: 1000,
          }}
        >
          <h2>Enter Your Name</h2>
          <input
            type="text"
            id="player-name"
            placeholder="Your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleStartGame();
              }
            }}
            style={{
              padding: '8px',
              margin: '10px 0',
              width: '200px',
            }}
          />
          <button
            onClick={handleStartGame}
            style={{
              padding: '8px 16px',
              margin: '10px',
            }}
          >
            Start Game
          </button>
        </div>
      )}

      <canvas id="viewport" ref={canvasRef} />
    </>
  );
}
