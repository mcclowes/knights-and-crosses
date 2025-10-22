/**
 * Card Effect System - Effect Resolver
 *
 * This module applies parsed effects to the game state.
 * It handles both immediate effects (applied instantly) and state flags (requiring player action).
 */

const {
  EffectType,
  TargetType,
  QuantityType,
  ApplicationMode,
  EffectMetadata
} = require('./card-effects');

const { parseCardEffects } = require('./card-parser');

// Constants
const MAX_HAND_SIZE = 10;
const FROST_DURATION = 4;
const ROCK_DURATION = 6;

/**
 * Main resolver function - resolves all effects of a card
 * @param {string} cardName - The name of the card being played
 * @param {Object} player - The player playing the card
 * @param {Object} enemy - The enemy player
 * @param {Object} board - The game board
 * @param {Array} cards - The cards database
 * @returns {boolean} True if card was resolved, false if discarded
 */
function resolveCard(cardName, player, enemy, board, cards) {
  // Check for discard state
  if (player.state.discarding > 0) {
    player.state.discarding--;
    return false;
  }

  // Find card effects
  const cardData = findCardByName(cardName, cards);
  if (!cardData || !cardData.effects) {
    console.warn(`Card not found: ${cardName}`);
    return false;
  }

  // Parse all effects
  const parsedEffects = parseCardEffects(cardData.effects);

  // Apply each effect
  parsedEffects.forEach(effect => {
    applyEffect(effect, player, enemy, board, cardName);
  });

  return true;
}

/**
 * Find card data by name
 * @param {string} cardName - The name of the card
 * @param {Array} cards - The cards database
 * @returns {Object|null} The card data or null
 */
function findCardByName(cardName, cards) {
  if (!Array.isArray(cards)) {
    return null;
  }

  for (let i = 0; i < cards.length; i++) {
    if (cards[i].name === cardName) {
      return cards[i];
    }
  }

  return null;
}

/**
 * Apply a single parsed effect to the game state
 * @param {Object} effect - The parsed effect object
 * @param {Object} player - The player playing the card
 * @param {Object} enemy - The enemy player
 * @param {Object} board - The game board
 * @param {string} cardName - The original card name (for conditionals)
 */
function applyEffect(effect, player, enemy, board, cardName) {
  switch (effect.type) {
    case EffectType.DEAL_DAMAGE:
      applyDamageEffect(effect, player, board);
      break;

    case EffectType.DESTROY:
      applyDestroyEffect(effect, player, board);
      break;

    case EffectType.DESTROY_SHIELD:
      applyDestroyShieldEffect(effect, player, board);
      break;

    case EffectType.DRAW:
      applyDrawEffect(effect, player, enemy);
      break;

    case EffectType.FREEZE:
      applyFreezeEffect(effect, player, board);
      break;

    case EffectType.THAW:
      applyThawEffect(effect, player, board);
      break;

    case EffectType.BLOCK:
      applyBlockEffect(effect, player, board);
      break;

    case EffectType.SHIELD:
      applyShieldEffect(effect, player, board);
      break;

    case EffectType.DISCARD:
      applyDiscardEffect(effect, player);
      break;

    case EffectType.END_TURN:
      applyEndTurnEffect(player);
      break;

    case EffectType.CONDITIONAL:
      applyConditionalEffect(effect, player, board, cardName);
      break;

    default:
      console.warn(`Unknown effect type: ${effect.type}`);
  }
}

/**
 * Apply damage effect
 */
function applyDamageEffect(effect, player, board) {
  if (effect.quantity === QuantityType.ALL) {
    // Immediate: Damage all pieces
    damageAllPieces(board);
  } else {
    // State flag: Set player state for targeting
    const quantity = effect.quantity === QuantityType.ONE ? 1 : effect.quantity;

    if (effect.target === TargetType.SELF) {
      player.state.damagingS = quantity;
    } else if (effect.target === TargetType.ENEMY) {
      player.state.damagingE = quantity;
    } else {
      player.state.damagingA = quantity;
    }
  }
}

/**
 * Apply destroy effect
 */
function applyDestroyEffect(effect, player, board) {
  if (effect.quantity === QuantityType.ALL) {
    // Immediate: Destroy all pieces
    destroyAllPieces(board);
  } else {
    // State flag: Set player state for targeting
    const quantity = effect.quantity === QuantityType.ONE ? 1 : effect.quantity;

    if (effect.target === TargetType.SELF) {
      player.state.destroyingS = quantity;
    } else if (effect.target === TargetType.ENEMY) {
      player.state.destroyingE = quantity;
    } else {
      player.state.destroyingA = quantity;
    }
  }
}

/**
 * Apply destroy shield effect
 */
function applyDestroyShieldEffect(effect, player, board) {
  if (effect.quantity === QuantityType.ALL) {
    // Immediate: Remove all shields
    removeAllShields(board);
  } else {
    // State flag: Set deshielding state
    const quantity = effect.quantity === QuantityType.ONE ? 1 : effect.quantity;
    player.state.deshielding = quantity;
  }
}

/**
 * Apply draw effect
 */
function applyDrawEffect(effect, player, enemy) {
  const targetPlayer = effect.target === TargetType.ENEMY ? enemy : player;
  const quantity = effect.quantity === QuantityType.ONE ? 1 : effect.quantity;

  for (let i = 0; i < quantity; i++) {
    drawCard(targetPlayer);
  }
}

/**
 * Apply freeze effect
 */
function applyFreezeEffect(effect, player, board) {
  if (effect.quantity === QuantityType.ALL) {
    // Immediate: Freeze all empty squares
    freezeAllSquares(board);
  } else {
    // State flag: Set freezing state
    const quantity = effect.quantity === QuantityType.ONE ? 1 : effect.quantity;
    player.state.freezing = quantity;
  }
}

/**
 * Apply thaw effect
 */
function applyThawEffect(effect, player, board) {
  if (effect.quantity === QuantityType.ALL) {
    // Immediate: Thaw all squares
    thawAllSquares(board);
  } else {
    // State flag: Set thawing state
    const quantity = effect.quantity === QuantityType.ONE ? 1 : effect.quantity;
    player.state.thawing = quantity;
  }
}

/**
 * Apply block effect
 */
function applyBlockEffect(effect, player, board) {
  if (effect.quantity === QuantityType.ALL) {
    // Immediate: Block all empty squares
    blockAllSquares(board);
  } else {
    // State flag: Set blocking state
    const quantity = effect.quantity === QuantityType.ONE ? 1 : effect.quantity;
    player.state.blocking = quantity;
  }
}

/**
 * Apply shield effect
 */
function applyShieldEffect(effect, player, board) {
  if (effect.quantity === QuantityType.ALL) {
    // Immediate: Shield all pieces
    shieldAllPieces(board);
  } else {
    // State flag: Set shielding state
    const quantity = effect.quantity === QuantityType.ONE ? 1 : effect.quantity;
    player.state.shielding = quantity;
  }
}

/**
 * Apply discard effect
 */
function applyDiscardEffect(effect, player) {
  if (effect.quantity === QuantityType.ALL) {
    // Immediate: Discard entire hand
    player.hand = [];
  } else {
    // State flag: Increment discarding counter
    const quantity = effect.quantity === QuantityType.ONE ? 1 : effect.quantity;
    player.state.discarding += quantity;
  }
}

/**
 * Apply end turn effect
 */
function applyEndTurnEffect(player) {
  player.state.cards_to_play = 0;
  player.state.pieces_to_play = 0;
}

/**
 * Apply conditional effect
 */
function applyConditionalEffect(effect, player, board, cardName) {
  if (!effect.condition) {
    return;
  }

  // Currently only supports "If you have the least X, return to hand"
  if (effect.condition.comparison === 'LEAST') {
    if (effect.condition.metric === 'PIECES') {
      const hasLeastPieces = checkHasLeastPieces(player, board);
      if (hasLeastPieces) {
        returnCardToHand(player, cardName);
      }
    } else if (effect.condition.metric === 'SHIELDS') {
      // Shield checking logic would go here
      returnCardToHand(player, cardName);
    }
  }
}

// ============================================================================
// Helper Functions - Board Manipulation
// ============================================================================

/**
 * Damage all pieces on the board (removes shields first, then pieces)
 */
function damageAllPieces(board) {
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      if (board.state.shields[row][col] === 1) {
        board.state.shields[row][col] = 0;
      } else if (board.state.results[row][col] !== 0) {
        board.state.results[row][col] = 0;
      }
    }
  }
}

/**
 * Destroy all pieces on the board
 */
function destroyAllPieces(board) {
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      board.state.results[row][col] = 0;
      board.state.shields[row][col] = 0;
    }
  }
}

/**
 * Remove all shields from the board
 */
function removeAllShields(board) {
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      board.state.shields[row][col] = 0;
    }
  }
}

/**
 * Freeze all empty squares on the board
 */
function freezeAllSquares(board) {
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      if (board.state.results[row][col] === 0 && board.state.rock[row][col] === 0) {
        board.state.frost[row][col] = FROST_DURATION;
      }
    }
  }
}

/**
 * Thaw all frozen squares on the board
 */
function thawAllSquares(board) {
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      if (board.state.frost[row][col] >= 1) {
        board.state.frost[row][col] = 0;
      }
    }
  }
}

/**
 * Block all empty squares on the board
 */
function blockAllSquares(board) {
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      if (board.state.results[row][col] === 0 && board.state.frost[row][col] === 0) {
        board.state.rock[row][col] = ROCK_DURATION;
      }
    }
  }
}

/**
 * Shield all pieces on the board
 */
function shieldAllPieces(board) {
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      if (board.state.shields[row][col] === 0) {
        board.state.shields[row][col] = 1;
      }
    }
  }
}

/**
 * Draw a card from deck to hand
 */
function drawCard(player) {
  if (player.deck.length > 0 && player.hand.length < MAX_HAND_SIZE) {
    player.hand.push(player.deck[0]);
    player.deck.splice(0, 1);
  }
}

/**
 * Check if player has the least pieces on the board
 */
function checkHasLeastPieces(player, board) {
  let pieceCounter = 0;

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      pieceCounter += board.state.results[row][col];
    }
  }

  // Positive count means player 1 has more, negative means player 2 has more
  // This needs to be adjusted based on which player is self
  // For now, return if piece counter indicates this player has less
  return (player.host === true && pieceCounter > 0) ||
         (player.host === false && pieceCounter < 0);
}

/**
 * Return card to player's hand (for conditional effects)
 */
function returnCardToHand(player, cardName) {
  if (player.hand.length < MAX_HAND_SIZE) {
    player.hand.push(cardName);
  }
}

// Export for CommonJS (Node.js) and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    resolveCard,
    applyEffect
  };
}
