import { kv } from '@vercel/kv';

/**
 * Redis-backed storage for complete game state
 * Stores full game state for cross-instance matchmaking and recovery
 * Enables serverless deployments and multi-instance game coordination
 * Game logic runs in-memory for performance, synced to KV on state changes
 */
export class RedisGameStorage {
    constructor() {
        this.GAME_KEY_PREFIX = 'game:';
        this.GAMES_LIST_KEY = 'games:active';
        // Infinite TTL for games - they're explicitly deleted when ended
        // This prevents long games from expiring mid-play
        this.GAME_TTL = null; // null = no expiration
        this.GAME_TTL_SECONDS = 7200; // 2 hours fallback if TTL needed
    }

    /**
     * Serialize full game state for storage
     */
    serializeGameState(game) {
        const gameState = {};

        if (game.gamecore) {
            gameState.turn = game.gamecore.turn;
            gameState.board = game.gamecore.board.state;
            gameState.local_time = game.gamecore.local_time;
            gameState.server_time = game.gamecore.server_time;

            // Serialize player states
            if (game.gamecore.players.self) {
                gameState.player_host = {
                    state: game.gamecore.players.self.state,
                    hand: game.gamecore.players.self.hand.map(card => ({ cardName: card.cardName })),
                    deck: game.gamecore.players.self.deck.map(card => ({ cardName: card.cardName })),
                    mmr: game.gamecore.players.self.mmr
                };
            }

            if (game.gamecore.players.other) {
                gameState.player_client = {
                    state: game.gamecore.players.other.state,
                    hand: game.gamecore.players.other.hand.map(card => ({ cardName: card.cardName })),
                    deck: game.gamecore.players.other.deck.map(card => ({ cardName: card.cardName })),
                    mmr: game.gamecore.players.other.mmr
                };
            }
        }

        return gameState;
    }

    /**
     * Save complete game state to Redis
     */
    async saveGame(game) {
        const gameKey = this.GAME_KEY_PREFIX + game.id;

        // Build complete game data including metadata and full state
        const gameData = {
            // Metadata
            id: game.id,
            hostId: game.player_host?.userid || null,
            clientId: game.player_client?.userid || null,
            playerCount: game.player_count,
            active: game.active,
            createdAt: Date.now(),
            lastUpdated: Date.now(),

            // Full game state (for cross-instance recovery)
            gameState: this.serializeGameState(game)
        };

        try {
            // Save complete game data
            // Use infinite TTL (no expiration) - games are explicitly deleted when ended
            if (this.GAME_TTL === null) {
                await kv.set(gameKey, JSON.stringify(gameData));
            } else {
                await kv.set(gameKey, JSON.stringify(gameData), { ex: this.GAME_TTL_SECONDS });
            }

            // Add to active games list
            await kv.sadd(this.GAMES_LIST_KEY, game.id);

            console.log(`Saved game ${game.id} with full state to Redis`);
            return true;
        } catch (error) {
            console.error('Error saving game to Redis:', error);
            return false;
        }
    }

    /**
     * Get game metadata from Redis
     */
    async getGame(gameId) {
        try {
            const gameKey = this.GAME_KEY_PREFIX + gameId;
            const data = await kv.get(gameKey);

            if (!data) {
                return null;
            }

            return typeof data === 'string' ? JSON.parse(data) : data;
        } catch (error) {
            console.error('Error getting game from Redis:', error);
            return null;
        }
    }

    /**
     * Get all active games
     */
    async getAllGames() {
        try {
            const gameIds = await kv.smembers(this.GAMES_LIST_KEY);
            const games = [];

            for (const gameId of gameIds) {
                const game = await this.getGame(gameId);
                if (game) {
                    games.push(game);
                } else {
                    // Clean up stale reference
                    await kv.srem(this.GAMES_LIST_KEY, gameId);
                }
            }

            return games;
        } catch (error) {
            console.error('Error getting all games from Redis:', error);
            return [];
        }
    }

    /**
     * Get count of active games
     */
    async getGameCount() {
        try {
            const games = await this.getAllGames();
            return games.length;
        } catch (error) {
            console.error('Error getting game count:', error);
            return 0;
        }
    }

    /**
     * Find an available game (less than 2 players)
     */
    async findAvailableGame() {
        try {
            const games = await this.getAllGames();
            return games.find(game => game.playerCount < 2) || null;
        } catch (error) {
            console.error('Error finding available game:', error);
            return null;
        }
    }

    /**
     * Delete game from Redis
     */
    async deleteGame(gameId) {
        try {
            const gameKey = this.GAME_KEY_PREFIX + gameId;
            await kv.del(gameKey);
            await kv.srem(this.GAMES_LIST_KEY, gameId);
            console.log(`Deleted game ${gameId} from Redis`);
            return true;
        } catch (error) {
            console.error('Error deleting game from Redis:', error);
            return false;
        }
    }

    /**
     * Update game player count and refresh timestamp
     */
    async updateGamePlayerCount(gameId, playerCount) {
        try {
            const game = await this.getGame(gameId);
            if (game) {
                game.playerCount = playerCount;
                game.lastUpdated = Date.now();
                const gameKey = this.GAME_KEY_PREFIX + gameId;

                // Use infinite TTL or configured TTL
                if (this.GAME_TTL === null) {
                    await kv.set(gameKey, JSON.stringify(game));
                } else {
                    await kv.set(gameKey, JSON.stringify(game), { ex: this.GAME_TTL_SECONDS });
                }
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error updating game player count:', error);
            return false;
        }
    }

    /**
     * Get full game data including state (for cross-instance loading)
     */
    async getFullGameData(gameId) {
        try {
            const gameKey = this.GAME_KEY_PREFIX + gameId;
            const data = await kv.get(gameKey);

            if (!data) {
                return null;
            }

            const gameData = typeof data === 'string' ? JSON.parse(data) : data;

            // Return both metadata and gameState
            return gameData;
        } catch (error) {
            console.error('Error getting full game data from Redis:', error);
            return null;
        }
    }

    /**
     * Health check - verify Redis connection
     */
    async healthCheck() {
        try {
            await kv.set('health:check', 'ok', { ex: 10 });
            const result = await kv.get('health:check');
            return result === 'ok';
        } catch (error) {
            console.error('Redis health check failed:', error);
            return false;
        }
    }
}
