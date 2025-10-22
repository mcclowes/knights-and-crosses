/**
 * Card Effect System - Effect Parser
 *
 * This module parses effect strings into structured effect objects.
 * Example: "Deal 2 damage to enemy pieces" -> { type: 'DEAL_DAMAGE', quantity: 2, target: 'ENEMY', ... }
 */

const {
  EffectType,
  TargetType,
  QuantityType,
  ScopeType,
  Keywords,
} = require("./card-effects.cjs");

/**
 * Parse a single effect string into a structured effect object
 * @param {string} effectString - The effect string to parse (e.g., "Deal 2 damage to enemy pieces")
 * @returns {Object} Parsed effect object
 */
function parseEffect(effectString) {
  if (!effectString || typeof effectString !== "string") {
    return { type: EffectType.UNKNOWN, raw: effectString };
  }

  const tokens = effectString.trim().split(/\s+/);
  const effect = {
    type: EffectType.UNKNOWN,
    quantity: QuantityType.ONE,
    target: TargetType.ANY,
    scope: ScopeType.PIECES,
    raw: effectString,
  };

  if (tokens.length === 0) {
    return effect;
  }

  // Parse the main action (first token)
  const action = tokens[0];

  // END TURN
  if (action.match(Keywords.END)) {
    effect.type = EffectType.END_TURN;
    return effect;
  }

  // CONDITIONAL (IF)
  if (action.match(Keywords.IF)) {
    return parseConditionalEffect(tokens, effect);
  }

  // DEAL/DAMAGE
  if (action.match(Keywords.DEAL)) {
    effect.type = EffectType.DEAL_DAMAGE;
    parseQuantityAndTarget(tokens, effect, 1);
    return effect;
  }

  // DESTROY/REMOVE
  if (action.match(Keywords.DESTROY)) {
    // Check if it's specifically destroying shields
    if (tokens[2] && tokens[2].match(Keywords.SHIELD_WORD)) {
      effect.type = EffectType.DESTROY_SHIELD;
      effect.scope = ScopeType.SHIELDS;
    } else {
      effect.type = EffectType.DESTROY;
      effect.scope = ScopeType.PIECES;
    }
    parseQuantityAndTarget(tokens, effect, 1);
    return effect;
  }

  // DRAW
  if (action.match(Keywords.DRAW)) {
    effect.type = EffectType.DRAW;
    effect.scope = ScopeType.CARDS;
    parseQuantity(tokens, effect, 1);
    // Check for "your enemy draws" pattern
    if (
      tokens[1] &&
      tokens[1].match(Keywords.SELF) &&
      tokens[2] &&
      tokens[2].match(Keywords.ENEMY)
    ) {
      effect.target = TargetType.ENEMY;
    } else {
      effect.target = TargetType.SELF;
    }
    return effect;
  }

  // FREEZE
  if (action.match(Keywords.FREEZE)) {
    effect.type = EffectType.FREEZE;
    effect.scope = ScopeType.SQUARES;
    parseQuantity(tokens, effect, 1);
    return effect;
  }

  // THAW
  if (action.match(Keywords.THAW)) {
    effect.type = EffectType.THAW;
    effect.scope = ScopeType.SQUARES;
    parseQuantity(tokens, effect, 1);
    return effect;
  }

  // BLOCK
  if (action.match(Keywords.BLOCK)) {
    effect.type = EffectType.BLOCK;
    effect.scope = ScopeType.SQUARES;
    parseQuantity(tokens, effect, 1);
    return effect;
  }

  // SHIELD
  if (action.match(Keywords.SHIELD)) {
    effect.type = EffectType.SHIELD;
    effect.scope = ScopeType.SHIELDS;
    parseQuantity(tokens, effect, 1);
    return effect;
  }

  // DISCARD
  if (action.match(Keywords.DISCARD)) {
    effect.type = EffectType.DISCARD;
    effect.scope = ScopeType.CARDS;
    parseQuantity(tokens, effect, 1);
    return effect;
  }

  // If no match, check if starting with "you/your"
  if (action.match(Keywords.SELF)) {
    // "Your enemy draws X cards"
    if (
      tokens[1] &&
      tokens[1].match(Keywords.ENEMY) &&
      tokens[2] &&
      tokens[2].match(Keywords.DRAW)
    ) {
      effect.type = EffectType.DRAW;
      effect.target = TargetType.ENEMY;
      effect.scope = ScopeType.CARDS;
      parseQuantity(tokens, effect, 3);
      return effect;
    }
  }

  return effect;
}

/**
 * Parse quantity from tokens (handles "a", "1", "all", or specific numbers)
 * @param {Array<string>} tokens - The effect tokens
 * @param {Object} effect - The effect object to modify
 * @param {number} startIndex - Index to start parsing from
 */
function parseQuantity(tokens, effect, startIndex) {
  if (!tokens[startIndex]) {
    effect.quantity = QuantityType.ONE;
    return;
  }

  const quantityToken = tokens[startIndex];

  if (quantityToken.match(Keywords.ONE)) {
    effect.quantity = QuantityType.ONE;
  } else if (quantityToken.match(Keywords.ALL)) {
    effect.quantity = QuantityType.ALL;
  } else {
    const num = parseInt(quantityToken, 10);
    if (!isNaN(num)) {
      effect.quantity = num;
      effect.quantityType = QuantityType.SPECIFIC;
    } else {
      effect.quantity = QuantityType.ONE;
    }
  }
}

/**
 * Parse quantity and target from tokens
 * @param {Array<string>} tokens - The effect tokens
 * @param {Object} effect - The effect object to modify
 * @param {number} startIndex - Index to start parsing from
 */
function parseQuantityAndTarget(tokens, effect, startIndex) {
  parseQuantity(tokens, effect, startIndex);

  // Look for target in the remaining tokens
  // Typical patterns: "to your pieces", "to enemy pieces", "damage"
  for (let i = startIndex; i < tokens.length; i++) {
    if (tokens[i].match(Keywords.SELF)) {
      effect.target = TargetType.SELF;
      break;
    } else if (tokens[i].match(Keywords.ENEMY)) {
      effect.target = TargetType.ENEMY;
      break;
    }
  }
}

/**
 * Parse conditional effects (e.g., "If you have the least pieces, return to hand")
 * @param {Array<string>} tokens - The effect tokens
 * @param {Object} effect - The effect object to modify
 * @returns {Object} The parsed conditional effect
 */
function parseConditionalEffect(tokens, effect) {
  effect.type = EffectType.CONDITIONAL;
  effect.condition = {
    type: "UNKNOWN",
    comparison: "LEAST",
    metric: "PIECES",
  };

  // Pattern: "If you have the least pieces..."
  if (tokens[1] && tokens[1].match(Keywords.SELF)) {
    effect.condition.type = "SELF";

    // Look for "least"
    for (let i = 2; i < tokens.length; i++) {
      if (tokens[i].match(Keywords.LEAST)) {
        effect.condition.comparison = "LEAST";

        // Check what metric (pieces or shields)
        if (tokens[i + 1] && tokens[i + 1].match(Keywords.PIECE)) {
          effect.condition.metric = "PIECES";
        } else if (tokens[i + 1] && tokens[i + 1].match(Keywords.SHIELD_WORD)) {
          effect.condition.metric = "SHIELDS";
        }
        break;
      }
    }
  }

  return effect;
}

/**
 * Parse all effect strings for a card
 * @param {Array<string>} effectStrings - Array of effect strings from card definition
 * @returns {Array<Object>} Array of parsed effect objects
 */
function parseCardEffects(effectStrings) {
  if (!Array.isArray(effectStrings)) {
    return [];
  }

  return effectStrings.map((effectString) => parseEffect(effectString));
}

// Export for CommonJS (Node.js) and browser
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    parseEffect,
    parseCardEffects,
  };
}
