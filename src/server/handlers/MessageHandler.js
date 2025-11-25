import { validateMessage, RateLimiter } from '../validators/InputValidator.js';

// Create a shared rate limiter instance
const rateLimiter = new RateLimiter({
  maxMessages: 60, // 60 messages per second max
  windowMs: 1000,
});

// Cleanup stale rate limiter entries every 30 seconds
setInterval(() => rateLimiter.cleanup(), 30000);

export class MessageHandler {
  constructor(gameService) {
    this.gameService = gameService;
  }

  /**
   * Handle incoming WebSocket message with validation and rate limiting
   * @param {object} client - The client socket
   * @param {string} message - Raw message string
   */
  handleMessage(client, message) {
    // Rate limiting check
    const clientId = client.userid || client.id || 'unknown';
    const rateCheck = rateLimiter.check(clientId);

    if (!rateCheck.allowed) {
      console.warn(`[MessageHandler] Rate limited client ${clientId}, retry after ${rateCheck.retryAfter}s`);
      client.send?.(`s.error.rate_limited.${rateCheck.retryAfter}`);
      return;
    }

    // Input validation
    const validation = validateMessage(message);
    if (!validation.valid) {
      console.warn(`[MessageHandler] Invalid message from ${clientId}: ${validation.error}`);
      // Don't expose detailed error to client to prevent information leakage
      client.send?.('s.error.invalid_message');
      return;
    }

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
        // This shouldn't happen after validation, but handle it anyway
        console.warn(`[MessageHandler] Unknown message type after validation: ${messageType}`);
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
        console.error("[MessageHandler] Error updating game activity:", error);
      });
    } else {
      console.warn(`[MessageHandler] Client ${client.userid} sent input but has no active game`);
    }
  }

  handlePing(client, parts) {
    if (client.send) {
      client.send("s.p." + parts[1]);
    }
  }

  handleLatency(client, parts) {
    if (client.game) {
      const latency = parseFloat(parts[1]);
      // Validation already ensures this is a valid number
      client.game.fake_latency = latency;
    }
  }

  handleMMR(client, parts) {
    const game = client.game;
    if (!game) {
      console.warn(`[MessageHandler] Client ${client.userid} sent MMR but has no active game`);
      return;
    }

    const mmr = parts[1];

    if (game.isHost(client.userid)) {
      if (game.player_client) {
        game.player_client.mmr = mmr;
      }
    } else {
      if (game.player_host) {
        game.player_host.mmr = mmr;
      }
    }
  }

  handleWin(client) {
    if (client?.game?.id) {
      this.gameService.winGame(client.game.id).catch((error) => {
        console.error("[MessageHandler] Error handling win:", error);
      });
    } else {
      console.warn(`[MessageHandler] Client ${client.userid} sent win but has no active game`);
    }
  }

  /**
   * Clean up rate limiter entry for disconnected client
   * @param {object} client - The disconnecting client
   */
  handleDisconnect(client) {
    const clientId = client.userid || client.id || 'unknown';
    rateLimiter.remove(clientId);
  }
}
