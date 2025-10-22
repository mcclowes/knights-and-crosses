# Card Effect System

A modular system for parsing and resolving card effects in Knights and Crosses.

## Overview

This system replaces the 200+ line `resolve_card()` functions that were duplicated in both `game.core.server.js` and `game.core.ai.js` with a clean, maintainable architecture.

## Architecture

### Files

- **card-effects.js** - Defines effect types, targets, and keywords
- **card-parser.js** - Parses effect strings into structured objects
- **card-resolver.js** - Applies parsed effects to game state
- **index.js** - Main entry point with all exports

### Effect Flow

```
Card Effect String → Parser → Structured Effect → Resolver → Game State Update
"Deal 2 damage"    → parse  → {type: DEAL_DAMAGE, → resolve → player.state.damagingA = 2
                                 quantity: 2, ...}
```

## Usage

### Basic Usage

```javascript
const { resolveCard } = require("./cards");

// In your game code
resolveCard(cardName, player, enemy, board, cards);
```

### Advanced Usage

```javascript
const { parseEffect, applyEffect } = require("./cards");

// Parse an effect string
const effect = parseEffect("Deal 2 damage to enemy pieces");
// Returns: { type: 'DEAL_DAMAGE', quantity: 2, target: 'ENEMY', ... }

// Apply the parsed effect
applyEffect(effect, player, enemy, board, cardName);
```

## Supported Effects

### Action Effects

- **Deal/Damage** - Damage pieces (removes shields first)
- **Destroy/Remove** - Destroy pieces or shields
- **Draw** - Draw cards from deck
- **Freeze** - Add frost status to squares
- **Thaw** - Remove frost status
- **Block** - Add rock status to squares
- **Shield** - Add shields to pieces
- **Discard** - Discard cards from hand
- **End** - End player's turn

### Effect Modifiers

#### Quantifiers

- `a`, `1` - Single target
- `all`, `every` - All targets (immediate effect)
- `<number>` - Specific quantity

#### Targets

- `you`, `your` - Current player
- `enemy`, `opponent` - Enemy player
- No target specified - Player chooses (any)

### Examples

```javascript
// Basic effects
"Deal 1 damage"; // Player chooses target piece
"Draw 2 cards"; // Draw 2 cards from deck

// Targeted effects
"Deal 2 damage to enemy pieces"; // Damage 2 enemy pieces
"Destroy 1 your piece"; // Destroy 1 own piece

// Area effects
"Destroy all pieces"; // Clear the board
"Shield all pieces"; // Shield everything

// Complex effects
"End your turn"; // End turn immediately
"Freeze 3 empty squares"; // Add frost to 3 squares
```

## Application Modes

Effects are applied in two ways:

### 1. Immediate Effects

Applied instantly when the card is played:

- "Destroy all pieces"
- "Draw 2 cards"
- "End your turn"

### 2. State Flag Effects

Set a player state flag requiring further player action:

- "Deal 1 damage" → Sets `player.state.damagingA = 1`
- Player then clicks a piece to apply damage

The resolver automatically determines the correct mode based on the effect.

## Benefits

### Before (Old System)

- 200+ lines of nested if/else statements
- Duplicated code in server and AI
- Difficult to add new card effects
- Hard to test individual effects
- Regex patterns repeated everywhere

### After (New System)

- ~150 lines per module, well-organized
- Single source of truth for card logic
- Easy to extend with new effects
- Testable, modular components
- Clear separation of concerns

## Adding New Effects

To add a new card effect:

1. **Add effect type** in `card-effects.js`:

```javascript
const EffectType = {
  // ... existing types
  NEW_EFFECT: "NEW_EFFECT",
};
```

2. **Add keywords** for parsing:

```javascript
const Keywords = {
  // ... existing keywords
  NEW_KEYWORD: /^new$/i,
};
```

3. **Add parsing logic** in `card-parser.js`:

```javascript
if (action.match(Keywords.NEW_KEYWORD)) {
  effect.type = EffectType.NEW_EFFECT;
  // ... parse quantity/target
  return effect;
}
```

4. **Add resolution logic** in `card-resolver.js`:

```javascript
case EffectType.NEW_EFFECT:
  applyNewEffect(effect, player, board);
  break;
```

## Testing

The modular design makes testing easy:

```javascript
// Test parser
const effect = parseEffect("Deal 2 damage to enemy pieces");
assert(effect.type === EffectType.DEAL_DAMAGE);
assert(effect.quantity === 2);
assert(effect.target === TargetType.ENEMY);

// Test resolver with mock game state
const mockPlayer = { state: {}, hand: [], deck: [] };
const mockBoard = { state: { results: [[0,0,0,0]], ... } };
resolveCard("Fire Blast", mockPlayer, mockEnemy, mockBoard, cards);
```

## Migration Notes

The new system is a **drop-in replacement** for the old `resolve_card()` function:

```javascript
// Old
resolve_card(card, player, enemy) {
  // 200+ lines of regex and conditionals
}

// New
resolve_card(card, player, enemy) {
  resolveCardNew(card, player, enemy, this.board, cards);
}
```

All game logic remains the same - only the implementation has been refactored.
