export class MessageHandler {
    constructor(gameServer) {
        this.gameServer = gameServer;
    }

    handleMessage(client, message) {
        const messageParts = message.split('.');
        const messageType = messageParts[0];

        switch (messageType) {
            case 'i':
                this.handleInput(client, messageParts);
                break;
            case 'p':
                this.handlePing(client, messageParts);
                break;
            case 'r':
                this.handleLatency(client, messageParts);
                break;
            case 'm':
                this.handleMMR(client, messageParts);
                break;
            case 'w':
                this.handleWin(client);
                break;
            default:
                console.warn(`Unknown message type: ${messageType}`);
        }
    }

    handleInput(client, parts) {
        const inputCommands = parts[1].split('-');
        const inputTime = parts[2].replace('-', '.');
        const inputSeq = parts[3];

        if (client?.game?.gamecore) {
            client.game.gamecore.handleServerInput(client, inputCommands, inputTime, inputSeq);
        }
    }

    handlePing(client, parts) {
        client.send('s.p.' + parts[1]);
    }

    handleLatency(client, parts) {
        this.gameServer.fake_latency = parseFloat(parts[1]);
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
        this.gameServer.winGame(client.game.id).catch((error) => {
            console.error('Error handling win:', error);
        });
    }
} 