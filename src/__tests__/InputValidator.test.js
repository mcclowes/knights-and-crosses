import { describe, it, expect, beforeEach } from '@jest/globals';
import { validateMessage, RateLimiter } from '../server/validators/InputValidator.js';

describe('InputValidator', () => {
  describe('validateMessage', () => {
    describe('basic validation', () => {
      it('should reject non-string messages', () => {
        expect(validateMessage(null).valid).toBe(false);
        expect(validateMessage(undefined).valid).toBe(false);
        expect(validateMessage(123).valid).toBe(false);
        expect(validateMessage({}).valid).toBe(false);
      });

      it('should reject empty messages', () => {
        const result = validateMessage('');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Message cannot be empty');
      });

      it('should reject messages exceeding max length', () => {
        const longMessage = 'i.' + 'a'.repeat(600);
        const result = validateMessage(longMessage);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('maximum length');
      });

      it('should reject messages with control characters', () => {
        const result = validateMessage('i.1-1\x00.123.1');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('control characters');
      });

      it('should reject unknown message types', () => {
        const result = validateMessage('x.data');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Unknown message type');
      });
    });

    describe('input messages (type: i)', () => {
      it('should accept valid input messages', () => {
        const result = validateMessage('i.3-7.1234567890.001');
        expect(result.valid).toBe(true);
      });

      it('should reject input messages with wrong number of parts', () => {
        expect(validateMessage('i.3-7').valid).toBe(false);
        expect(validateMessage('i.3-7.123').valid).toBe(false);
        expect(validateMessage('i.3-7.123.1.extra').valid).toBe(false);
      });

      it('should reject invalid card index', () => {
        const result = validateMessage('i.100-7.123.1');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('card index');
      });

      it('should reject negative card index', () => {
        const result = validateMessage('i.-1-7.123.1');
        expect(result.valid).toBe(false);
      });

      it('should reject invalid board position', () => {
        const result = validateMessage('i.3-20.123.1');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('position');
      });

      it('should accept valid board positions 0-15', () => {
        for (let i = 0; i <= 15; i++) {
          const result = validateMessage(`i.3-${i}.123.1`);
          expect(result.valid).toBe(true);
        }
      });

      it('should reject non-numeric timestamp', () => {
        const result = validateMessage('i.3-7.abc.1');
        expect(result.valid).toBe(false);
        expect(result.error.toLowerCase()).toContain('timestamp');
      });

      it('should accept timestamp with dash (decimal replacement)', () => {
        const result = validateMessage('i.3-7.123-456.1');
        expect(result.valid).toBe(true);
      });

      it('should reject invalid sequence number', () => {
        const result = validateMessage('i.3-7.123.abc');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('sequence');
      });

      it('should reject sequence number exceeding max', () => {
        const result = validateMessage('i.3-7.123.9999999');
        expect(result.valid).toBe(false);
      });
    });

    describe('ping messages (type: p)', () => {
      it('should accept valid ping messages', () => {
        const result = validateMessage('p.1234567890');
        expect(result.valid).toBe(true);
      });

      it('should reject ping messages with wrong number of parts', () => {
        expect(validateMessage('p').valid).toBe(false);
        expect(validateMessage('p.123.extra').valid).toBe(false);
      });

      it('should reject non-numeric ping timestamp', () => {
        const result = validateMessage('p.abc');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('timestamp');
      });
    });

    describe('latency messages (type: r)', () => {
      it('should accept valid latency messages', () => {
        const result = validateMessage('r.50');
        expect(result.valid).toBe(true);
      });

      it('should accept latency of 0', () => {
        const result = validateMessage('r.0');
        expect(result.valid).toBe(true);
      });

      it('should reject negative latency', () => {
        const result = validateMessage('r.-10');
        expect(result.valid).toBe(false);
      });

      it('should reject latency exceeding max', () => {
        const result = validateMessage('r.99999');
        expect(result.valid).toBe(false);
      });

      it('should reject non-numeric latency', () => {
        const result = validateMessage('r.abc');
        expect(result.valid).toBe(false);
      });
    });

    describe('MMR messages (type: m)', () => {
      it('should accept valid MMR messages', () => {
        const result = validateMessage('m.1500');
        expect(result.valid).toBe(true);
      });

      it('should accept integer MMR values', () => {
        const result = validateMessage('m.1234');
        expect(result.valid).toBe(true);
      });

      it('should reject negative MMR', () => {
        const result = validateMessage('m.-100');
        expect(result.valid).toBe(false);
      });

      it('should reject MMR exceeding max', () => {
        const result = validateMessage('m.99999');
        expect(result.valid).toBe(false);
      });
    });

    describe('win messages (type: w)', () => {
      it('should accept valid win messages', () => {
        const result = validateMessage('w');
        expect(result.valid).toBe(true);
      });

      it('should reject win messages with extra data', () => {
        const result = validateMessage('w.extra');
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('RateLimiter', () => {
    let rateLimiter;

    beforeEach(() => {
      rateLimiter = new RateLimiter({
        maxMessages: 5,
        windowMs: 1000,
      });
    });

    it('should allow messages under the limit', () => {
      for (let i = 0; i < 5; i++) {
        const result = rateLimiter.check('client1');
        expect(result.allowed).toBe(true);
      }
    });

    it('should block messages over the limit', () => {
      for (let i = 0; i < 5; i++) {
        rateLimiter.check('client1');
      }
      const result = rateLimiter.check('client1');
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeDefined();
    });

    it('should track clients independently', () => {
      for (let i = 0; i < 5; i++) {
        rateLimiter.check('client1');
      }
      const result1 = rateLimiter.check('client1');
      const result2 = rateLimiter.check('client2');

      expect(result1.allowed).toBe(false);
      expect(result2.allowed).toBe(true);
    });

    it('should reset after window expires', async () => {
      for (let i = 0; i < 5; i++) {
        rateLimiter.check('client1');
      }
      expect(rateLimiter.check('client1').allowed).toBe(false);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(rateLimiter.check('client1').allowed).toBe(true);
    });

    it('should remove client tracking on disconnect', () => {
      rateLimiter.check('client1');
      rateLimiter.remove('client1');

      // Should start fresh count
      for (let i = 0; i < 5; i++) {
        expect(rateLimiter.check('client1').allowed).toBe(true);
      }
    });

    it('should cleanup stale entries', async () => {
      rateLimiter.check('client1');

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 2100));

      rateLimiter.cleanup();

      // Client should have been removed
      expect(rateLimiter.clients.has('client1')).toBe(false);
    });
  });
});
