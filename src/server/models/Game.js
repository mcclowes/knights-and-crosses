import { v4 as UUID } from 'uuid';

export class Game {
    constructor(host) {
        this.id = UUID();
        this.player_host = host;
        this.player_client = null;
        this.player_count = 1;
        this.active = false;
        this.gamecore = null;
    }

    addClient(client) {
        this.player_client = client;
        this.player_count++;
        this.gamecore.players.other.instance = client;
    }

    removeClient(userId) {
        if (userId === this.player_host.userid) {
            this.player_host = null;
        } else {
            this.player_client = null;
        }
        this.player_count--;
    }

    isHost(userId) {
        return this.player_host?.userid === userId;
    }

    getOtherPlayer(userId) {
        return this.isHost(userId) ? this.player_client : this.player_host;
    }

    start() {
        this.active = true;
        this.player_client.send('s.j.' + this.player_host.userid);
        this.player_client.game = this;

        // Ready game
        const timeStr = String(this.gamecore.local_time).replace('.', '-');
        this.player_client.send('s.r.' + timeStr);
        this.player_host.send('s.r.' + timeStr);
        
        this.gamecore.players.self.state.cards_to_play = 1;
        this.gamecore.players.self.state.pieces_to_play = 1;
    }

    stop() {
        this.active = false;
        this.gamecore?.stopUpdate();
    }
} 