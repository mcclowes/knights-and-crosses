import type { NextApiRequest, NextApiResponse } from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { Socket as NetSocket } from 'net';
import { GameServer } from '../../src/game.server.js';

interface SocketServer extends HTTPServer {
  io?: SocketIOServer | undefined;
}

interface SocketWithIO extends NetSocket {
  server: SocketServer;
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO;
}

/**
 * Socket.IO API route for Vercel deployment
 * This route initializes Socket.IO on the serverless Next.js HTTP server
 */
export default function handler(req: NextApiRequest, res: NextApiResponseWithSocket) {
  if (res.socket.server.io) {
    console.log('Socket.IO already initialized');
    res.end();
    return;
  }

  console.log('Initializing Socket.IO server...');

  // Initialize Socket.IO
  const io = new SocketIOServer(res.socket.server as any, {
    path: '/api/socket',
    addTrailingSlash: false,
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  res.socket.server.io = io;

  // Initialize the game server with Socket.IO
  const gameServer = new GameServer(io, res.socket.server);
  gameServer.start().catch(error => {
    console.error('Failed to start game server:', error);
  });

  console.log('Socket.IO server initialized successfully');
  res.end();
}
