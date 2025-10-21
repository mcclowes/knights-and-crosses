import { Game } from '../models/Game.js';
import game_core from '../../game.core.server.js';

export class GameService {
    constructor(logger = null) {
        this.games = {};
        this.game_count = 0;
        this.logger = logger;
    }

    createGame(player) {
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

        return game;
    }

    findGame(player) {
        console.log('Looking for a game. We have: ' + this.game_count);
        console.log('Player connecting:', player.userid, player.playername);
        
        if (this.game_count === 0) {
            console.log('No games exist, creating new game');
            return this.createGame(player);
        }

        // Find an empty game
        for (const game of Object.values(this.games)) {
            if (game.player_count < 2) {
                console.log('Adding player to existing game:', game.id);
                game.addClient(player);
                return game;
            }
        }

        // No open games found, create new one
        console.log('No open games found, creating new game');
        return this.createGame(player);
    }

    endGame(gameId, userId) {
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
                this.findGame(otherPlayer);
            }
        }

        delete this.games[gameId];
        this.game_count--;
        console.log('Game removed. There are ' + this.game_count + ' games');
    }

    winGame(gameId) {
        const game = this.games[gameId];
        if (!game) {
            console.log('Game not found.');
            return;
        }

        game.stop();

        // Handle both players
        if (game.player_client) {
            game.player_client.send('s.e');
            this.findGame(game.player_client);
        }
        if (game.player_host) {
            game.player_host.send('s.e');
            game.player_host.hosting = false;
            this.findGame(game.player_host);
        }

        delete this.games[gameId];
        this.game_count--;
        console.log('Game removed. There are ' + this.game_count + ' games');
    }

} 