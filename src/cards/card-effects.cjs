/**
 * Card Effect System - Effect Type Definitions
 *
 * This module defines all card effect types and their associated keywords.
 * It provides constants for effect parsing and resolution.
 */

// Effect Types
const EffectType = {
  DEAL_DAMAGE: "DEAL_DAMAGE",
  DESTROY: "DESTROY",
  DESTROY_SHIELD: "DESTROY_SHIELD",
  DRAW: "DRAW",
  FREEZE: "FREEZE",
  THAW: "THAW",
  BLOCK: "BLOCK",
  SHIELD: "SHIELD",
  DISCARD: "DISCARD",
  END_TURN: "END_TURN",
  CONDITIONAL: "CONDITIONAL",
  UNKNOWN: "UNKNOWN",
};

// Target Types
const TargetType = {
  SELF: "SELF", // Current player's pieces
  ENEMY: "ENEMY", // Enemy player's pieces
  ANY: "ANY", // Player chooses (no specific target)
  ALL: "ALL", // All pieces on board
};

// Quantity Types
const QuantityType = {
  ONE: 1,
  ALL: "ALL",
  SPECIFIC: "SPECIFIC", // A specific number
};

// Scope Types (what the effect applies to)
const ScopeType = {
  PIECES: "PIECES",
  SHIELDS: "SHIELDS",
  CARDS: "CARDS",
  SQUARES: "SQUARES",
  HAND: "HAND",
};

// Application Mode - how the effect is applied
const ApplicationMode = {
  IMMEDIATE: "IMMEDIATE", // Applied instantly (e.g., "destroy all pieces")
  STATE_FLAG: "STATE_FLAG", // Sets a player state flag requiring further action
};

// Keyword patterns for parsing
const Keywords = {
  // Action keywords
  DEAL: /^deal$|^damage$/i,
  DESTROY: /^destroy$|^remove$/i,
  DRAW: /^draw$|^draws$/i,
  FREEZE: /^freeze$/i,
  THAW: /^thaw$/i,
  BLOCK: /^block$/i,
  SHIELD: /^shield$|^shields$/i,
  DISCARD: /^discard$/i,
  END: /^end$/i,

  // Quantifiers
  ONE: /^a$|^1$/i,
  ALL: /^all$|^every$/i,

  // Targets
  SELF: /^you$|^your$|^yours$/i,
  ENEMY: /^enemy$|^opponent$/i,

  // Scope
  PIECE: /^piece$|^pieces$|^pieces,$/i,
  SHIELD_WORD: /^shield$|^shields$/i,
  HAND: /^hand$|^hands$/i,
  CARD: /^card$|^cards$/i,

  // Conditionals
  IF: /^if$/i,
  LEAST: /^least$/i,

  // Other
  TURN: /^turn$/i,
};

// Effect metadata - defines how each effect type should be applied
const EffectMetadata = {
  [EffectType.DEAL_DAMAGE]: {
    stateFlags: {
      one_any: "damagingA",
      one_self: "damagingS",
      one_enemy: "damagingE",
      many_any: "damagingA",
      many_self: "damagingS",
      many_enemy: "damagingE",
    },
    applicationMode: ApplicationMode.STATE_FLAG,
    immediateWhenAll: true, // "damage all" is immediate
  },

  [EffectType.DESTROY]: {
    stateFlags: {
      one_any: "destroyingA",
      one_self: "destroyingS",
      one_enemy: "destroyingE",
      many_any: "destroyingA",
      many_self: "destroyingS",
      many_enemy: "destroyingE",
    },
    applicationMode: ApplicationMode.STATE_FLAG,
    immediateWhenAll: true,
  },

  [EffectType.DESTROY_SHIELD]: {
    stateFlags: {
      one: "deshielding",
      many: "deshielding",
    },
    applicationMode: ApplicationMode.STATE_FLAG,
    immediateWhenAll: true,
  },

  [EffectType.DRAW]: {
    applicationMode: ApplicationMode.IMMEDIATE,
  },

  [EffectType.FREEZE]: {
    stateFlags: {
      one: "freezing",
      many: "freezing",
    },
    applicationMode: ApplicationMode.STATE_FLAG,
    immediateWhenAll: true,
  },

  [EffectType.THAW]: {
    stateFlags: {
      one: "thawing",
      many: "thawing",
    },
    applicationMode: ApplicationMode.STATE_FLAG,
    immediateWhenAll: true,
  },

  [EffectType.BLOCK]: {
    stateFlags: {
      one: "blocking",
      many: "blocking",
    },
    applicationMode: ApplicationMode.STATE_FLAG,
    immediateWhenAll: true,
  },

  [EffectType.SHIELD]: {
    stateFlags: {
      one: "shielding",
      many: "shielding",
    },
    applicationMode: ApplicationMode.STATE_FLAG,
    immediateWhenAll: true,
  },

  [EffectType.DISCARD]: {
    applicationMode: ApplicationMode.IMMEDIATE,
  },

  [EffectType.END_TURN]: {
    applicationMode: ApplicationMode.IMMEDIATE,
  },

  [EffectType.CONDITIONAL]: {
    applicationMode: ApplicationMode.IMMEDIATE,
  },
};

// Export for CommonJS (Node.js) and browser
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    EffectType,
    TargetType,
    QuantityType,
    ScopeType,
    ApplicationMode,
    Keywords,
    EffectMetadata,
  };
}
