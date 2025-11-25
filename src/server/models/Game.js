import { v4 as UUID } from "uuid";

export class Game {
  constructor(host, logger = null) {
    this.id = UUID();
    this.player_host = host;
    this.player_client = null;
    this.player_count = 1;
    this.active = false;
    this.gamecore = null;
    this.logger = logger;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
  }

  /**
   * Update the last activity timestamp
   * Called when the game receives player input or other activity
   */
  updateActivity() {
    this.lastActivity = Date.now();
  }

  addClient(client) {
    this.player_client = client;
    this.player_count++;
    this.gamecore.players.other.instance = client;

    // Log when a player joins
    if (this.logger) {
      this.logger.info(
        `Player '${client.playername}' (${client.userid}) joined game ${this.id}`,
      );
    }

    // Start the game when second player joins
    if (this.player_count === 2) {
      this.start();
    }
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
    this.player_client.send("s.j." + this.player_host.userid);
    this.player_client.game = this;

    // Ready game
    const timeStr = String(this.gamecore.local_time).replace(".", "-");
    this.player_client.send("s.r." + timeStr);
    this.player_host.send("s.r." + timeStr);

    this.gamecore.players.self.state.cards_to_play = 1;
    this.gamecore.players.self.state.pieces_to_play = 1;

    // Make players draw cards by processing on server side
    for (let i = 0; i < 3; i++) {
      // Draw for host player
      if (
        this.gamecore.players.self.deck.length > 0 &&
        this.gamecore.players.self.hand.length < 7
      ) {
        this.gamecore.players.self.hand.push(
          this.gamecore.players.self.deck[0],
        );
        this.gamecore.players.self.deck.splice(0, 1);
      }
      // Draw for client player
      if (
        this.gamecore.players.other.deck.length > 0 &&
        this.gamecore.players.other.hand.length < 7
      ) {
        this.gamecore.players.other.hand.push(
          this.gamecore.players.other.deck[0],
        );
        this.gamecore.players.other.deck.splice(0, 1);
      }
    }
  }

  stop() {
    this.active = false;
    this.gamecore?.stopUpdate();
  }
}
