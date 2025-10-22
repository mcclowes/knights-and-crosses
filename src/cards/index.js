/**
 * Card Effect System - Main Entry Point
 *
 * This module provides a centralized card effect system that:
 * - Parses card effect strings into structured data
 * - Applies effects to game state consistently
 * - Reduces code duplication across server and AI
 *
 * Usage:
 * ```js
 * const { resolveCard } = require('./cards');
 * resolveCard(cardName, player, enemy, board, cards);
 * ```
 */

const { resolveCard, applyEffect } = require('./card-resolver');
const { parseEffect, parseCardEffects } = require('./card-parser');
const {
  EffectType,
  TargetType,
  QuantityType,
  ScopeType,
  ApplicationMode,
  Keywords,
  EffectMetadata
} = require('./card-effects');

module.exports = {
  // Main resolver
  resolveCard,
  applyEffect,

  // Parser
  parseEffect,
  parseCardEffects,

  // Types and constants
  EffectType,
  TargetType,
  QuantityType,
  ScopeType,
  ApplicationMode,
  Keywords,
  EffectMetadata
};
