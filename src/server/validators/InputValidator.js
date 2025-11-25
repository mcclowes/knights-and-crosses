/**
 * Input validation for WebSocket messages
 * Prevents malformed messages from causing DoS or exploitation
 */

// Maximum message length to prevent memory exhaustion
const MAX_MESSAGE_LENGTH = 500;

// Valid message type prefixes
const VALID_MESSAGE_TYPES = new Set(['i', 'p', 'r', 'm', 'w']);

// Maximum values for game inputs
const MAX_CARD_INDEX = 20;
const MAX_BOARD_POSITION = 15; // 4x4 grid = 0-15
const MAX_SEQUENCE_NUMBER = 999999;
const MAX_TIMESTAMP_LENGTH = 20;
const MAX_MMR_VALUE = 10000;
const MAX_LATENCY_VALUE = 10000;

/**
 * Validates a raw message string
 * @param {string} message - The raw message to validate
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateMessage(message) {
  // Check type
  if (typeof message !== 'string') {
    return { valid: false, error: 'Message must be a string' };
  }

  // Check length
  if (message.length === 0) {
    return { valid: false, error: 'Message cannot be empty' };
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH}` };
  }

  // Check for null bytes or control characters (except reasonable whitespace)
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(message)) {
    return { valid: false, error: 'Message contains invalid control characters' };
  }

  // Parse message parts
  const parts = message.split('.');
  if (parts.length < 1) {
    return { valid: false, error: 'Invalid message format' };
  }

  const messageType = parts[0];

  // Validate message type
  if (!VALID_MESSAGE_TYPES.has(messageType)) {
    return { valid: false, error: `Unknown message type: ${messageType}` };
  }

  // Validate based on message type
  switch (messageType) {
    case 'i':
      return validateInputMessage(parts);
    case 'p':
      return validatePingMessage(parts);
    case 'r':
      return validateLatencyMessage(parts);
    case 'm':
      return validateMMRMessage(parts);
    case 'w':
      return validateWinMessage(parts);
    default:
      return { valid: false, error: 'Unhandled message type' };
  }
}

/**
 * Validates input message format: "i.{card}-{position}.{timestamp}.{sequence}"
 * Example: "i.3-7.1234567890.001"
 */
function validateInputMessage(parts) {
  if (parts.length !== 4) {
    return { valid: false, error: 'Input message must have 4 parts' };
  }

  const [, inputPart, timestamp, sequence] = parts;

  // Validate input part (card-position)
  if (!inputPart || typeof inputPart !== 'string') {
    return { valid: false, error: 'Missing input commands' };
  }

  const inputCommands = inputPart.split('-');
  if (inputCommands.length < 2) {
    return { valid: false, error: 'Input must contain card and position' };
  }

  // Validate card index
  const cardIndex = parseInt(inputCommands[0], 10);
  if (isNaN(cardIndex) || cardIndex < 0 || cardIndex > MAX_CARD_INDEX) {
    return { valid: false, error: `Invalid card index: must be 0-${MAX_CARD_INDEX}` };
  }

  // Validate board position
  const position = parseInt(inputCommands[1], 10);
  if (isNaN(position) || position < 0 || position > MAX_BOARD_POSITION) {
    return { valid: false, error: `Invalid position: must be 0-${MAX_BOARD_POSITION}` };
  }

  // Validate timestamp
  if (!timestamp || timestamp.length > MAX_TIMESTAMP_LENGTH) {
    return { valid: false, error: 'Invalid timestamp' };
  }

  // Timestamp should be numeric (with possible dash for decimal)
  const normalizedTimestamp = timestamp.replace('-', '.');
  if (isNaN(parseFloat(normalizedTimestamp))) {
    return { valid: false, error: 'Timestamp must be numeric' };
  }

  // Validate sequence number
  const seq = parseInt(sequence, 10);
  if (isNaN(seq) || seq < 0 || seq > MAX_SEQUENCE_NUMBER) {
    return { valid: false, error: `Invalid sequence number: must be 0-${MAX_SEQUENCE_NUMBER}` };
  }

  return { valid: true };
}

/**
 * Validates ping message format: "p.{timestamp}"
 */
function validatePingMessage(parts) {
  if (parts.length !== 2) {
    return { valid: false, error: 'Ping message must have 2 parts' };
  }

  const timestamp = parts[1];
  if (!timestamp || timestamp.length > MAX_TIMESTAMP_LENGTH) {
    return { valid: false, error: 'Invalid ping timestamp' };
  }

  // Timestamp should be numeric
  if (isNaN(parseFloat(timestamp))) {
    return { valid: false, error: 'Ping timestamp must be numeric' };
  }

  return { valid: true };
}

/**
 * Validates latency message format: "r.{latency}"
 */
function validateLatencyMessage(parts) {
  if (parts.length !== 2) {
    return { valid: false, error: 'Latency message must have 2 parts' };
  }

  const latency = parseFloat(parts[1]);
  if (isNaN(latency) || latency < 0 || latency > MAX_LATENCY_VALUE) {
    return { valid: false, error: `Invalid latency value: must be 0-${MAX_LATENCY_VALUE}` };
  }

  return { valid: true };
}

/**
 * Validates MMR message format: "m.{mmr}"
 */
function validateMMRMessage(parts) {
  if (parts.length !== 2) {
    return { valid: false, error: 'MMR message must have 2 parts' };
  }

  const mmr = parseFloat(parts[1]);
  if (isNaN(mmr) || mmr < 0 || mmr > MAX_MMR_VALUE) {
    return { valid: false, error: `Invalid MMR value: must be 0-${MAX_MMR_VALUE}` };
  }

  return { valid: true };
}

/**
 * Validates win message format: "w"
 */
function validateWinMessage(parts) {
  if (parts.length !== 1) {
    return { valid: false, error: 'Win message should have no additional data' };
  }

  return { valid: true };
}

/**
 * Rate limiter for WebSocket messages
 * Tracks message counts per client to prevent spam
 */
export class RateLimiter {
  constructor(options = {}) {
    this.maxMessages = options.maxMessages || 60; // Max messages per window
    this.windowMs = options.windowMs || 1000; // Time window in ms (1 second)
    this.clients = new Map();
  }

  /**
   * Check if a client is rate limited
   * @param {string} clientId - Unique client identifier
   * @returns {{ allowed: boolean, retryAfter?: number }}
   */
  check(clientId) {
    const now = Date.now();
    let clientData = this.clients.get(clientId);

    if (!clientData) {
      clientData = { count: 0, windowStart: now };
      this.clients.set(clientId, clientData);
    }

    // Reset window if expired
    if (now - clientData.windowStart > this.windowMs) {
      clientData.count = 0;
      clientData.windowStart = now;
    }

    clientData.count++;

    if (clientData.count > this.maxMessages) {
      const retryAfter = Math.ceil((clientData.windowStart + this.windowMs - now) / 1000);
      return { allowed: false, retryAfter };
    }

    return { allowed: true };
  }

  /**
   * Remove a client from tracking (on disconnect)
   * @param {string} clientId - Client identifier to remove
   */
  remove(clientId) {
    this.clients.delete(clientId);
  }

  /**
   * Clean up stale entries periodically
   */
  cleanup() {
    const now = Date.now();
    for (const [clientId, data] of this.clients.entries()) {
      if (now - data.windowStart > this.windowMs * 2) {
        this.clients.delete(clientId);
      }
    }
  }
}

// eslint-disable-next-line import/no-anonymous-default-export
export default {
  validateMessage,
  RateLimiter,
};
