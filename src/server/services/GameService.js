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
        const game = new Game(player, this.logger, this.storage);
        this.games[game.id] = game;
        this.game_count++;

        game.gamecore = new game_core(game);
        game.gamecore.update(new Date().getTime());

        // Notify player they are host
        player.emit('message', 's.h.' + String(game.gamecore.local_time).replace('.', '-'));
        console.log('Server host at ' + game.gamecore.local_time);
        player.game = game;
        player.hosting = true;

        // Persist to Redis if available
        if (this.storage) {
            await this.storage.saveGame(game);
        }

        return game;
    }

    /**
     * Load game from Redis storage and reconstruct in memory
     * Used for cross-instance matchmaking
     */
    async loadGameFromStorage(gameData, newPlayer = null) {
        console.log('Loading game from storage:', gameData.id);

        try {
            // Create placeholder host player (will be replaced when they reconnect)
            const placeholderHost = {
                userid: gameData.hostId,
                playername: 'Player 1',
                send: () => {}, // No-op for placeholder
                emit: () => {}
            };

            // Create new game instance with host
            const game = new Game(placeholderHost, this.logger, this.storage);
            game.id = gameData.id; // Use existing game ID
            game.player_count = gameData.playerCount || 1;
            game.active = gameData.active || false;

            // Initialize gamecore
            game.gamecore = new game_core(game);

            // Restore game state if available
            if (gameData.gameState) {
                const state = gameData.gameState;

                // Restore turn
                if (state.turn !== undefined) {
                    game.gamecore.turn = state.turn;
                }

                // Restore board state
                if (state.board) {
                    game.gamecore.board.state = state.board;
                }

                // Restore time
                if (state.local_time !== undefined) {
                    game.gamecore.local_time = state.local_time;
                }
                if (state.server_time !== undefined) {
                    game.gamecore.server_time = state.server_time;
                }

                // Restore host player state
                if (state.player_host && game.gamecore.players.self) {
                    game.gamecore.players.self.state = state.player_host.state || game.gamecore.players.self.state;
                    game.gamecore.players.self.mmr = state.player_host.mmr || 1;

                    // Restore hand and deck
                    if (state.player_host.hand) {
                        game.gamecore.players.self.hand = state.player_host.hand.map(card =>
                            this.createCardFromData(card)
                        );
                    }
                    if (state.player_host.deck) {
                        game.gamecore.players.self.deck = state.player_host.deck.map(card =>
                            this.createCardFromData(card)
                        );
                    }
                }

                // Restore client player state if exists
                if (state.player_client && game.gamecore.players.other) {
                    game.gamecore.players.other.state = state.player_client.state || game.gamecore.players.other.state;
                    game.gamecore.players.other.mmr = state.player_client.mmr || 1;

                    // Restore hand and deck
                    if (state.player_client.hand) {
                        game.gamecore.players.other.hand = state.player_client.hand.map(card =>
                            this.createCardFromData(card)
                        );
                    }
                    if (state.player_client.deck) {
                        game.gamecore.players.other.deck = state.player_client.deck.map(card =>
                            this.createCardFromData(card)
                        );
                    }
                }
            }

            // Add to local games cache
            this.games[game.id] = game;
            this.game_count++;

            console.log(`Game ${game.id} loaded from storage with ${game.player_count} players`);

            // If a new player is joining, add them now
            if (newPlayer && game.player_count < 2) {
                game.addClient(newPlayer);
                if (this.storage) {
                    await this.storage.saveGame(game);
                }
            }

            return game;
        } catch (error) {
            console.error('Error loading game from storage:', error);
            return null;
        }
    }

    /**
     * Helper to create card objects from serialized data
     */
    createCardFromData(cardData) {
        // Simple card reconstruction - matches GameCard structure
        return {
            cardName: cardData.cardName,
            cardImage: '',
            pos: { x: 0, y: 0 },
            size: { x: 140, y: 210, hx: 70, hy: 105 }
        };
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
        if (this.storage) {
            const availableGameMetadata = await this.storage.findAvailableGame();
            if (availableGameMetadata) {
                console.log('Found available game in Redis:', availableGameMetadata.id);
                console.log('Loading game from storage to this instance...');

                // Load full game data from Redis
                const fullGameData = await this.storage.getFullGameData(availableGameMetadata.id);

                if (fullGameData) {
                    // Reconstruct game in this instance's memory and add the new player
                    const game = await this.loadGameFromStorage(fullGameData, player);

                    if (game) {
                        console.log(`Successfully loaded game ${game.id} and added player`);
                        return game;
                    } else {
                        console.log('Failed to load game from storage, creating new game');
                    }
                } else {
                    console.log('Game metadata exists but full data not found, creating new game');
                }
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
                otherPlayer.emit('message', 's.e');
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
            game.player_client.emit('message', 's.e');
            await this.findGame(game.player_client);
        }
        if (game.player_host) {
            game.player_host.emit('message', 's.e');
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