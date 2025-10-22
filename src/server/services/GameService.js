import { Game } from '../models/Game.js';
import game_core from '../../game.core.server.js';

export class GameService {
    constructor(logger = null, storage = null) {
        this.games = {}; // In-memory cache for active games
        this.game_count = 0;
        this.logger = logger;
        this.storage = storage; // Optional Redis storage adapter
    }

    /**
     * Initialize service - sync with Redis if available
     */
    async initialize() {
        if (this.storage) {
            try {
                const redisCount = await this.storage.getGameCount();
                console.log(`GameService initialized. Redis reports ${redisCount} active games.`);
            } catch (error) {
                console.error('Error initializing GameService with Redis:', error);
            }
        }
    }

    async createGame(player) {
        console.log('Creating game');
        const game = new Game(player, this.logger);
        this.games[game.id] = game;
        this.game_count++;

        game.gamecore = new game_core(game);
        game.gamecore.update(new Date().getTime());

        // Ping player as host
        player.send('s.h.' + String(game.gamecore.local_time).replace('.', '-'));
        console.log('Server host at ' + game.gamecore.local_time);
        player.game = game;
        player.hosting = true;

        // Persist to Redis if available
        if (this.storage) {
            await this.storage.saveGame(game);
        }

        return game;
    }

    async findGame(player) {
        console.log('Looking for a game. We have: ' + this.game_count);
        console.log('Player connecting:', player.userid, player.playername);

        // First check in-memory games
        for (const game of Object.values(this.games)) {
            if (game.player_count < 2) {
                console.log('Adding player to existing game:', game.id);
                game.addClient(player);

                // Update Redis
                if (this.storage) {
                    await this.storage.saveGame(game);
                }

                return game;
            }
        }

        // If no in-memory games available, check Redis for games from other instances
        if (this.storage && this.game_count === 0) {
            const availableGame = await this.storage.findAvailableGame();
            if (availableGame) {
                console.log('Found available game in Redis:', availableGame.id);
                // Note: In a multi-instance scenario, we'd need to handle this differently
                // For now, we create a new game since we can't access the other instance's memory
            }
        }

        // No open games found, create new one
        console.log('No open games found, creating new game');
        return await this.createGame(player);
    }

    async endGame(gameId, userId) {
        const game = this.games[gameId];
        if (!game) {
            console.log('Game not found.');
            return;
        }

        game.stop();

        if (game.player_count > 1) {
            const otherPlayer = game.getOtherPlayer(userId);
            if (otherPlayer) {
                otherPlayer.send('s.e');
                await this.findGame(otherPlayer);
            }
        }

        delete this.games[gameId];
        this.game_count--;
        console.log('Game removed. There are ' + this.game_count + ' games');

        // Remove from Redis
        if (this.storage) {
            await this.storage.deleteGame(gameId);
        }
    }

    async winGame(gameId) {
        const game = this.games[gameId];
        if (!game) {
            console.log('Game not found.');
            return;
        }

        game.stop();

        // Handle both players
        if (game.player_client) {
            game.player_client.send('s.e');
            await this.findGame(game.player_client);
        }
        if (game.player_host) {
            game.player_host.send('s.e');
            game.player_host.hosting = false;
            await this.findGame(game.player_host);
        }

        delete this.games[gameId];
        this.game_count--;
        console.log('Game removed. There are ' + this.game_count + ' games');

        // Remove from Redis
        if (this.storage) {
            await this.storage.deleteGame(gameId);
        }
    }

} 