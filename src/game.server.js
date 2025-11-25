import { Server } from 'socket.io';
import { v4 as UUID } from 'uuid';
import express from 'express';
import http from 'http';
import dns from 'dns';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { GameService } from './server/services/GameService.js';
import { MessageHandler } from './server/handlers/MessageHandler.js';
import { Logger } from './server/utils/logger.js';
import { RedisGameStorage } from './server/storage/RedisGameStorage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class GameServer {
	constructor(io = null, httpServer = null) {
		this.port = process.env.PORT || 3014;
		this.address = '127.0.0.1'; // Explicitly use IPv4
		this.verbose = true; // Enable verbose logging for debugging
		this.logger = new Logger(this.verbose);
		this.isServerless = false;

		// Use provided server/io or create new ones
		if (io && httpServer) {
			this.io = io;
			this.server = httpServer;
			this.app = null; // No need for Express routes when using Next.js
			this.isServerless = true; // Mark as serverless when using provided server
		} else {
			this.app = express();
			this.server = http.createServer(this.app);
			this.io = new Server(this.server);
		}

                // Initialize Redis storage for serverless environments when Redis is configured
                const redisConfigured = !!process.env.KV_URL;
                const storage = this.isServerless && redisConfigured ? new RedisGameStorage() : null;

                if (this.isServerless && !redisConfigured) {
                        this.logger?.warn?.(
                                'Redis storage disabled: KV_URL not set.'
                        );
                }

                this.gameService = new GameService(this.logger, storage);
		this.messageHandler = new MessageHandler(this.gameService);

		// Only add error handler for non-serverless environments
		if (!this.isServerless && this.server && typeof this.server.on === 'function') {
			this.server.on('error', this.handleServerError.bind(this));
		}
	}

	async start() {
		try {
			// Initialize game service (sync with Redis if available)
			await this.gameService.initialize();

			// Only setup server if not using Next.js
			if (this.app) {
				await this.setupServer();
			}
			this.setupSocketHandlers();
		} catch (error) {
			this.logger.error('Failed to start server:', error);
			if (!this.isServerless) {
				process.exit(1);
			}
			throw error; // Re-throw for serverless environments
		}
	}

	handleServerError(error) {
		if (error.code === 'EADDRINUSE') {
			this.logger.error(`Port ${this.port} is already in use. Please try a different port or stop the existing process.`);
			this.logger.info('To find and stop the process using this port, run:');
			this.logger.info(`lsof -i :${this.port}`);
			this.logger.info('Or try using a different port by setting the PORT environment variable:');
			this.logger.info(`PORT=${this.port + 1} node app.js`);
			process.exit(1);
		} else {
			this.logger.error('Server error:', error);
		}
	}

	setupServer() {
		return new Promise((resolve, _reject) => {
			try {
				// Try to get the hostname, but fallback to IPv4 localhost
				dns.lookup(os.hostname(), { family: 4 }, (err, add) => {
					if (err) {
						this.logger.warn('DNS lookup failed, using IPv4 localhost:', err);
						add = '127.0.0.1';
					}

					// Serve static files from the root directory
					this.app.use(express.static(join(__dirname, '..')));

					this.server.listen(this.port, add, () => {
						this.address = add;
						this.logger.log('Listening on ' + add + ':' + this.port);
						this.setupRoutes();
						resolve();
					});
				});
			} catch (err) {
				this.logger.warn('Failed to get hostname, using IPv4 localhost:', err);
				// Serve static files from the root directory
				this.app.use(express.static(join(__dirname, '..')));

				this.server.listen(this.port, '127.0.0.1', () => {
					this.address = '127.0.0.1';
					this.logger.log('Listening on 127.0.0.1:' + this.port);
					this.setupRoutes();
					resolve();
				});
			}
		});
	}

	setupRoutes() {
		this.app.get('/', (req, res) => {
			this.logger.log('Loading %s', join(__dirname, 'index.html'));
			res.sendFile('index.html', { root: __dirname });
		});

		this.app.get('/*', (req, res) => {
			const file = req.params[0];
			if (this.verbose) this.logger.log('File requested: ' + file);
			res.sendFile(join(__dirname, file));
		});
	}

	setupSocketHandlers() {
		this.io.on('connection', (client) => {
			client.userid = UUID();
			client.playername = 'Player ' + client.userid.slice(0, 4);
			client.emit('onconnected', { id: client.userid, name: client.playername });
			this.logger.log('Player ' + client.playername + ' (' + client.userid + ') connected');

			// Find game async (no need to await here - fire and forget)
			this.gameService.findGame(client).catch((error) => {
				this.logger.error('Error finding game:', error);
			});

			client.on('message', (message) => {
				this.messageHandler.handleMessage(client, message);
			});

			client.on('setname', (name) => {
				client.playername = name;
				this.logger.log('Player ' + client.userid + ' renamed to ' + name);
				if (client.game) {
					client.game.player_host.send('s.n.' + client.playername);
					if (client.game.player_client) {
						client.game.player_client.send('s.n.' + client.playername);
					}
				}
			});

			client.on('disconnect', () => {
				this.logger.log('Client ' + client.playername + ' (' + client.userid + ') disconnected');
				if (client.game?.id) {
					this.gameService.endGame(client.game.id, client.userid).catch((error) => {
						this.logger.error('Error ending game:', error);
					});
				}
			});
		});
	}
}

// // Create and start the game server instance
// const gameServer = new GameServer();
// gameServer.start().catch(error => {
// 	console.error('Failed to start server:', error);
// 	process.exit(1);
// });

export { GameServer };
export default GameServer;
