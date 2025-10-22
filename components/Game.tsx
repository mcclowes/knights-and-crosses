import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import Script from 'next/script';

// Extend the Window interface to include game-related properties
declare global {
  interface Window {
    setPlayerName?: () => void;
    game?: {
      socket?: unknown;
    };
    game_core?: unknown;
    $?: any;
    jQuery?: any;
    io?: any;
    dat?: any;
  }
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playerName, setPlayerName] = useState('');
  const [showNameInput, setShowNameInput] = useState(true);

  useEffect(() => {
    // Check for saved player name
    const savedName = localStorage.getItem('playerName');
    if (savedName) {
      setPlayerName(savedName);
    }
  }, []);

  useEffect(() => {
    // Dynamically import and attach libraries to window object for legacy game code
    // This ensures they only load on the client side, avoiding SSR issues
    const loadLibraries = async () => {
      if (typeof window !== 'undefined') {
        // Load jQuery
        const jQuery = (await import('jquery')).default;
        window.$ = jQuery;
        window.jQuery = jQuery;

        // Load Socket.io client
        const { io } = await import('socket.io-client');
        window.io = io;

        // Load dat.gui
        const dat = await import('dat.gui');
        window.dat = dat;

        console.log('Client libraries loaded successfully');
      }
    };

    loadLibraries();
  }, []);

  const handleStartGame = () => {
    if (playerName.trim()) {
      localStorage.setItem('playerName', playerName);
      setShowNameInput(false);
      // Call the global setPlayerName function once the game is initialized
      if (typeof window !== 'undefined' && window.setPlayerName) {
        // Wait for game to be initialized before calling setPlayerName
        const checkGameInitialized = () => {
          if (window.game && window.game.socket) {
            window.setPlayerName();
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
    // Ensure game_core is available before initializing
    if (typeof window !== 'undefined' && window.game_core) {
      console.log('Game core constructor is available');
    } else {
      console.error('Game core constructor not found');
    }
  };

  return (
    <>
      <Head>
        <title>Knights & Crosses</title>
      </Head>

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
