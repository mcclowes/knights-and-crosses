import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';
import { GameServer } from './src/game.server.js';
import { SOCKET_PATH } from './src/server/utils/config.js';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3000;

// Create Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // Initialize Socket.io with the HTTP server
  const io = new Server(httpServer, { path: SOCKET_PATH });

  // Initialize the game server with Socket.io and HTTP server
  const gameServer = new GameServer(io, httpServer);
  gameServer.start().catch(error => {
    console.error('Failed to start game server:', error);
    process.exit(1);
  });

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
