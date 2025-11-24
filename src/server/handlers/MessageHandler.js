export class MessageHandler {
  constructor(gameService) {
    this.gameService = gameService;
  }

  handleMessage(client, message) {
    const messageParts = message.split(".");
    const messageType = messageParts[0];

    switch (messageType) {
      case "i":
        this.handleInput(client, messageParts);
        break;
      case "p":
        this.handlePing(client, messageParts);
        break;
      case "r":
        this.handleLatency(client, messageParts);
        break;
      case "m":
        this.handleMMR(client, messageParts);
        break;
      case "w":
        this.handleWin(client);
        break;
      default:
        console.warn(`Unknown message type: ${messageType}`);
    }
  }

  handleInput(client, parts) {
    const inputCommands = parts[1].split("-");
    const inputTime = parts[2].replace("-", ".");
    const inputSeq = parts[3];

    if (client?.game?.gamecore) {
      client.game.gamecore.handleServerInput(
        client,
        inputCommands,
        inputTime,
        inputSeq,
      );

      // Update game activity timestamp to prevent cleanup
      this.gameService.updateGameActivity(client.game.id).catch((error) => {
        console.error("Error updating game activity:", error);
      });
    }
  }

  handlePing(client, parts) {
    client.send("s.p." + parts[1]);
  }

  handleLatency(client, parts) {
    // Note: fake_latency is typically used for testing, this may need adjustment
    // based on where fake_latency should actually be stored
    if (client.game) {
      client.game.fake_latency = parseFloat(parts[1]);
    }
  }

  handleMMR(client, parts) {
    const game = client.game;
    if (!game) return;

    if (game.isHost(client.userid)) {
      game.player_client.mmr = parts[1];
    } else {
      game.player_host.mmr = parts[1];
    }
  }

  handleWin(client) {
    if (client?.game?.id) {
      this.gameService.winGame(client.game.id).catch((error) => {
        console.error("Error handling win:", error);
      });
    }
  }
}
