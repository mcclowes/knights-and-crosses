import { GameServer } from './src/game.server.js';

// Create and start the game server
const gameServer = new GameServer();
gameServer.start().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});