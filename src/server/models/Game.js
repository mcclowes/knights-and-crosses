import { v4 as UUID } from 'uuid';

/**
 * Game model class
 *
 * Key Features:
 * - Full state persistence to KV storage (Redis)
 * - Automatic state sync on significant events (throttled to 1s intervals)
 * - Message acknowledgment system for critical events
 *
 * Message Acknowledgment:
 * The sendCriticalMessage() method provides retry logic for important messages.
 * To use acknowledgments, the client must respond to Socket.IO events with callbacks.
 *
 * Example client-side acknowledgment:
 *   socket.on('message', (data, ackCallback) => {
 *     // Process message
 *     if (ackCallback) ackCallback(); // Acknowledge receipt
 *   });
 */
export class Game {
    constructor(host, logger = null, storage = null) {
        this.id = UUID();
        this.player_host = host;
        this.player_client = null;
        this.player_count = 1;
        this.active = false;
        this.gamecore = null;
        this.logger = logger;
        this.storage = storage; // Reference to storage for state sync
        this.lastSyncTime = 0; // Track last sync to avoid over-syncing
    }

    addClient(client) {
        this.player_client = client;
        this.player_count++;
        this.gamecore.players.other.instance = client;
        
        // Log when a player joins
        if (this.logger) {
            this.logger.info(`Player '${client.playername}' (${client.userid}) joined game ${this.id}`);
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

    async start() {
        this.active = true;

        // Send join message
        this.player_client.emit('message', 's.j.' + this.player_host.userid);
        this.player_client.game = this;

        // Send critical ready messages with acknowledgment
        const timeStr = String(this.gamecore.local_time).replace('.', '-');
        const readyMessage = 's.r.' + timeStr;

        // Send ready messages to both players with acknowledgment
        await Promise.all([
            this.sendCriticalMessage(this.player_client, 'message', readyMessage),
            this.sendCriticalMessage(this.player_host, 'message', readyMessage)
        ]);

        this.gamecore.players.self.state.cards_to_play = 1;
        this.gamecore.players.self.state.pieces_to_play = 1;

        // Make players draw cards by processing on server side
        for (let i = 0; i < 3; i++) {
            // Draw for host player
            if (this.gamecore.players.self.deck.length > 0 && this.gamecore.players.self.hand.length < 7) {
                this.gamecore.players.self.hand.push(this.gamecore.players.self.deck[0]);
                this.gamecore.players.self.deck.splice(0, 1);
            }
            // Draw for client player
            if (this.gamecore.players.other.deck.length > 0 && this.gamecore.players.other.hand.length < 7) {
                this.gamecore.players.other.hand.push(this.gamecore.players.other.deck[0]);
                this.gamecore.players.other.deck.splice(0, 1);
            }
        }
    }

    stop() {
        this.active = false;
        this.gamecore?.stopUpdate();
    }

    /**
     * Sync game state to storage (called on significant game events)
     * Throttled to avoid excessive writes
     */
    async syncToStorage() {
        if (!this.storage) {
            return; // No storage configured
        }

        const now = Date.now();
        const MIN_SYNC_INTERVAL = 1000; // Don't sync more than once per second

        // Throttle syncs to avoid hammering Redis
        if (now - this.lastSyncTime < MIN_SYNC_INTERVAL) {
            return;
        }

        try {
            await this.storage.saveGame(this);
            this.lastSyncTime = now;
            console.log(`Game ${this.id} state synced to storage`);
        } catch (error) {
            console.error(`Error syncing game ${this.id} to storage:`, error);
        }
    }

    /**
     * Send critical message with acknowledgment and retry
     * Uses Socket.IO's built-in acknowledgment feature
     */
    sendCriticalMessage(player, event, data, maxRetries = 3) {
        if (!player || !player.emit) {
            console.error('Cannot send message: invalid player socket');
            return Promise.resolve(false);
        }

        return new Promise((resolve) => {
            let attempts = 0;
            const ACK_TIMEOUT = 2000; // 2 second timeout per attempt

            const attemptSend = () => {
                attempts++;
                let ackReceived = false;

                // Send with acknowledgment callback
                const timeoutId = setTimeout(() => {
                    if (!ackReceived && attempts < maxRetries) {
                        console.log(`Message not acknowledged, retry ${attempts}/${maxRetries}`);
                        attemptSend();
                    } else if (!ackReceived) {
                        console.error(`Failed to get acknowledgment after ${maxRetries} attempts`);
                        resolve(false);
                    }
                }, ACK_TIMEOUT);

                // Emit with acknowledgment callback
                player.emit(event, data, () => {
                    ackReceived = true;
                    clearTimeout(timeoutId);
                    if (attempts === 1) {
                        console.log(`Message acknowledged on first attempt`);
                    } else {
                        console.log(`Message acknowledged after ${attempts} attempts`);
                    }
                    resolve(true);
                });
            };

            attemptSend();
        });
    }
} 