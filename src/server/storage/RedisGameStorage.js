import { kv } from '@vercel/kv';

/**
 * Redis-backed storage for game metadata
 * Stores lightweight game info for matchmaking and recovery
 * Game logic remains in-memory for performance
 */
export class RedisGameStorage {
    constructor() {
        this.GAME_KEY_PREFIX = 'game:';
        this.GAMES_LIST_KEY = 'games:active';
        this.GAME_TTL = 3600; // 1 hour TTL for games
    }

    /**
     * Save game metadata to Redis
     */
    async saveGame(game) {
        const gameKey = this.GAME_KEY_PREFIX + game.id;
        const metadata = {
            id: game.id,
            hostId: game.player_host?.userid || null,
            clientId: game.player_client?.userid || null,
            playerCount: game.player_count,
            active: game.active,
            createdAt: Date.now()
        };

        try {
            // Save game metadata with TTL
            await kv.set(gameKey, JSON.stringify(metadata), { ex: this.GAME_TTL });

            // Add to active games list
            await kv.sadd(this.GAMES_LIST_KEY, game.id);

            console.log(`Saved game ${game.id} to Redis`);
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
     * Update game player count
     */
    async updateGamePlayerCount(gameId, playerCount) {
        try {
            const game = await this.getGame(gameId);
            if (game) {
                game.playerCount = playerCount;
                const gameKey = this.GAME_KEY_PREFIX + gameId;
                await kv.set(gameKey, JSON.stringify(game), { ex: this.GAME_TTL });
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error updating game player count:', error);
            return false;
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
