import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import winston from 'winston';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { findGame, onMessage, endGame } from './game.server.js';

// Load environment variables
dotenv.config();

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Initialize Express app
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// Routes
app.get('/', (req, res) => {
  logger.info('Loading index.html');
  res.sendFile(join(__dirname, '../index.html'));
});

// Socket.IO connection handling
io.on('connection', (client) => {
  const userId = uuidv4();
  client.data.userId = userId;
  
  logger.info(`Player ${userId} connected`);
  client.emit('onconnected', { id: userId });

  findGame(client);

  client.on('message', (message) => {
    onMessage(client, message);
  });

  client.on('disconnect', () => {
    logger.info(`Client ${userId} disconnected`);
    if (client.data.game?.id) {
      endGame(client.data.game.id, userId);
    }
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(err.stack);
  res.status(500).send('Something broke!');
});

// Start server
const port = process.env.PORT || 3014;
const startServer = async () => {
  try {
    await httpServer.listen(port);
    logger.info(`Server listening on port ${port}`);
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer(); 