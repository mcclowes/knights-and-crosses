import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { MessageHandler } from '../server/handlers/MessageHandler.js';

// Generate unique IDs to avoid rate limiter collisions between tests
let testCounter = 0;
function getUniqueId() {
  return `test-user-${Date.now()}-${testCounter++}`;
}

describe('MessageHandler', () => {
  let messageHandler;
  let mockGameService;
  let mockClient;

  beforeEach(() => {
    mockGameService = {
      updateGameActivity: jest.fn().mockResolvedValue(undefined),
      winGame: jest.fn().mockResolvedValue(undefined),
    };

    // Use unique IDs to avoid rate limiter state from previous tests
    const uniqueId = getUniqueId();
    mockClient = {
      userid: uniqueId,
      id: `socket-${uniqueId}`,
      send: jest.fn(),
      game: null,
    };

    messageHandler = new MessageHandler(mockGameService);
  });

  describe('handleMessage', () => {
    it('should reject invalid messages and send error', () => {
      messageHandler.handleMessage(mockClient, '');

      expect(mockClient.send).toHaveBeenCalledWith('s.error.invalid_message');
    });

    it('should reject unknown message types', () => {
      messageHandler.handleMessage(mockClient, 'x.data');

      expect(mockClient.send).toHaveBeenCalledWith('s.error.invalid_message');
    });

    it('should handle ping messages', () => {
      messageHandler.handleMessage(mockClient, 'p.1234567890');

      expect(mockClient.send).toHaveBeenCalledWith('s.p.1234567890');
    });

    it('should rate limit excessive messages', () => {
      // Use a dedicated client for this test
      const rateLimitClient = {
        userid: `rate-limit-test-${Date.now()}`,
        id: `socket-rate-limit-${Date.now()}`,
        send: jest.fn(),
        game: null,
      };

      // Send 61 messages rapidly (limit is 60/second)
      for (let i = 0; i < 61; i++) {
        messageHandler.handleMessage(rateLimitClient, 'p.123');
      }

      // Last call should have been rate limited
      const calls = rateLimitClient.send.mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall).toMatch(/s\.error\.rate_limited/);
    });
  });

  describe('handleInput', () => {
    it('should not process input without active game', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      messageHandler.handleMessage(mockClient, 'i.3-7.123.1');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('sent input but has no active game')
      );

      consoleSpy.mockRestore();
    });

    it('should process valid input with active game', () => {
      const mockHandleServerInput = jest.fn();
      mockClient.game = {
        id: 'game-123',
        gamecore: {
          handleServerInput: mockHandleServerInput,
        },
      };

      messageHandler.handleMessage(mockClient, 'i.3-7.123.1');

      expect(mockHandleServerInput).toHaveBeenCalledWith(
        mockClient,
        ['3', '7'],
        '123',
        '1'
      );
      expect(mockGameService.updateGameActivity).toHaveBeenCalledWith('game-123');
    });
  });

  describe('handlePing', () => {
    it('should echo back the timestamp', () => {
      messageHandler.handleMessage(mockClient, 'p.9876543210');

      expect(mockClient.send).toHaveBeenCalledWith('s.p.9876543210');
    });
  });

  describe('handleLatency', () => {
    it('should set fake_latency on game', () => {
      mockClient.game = { fake_latency: 0 };

      messageHandler.handleMessage(mockClient, 'r.150');

      expect(mockClient.game.fake_latency).toBe(150);
    });

    it('should not crash without active game', () => {
      expect(() => {
        messageHandler.handleMessage(mockClient, 'r.150');
      }).not.toThrow();
    });
  });

  describe('handleMMR', () => {
    it('should set MMR on opposing player (host sending)', () => {
      mockClient.game = {
        isHost: jest.fn().mockReturnValue(true),
        player_client: { mmr: 0 },
        player_host: { mmr: 0 },
      };

      messageHandler.handleMessage(mockClient, 'm.1500');

      expect(mockClient.game.player_client.mmr).toBe('1500');
    });

    it('should set MMR on opposing player (client sending)', () => {
      mockClient.game = {
        isHost: jest.fn().mockReturnValue(false),
        player_client: { mmr: 0 },
        player_host: { mmr: 0 },
      };

      messageHandler.handleMessage(mockClient, 'm.1500');

      expect(mockClient.game.player_host.mmr).toBe('1500');
    });

    it('should not crash without active game', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      expect(() => {
        messageHandler.handleMessage(mockClient, 'm.1500');
      }).not.toThrow();

      consoleSpy.mockRestore();
    });
  });

  describe('handleWin', () => {
    it('should call winGame service', () => {
      mockClient.game = { id: 'game-123' };

      messageHandler.handleMessage(mockClient, 'w');

      expect(mockGameService.winGame).toHaveBeenCalledWith('game-123');
    });

    it('should not crash without active game', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      expect(() => {
        messageHandler.handleMessage(mockClient, 'w');
      }).not.toThrow();

      consoleSpy.mockRestore();
    });
  });

  describe('handleDisconnect', () => {
    it('should clean up rate limiter for client', () => {
      // Make some requests first
      messageHandler.handleMessage(mockClient, 'p.123');

      // Should not throw
      expect(() => {
        messageHandler.handleDisconnect(mockClient);
      }).not.toThrow();
    });
  });
});
