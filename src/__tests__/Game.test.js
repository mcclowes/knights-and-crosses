import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Game } from '../server/models/Game.js';

describe('Game', () => {
  let game;
  let mockHost;
  let mockClient;
  let mockLogger;

  beforeEach(() => {
    mockHost = {
      userid: 'host-user-123',
      playername: 'HostPlayer',
      send: jest.fn(),
      game: null,
    };

    mockClient = {
      userid: 'client-user-456',
      playername: 'ClientPlayer',
      send: jest.fn(),
      game: null,
    };

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    game = new Game(mockHost, mockLogger);
  });

  describe('constructor', () => {
    it('should generate a UUID for the game', () => {
      expect(game.id).toBeDefined();
      expect(typeof game.id).toBe('string');
      expect(game.id.length).toBe(36); // UUID format
    });

    it('should set initial state correctly', () => {
      expect(game.player_host).toBe(mockHost);
      expect(game.player_client).toBeNull();
      expect(game.player_count).toBe(1);
      expect(game.active).toBe(false);
      expect(game.gamecore).toBeNull();
    });

    it('should set timestamps', () => {
      expect(game.createdAt).toBeDefined();
      expect(game.lastActivity).toBeDefined();
      expect(game.createdAt).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('updateActivity', () => {
    it('should update lastActivity timestamp', async () => {
      const originalTime = game.lastActivity;

      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10));

      game.updateActivity();

      expect(game.lastActivity).toBeGreaterThan(originalTime);
    });
  });

  describe('isHost', () => {
    it('should return true for host user ID', () => {
      expect(game.isHost('host-user-123')).toBe(true);
    });

    it('should return false for non-host user ID', () => {
      expect(game.isHost('client-user-456')).toBe(false);
      expect(game.isHost('unknown-user')).toBe(false);
    });

    it('should handle null player_host gracefully', () => {
      game.player_host = null;
      expect(game.isHost('host-user-123')).toBe(false);
    });
  });

  describe('getOtherPlayer', () => {
    beforeEach(() => {
      game.player_client = mockClient;
    });

    it('should return client when given host user ID', () => {
      expect(game.getOtherPlayer('host-user-123')).toBe(mockClient);
    });

    it('should return host when given client user ID', () => {
      expect(game.getOtherPlayer('client-user-456')).toBe(mockHost);
    });
  });

  describe('addClient', () => {
    beforeEach(() => {
      // Set up a mock gamecore
      game.gamecore = {
        players: {
          self: {
            deck: [1, 2, 3, 4, 5],
            hand: [],
            state: { cards_to_play: 0, pieces_to_play: 0 },
          },
          other: {
            deck: [6, 7, 8, 9, 10],
            hand: [],
            instance: null,
          },
        },
        local_time: 12345.678,
      };
    });

    it('should add the client player', () => {
      game.addClient(mockClient);

      expect(game.player_client).toBe(mockClient);
      expect(game.player_count).toBe(2);
    });

    it('should set gamecore other player instance', () => {
      game.addClient(mockClient);

      expect(game.gamecore.players.other.instance).toBe(mockClient);
    });

    it('should log when a player joins', () => {
      game.addClient(mockClient);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('ClientPlayer')
      );
    });

    it('should start the game when second player joins', () => {
      game.addClient(mockClient);

      expect(game.active).toBe(true);
    });
  });

  describe('removeClient', () => {
    beforeEach(() => {
      game.player_client = mockClient;
      game.player_count = 2;
    });

    it('should remove client player', () => {
      game.removeClient('client-user-456');

      expect(game.player_client).toBeNull();
      expect(game.player_count).toBe(1);
    });

    it('should remove host player', () => {
      game.removeClient('host-user-123');

      expect(game.player_host).toBeNull();
      expect(game.player_count).toBe(1);
    });
  });

  describe('start', () => {
    beforeEach(() => {
      game.player_client = mockClient;
      game.gamecore = {
        players: {
          self: {
            deck: [1, 2, 3, 4, 5],
            hand: [],
            state: { cards_to_play: 0, pieces_to_play: 0 },
          },
          other: {
            deck: [6, 7, 8, 9, 10],
            hand: [],
          },
        },
        local_time: 12345.678,
      };
    });

    it('should set game to active', () => {
      game.start();

      expect(game.active).toBe(true);
    });

    it('should send join message to client', () => {
      game.start();

      expect(mockClient.send).toHaveBeenCalledWith('s.j.host-user-123');
    });

    it('should send ready message to both players', () => {
      game.start();

      expect(mockClient.send).toHaveBeenCalledWith('s.r.12345-678');
      expect(mockHost.send).toHaveBeenCalledWith('s.r.12345-678');
    });

    it('should set client game reference', () => {
      game.start();

      expect(mockClient.game).toBe(game);
    });

    it('should draw 3 cards for each player', () => {
      game.start();

      expect(game.gamecore.players.self.hand.length).toBe(3);
      expect(game.gamecore.players.other.hand.length).toBe(3);
      expect(game.gamecore.players.self.deck.length).toBe(2);
      expect(game.gamecore.players.other.deck.length).toBe(2);
    });

    it('should set cards and pieces to play for host', () => {
      game.start();

      expect(game.gamecore.players.self.state.cards_to_play).toBe(1);
      expect(game.gamecore.players.self.state.pieces_to_play).toBe(1);
    });
  });

  describe('stop', () => {
    it('should set game to inactive', () => {
      game.active = true;
      game.stop();

      expect(game.active).toBe(false);
    });

    it('should call stopUpdate on gamecore if exists', () => {
      const mockStopUpdate = jest.fn();
      game.gamecore = { stopUpdate: mockStopUpdate };

      game.stop();

      expect(mockStopUpdate).toHaveBeenCalled();
    });

    it('should handle null gamecore gracefully', () => {
      game.gamecore = null;

      expect(() => game.stop()).not.toThrow();
    });
  });
});
