# Knights and Crosses - Architecture Documentation

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Directory Structure](#directory-structure)
4. [Core Components](#core-components)
5. [Game Flow](#game-flow)
6. [Data Models](#data-models)
7. [Communication Protocol](#communication-protocol)
8. [AI System](#ai-system)
9. [Card System](#card-system)
10. [Technology Stack](#technology-stack)
11. [Deployment](#deployment)

---

## Overview

**Knights and Crosses** is a networked competitive multiplayer TCG (Trading Card Game) that combines a 4x4 Tic-Tac-Toe mechanic with card-based gameplay. Two players compete by playing cards that affect the board state and placing pieces to achieve four in a row.

### Key Features

- **Real-time multiplayer** using Socket.IO
- **Genetic Algorithm-based AI** for game balancing research
- **Canvas-based rendering** for game visualization
- **Serverless deployment** support with Vercel KV (Redis)
- **Automated matchmaking** for players and AI instances

### Game Mechanics

- **Players**: 2 (Host and Client)
- **Board**: 4x4 grid
- **Win Condition**: First to place 4 pieces in a row/column/diagonal
- **Deck**: 20 cards per player
- **Hand Limit**: 7 cards
- **Turn Structure**: Draw 1 card → Play 1 card (optional) → Place 1 piece

---

## System Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        Browser[Web Browser]
        Canvas[Canvas Renderer<br/>game.core.client.js]
        React[React Component<br/>Game.tsx]
    end

    subgraph "Communication Layer"
        SocketIO[Socket.IO<br/>Real-time WebSocket]
    end

    subgraph "Server Layer"
        NextJS[Next.js Server]
        Express[Express Server]
        GameServer[GameServer<br/>Connection Manager]
        MessageHandler[MessageHandler<br/>Message Router]
    end

    subgraph "Business Logic Layer"
        GameService[GameService<br/>Game Lifecycle]
        GameCore[GameCore<br/>Game Logic Engine]
        CardResolver[CardResolver<br/>Card Effects]
    end

    subgraph "Data Layer"
        Memory[In-Memory Storage<br/>Game State]
        Redis[Vercel KV Redis<br/>Metadata Persistence]
        JSON[JSON Files<br/>Cards, AI Data]
    end

    subgraph "AI System"
        AIManager[AI Manager]
        AICore[AI Core<br/>Decision Engine]
        GeneticAlgo[Genetic Algorithm]
    end

    Browser --> React
    React --> Canvas
    Canvas <--> SocketIO
    SocketIO <--> GameServer
    GameServer --> MessageHandler
    GameServer --> GameService
    MessageHandler --> GameCore
    GameService --> GameCore
    GameCore --> CardResolver
    GameService --> Memory
    GameService -.-> Redis
    CardResolver --> JSON
    AIManager --> AICore
    AICore <--> SocketIO
    AICore --> GeneticAlgo
    AICore --> JSON

    style Browser fill:#e1f5ff
    style Redis fill:#ffe1e1
    style AICore fill:#ffe1ff
```

### Component Interaction Flow

```mermaid
sequenceDiagram
    participant Client as Browser Client
    participant Socket as Socket.IO
    participant Server as GameServer
    participant Service as GameService
    participant Core as GameCore
    participant Cards as CardResolver

    Client->>Socket: Connect
    Socket->>Server: New connection
    Server->>Service: findGame(player)

    alt No available game
        Service->>Service: createGame(player)
    end

    Service-->>Server: Game found/created
    Server-->>Socket: onconnected event
    Socket-->>Client: Connected with ID

    Note over Client,Core: Second player joins

    Client->>Socket: Input message (i)
    Socket->>Server: Forward message
    Server->>Core: handleServerInput(commands)
    Core->>Cards: resolveCard(card, player)
    Cards-->>Core: Effects applied
    Core->>Core: Update board state
    Core->>Core: Check win condition
    Core-->>Socket: Broadcast state update
    Socket-->>Client: Update UI
```

---

## Directory Structure

```
knights-and-crosses/
├── pages/                       # Next.js pages (routes)
│   ├── index.tsx               # Main game page
│   ├── _app.tsx                # React app wrapper
│   ├── _document.tsx           # HTML document wrapper
│   ├── api/
│   │   └── socket.ts           # Socket.IO API route
│   ├── ai-viewer.tsx           # AI visualization tool
│   └── deck-builder.tsx        # Deck building tool
│
├── components/                  # React components
│   └── Game.tsx                # Main game component
│
├── src/                        # Core game logic
│   ├── game.server.js          # GameServer (connection management)
│   ├── game.core.server.js     # Server-side game engine (606 lines)
│   ├── game.core.client.js     # Client-side canvas renderer
│   ├── game.core.ai.js         # AI game engine
│   ├── ai_manager.js           # AI instance manager
│   │
│   ├── ai/                     # AI system (TypeScript)
│   │   ├── core/
│   │   │   └── GameCore.ts     # AI decision engine
│   │   ├── board/
│   │   │   └── GameBoard.ts    # Board state management
│   │   ├── player/
│   │   │   └── GamePlayer.ts   # Player state
│   │   ├── config/
│   │   │   └── constants.ts    # AI parameters
│   │   └── utils/
│   │       └── helpers.ts      # Utility functions
│   │
│   ├── cards/                  # Card effect system
│   │   ├── card-resolver.cjs   # Effect application
│   │   ├── card-parser.cjs     # Effect parsing
│   │   ├── card-effects.cjs    # Effect type definitions
│   │   └── index.cjs           # Module exports
│   │
│   ├── server/                 # Server infrastructure
│   │   ├── models/
│   │   │   └── Game.js         # Game entity model
│   │   ├── services/
│   │   │   └── GameService.js  # Game lifecycle manager
│   │   ├── handlers/
│   │   │   └── MessageHandler.js # Socket message router
│   │   ├── storage/
│   │   │   └── RedisGameStorage.js # Vercel KV integration
│   │   └── utils/
│   │       └── logger.js       # Winston logger
│   │
│   └── json/                   # Data files
│       ├── cards.json          # Card definitions (14 cards)
│       ├── card_data.json      # Card balance statistics
│       ├── ai.json             # AI evolution history (150+ generations)
│       └── deck_p1.json        # Default deck
│
├── public/                     # Static assets
│   ├── assets/
│   │   ├── css/
│   │   └── sound/
│   ├── json/                   # Public JSON files (copied from src)
│   └── game.core.client.js     # Client engine (copied from src)
│
├── server.js                   # Main server bootstrap
├── package.json                # Dependencies and scripts
├── tsconfig.json               # TypeScript config
└── next.config.js              # Next.js config
```

---

## Core Components

### Class Hierarchy

```mermaid
classDiagram
    class GameServer {
        -http.Server httpServer
        -SocketIO io
        -GameService gameService
        +start()
        +handleConnection(socket)
        +handleDisconnect(socket)
    }

    class GameService {
        -Map~string,Game~ games
        -RedisGameStorage storage
        +findGame(player) Game
        +createGame(player) Game
        +endGame(gameId)
        +winGame(gameId, winner)
    }

    class Game {
        -string id
        -Player player_host
        -Player player_client
        -GameCore gamecore
        -boolean active
        +addClient(player)
        +start()
        +stop()
    }

    class GameCore {
        -GameBoard board
        -GamePlayer self
        -GamePlayer other
        -number turn
        +update()
        +handleServerInput(commands)
        +checkWinConditions()
        +applyEffect(effect, player)
    }

    class GameBoard {
        -number[][] results
        -number[][] frost
        -number[][] rock
        -number[][] shields
        +checkWin() number
        +reduceBoard()
        +updateBoard(pos, player)
    }

    class GamePlayer {
        -Card[] hand
        -Card[] deck
        -Card[] discard
        -boolean host
        -number cards_to_play
        -number pieces_to_play
        -number discarding
        +drawCard()
        +playCard(index)
        +discardCard(index)
    }

    class MessageHandler {
        +handleMessage(game, type, data)
        +routeInput(game, commands)
        +routePing(game, timestamp)
        +routeWin(game, winner)
    }

    class CardResolver {
        +resolveCard(card, player, gamecore)
        +applyEffect(effect, player, gamecore)
        -applyDamage(target, amount)
        -applyShield(target, amount)
        -applyFreeze(target, duration)
    }

    GameServer --> GameService
    GameService --> Game
    GameServer --> MessageHandler
    Game --> GameCore
    GameCore --> GameBoard
    GameCore --> GamePlayer
    GameCore --> CardResolver
    MessageHandler --> GameCore
```

### Component Responsibilities

| Component | File | Lines | Responsibility |
|-----------|------|-------|----------------|
| **GameServer** | `src/game.server.js` | 185+ | Socket.IO connection management, player session handling |
| **GameService** | `src/server/services/GameService.js` | 140+ | Game lifecycle, matchmaking, Redis integration |
| **Game** | `src/server/models/Game.js` | 80+ | Game entity, player tracking, start/stop logic |
| **GameCore** | `src/game.core.server.js` | 606 | Game logic, turn management, win conditions |
| **MessageHandler** | `src/server/handlers/MessageHandler.js` | 60+ | Socket message routing by type |
| **CardResolver** | `src/cards/card-resolver.cjs` | 200+ | Card effect application to game state |

---

## Game Flow

### Game Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> Connecting: Player connects
    Connecting --> Waiting: Connection established
    Waiting --> Playing: Second player joins
    Playing --> GameEnded: Win condition met
    Playing --> GameEnded: Player disconnect
    GameEnded --> Waiting: Rematch/New game
    GameEnded --> [*]: Player leaves

    state Playing {
        [*] --> DrawPhase
        DrawPhase --> CardPhase: Card drawn
        CardPhase --> PlacePhase: Card played/skipped
        PlacePhase --> CheckWin: Piece placed
        CheckWin --> NextTurn: No winner
        CheckWin --> [*]: Winner found
        NextTurn --> DrawPhase: Switch player
    }
```

### Turn Sequence Flow

```mermaid
sequenceDiagram
    participant P1 as Player 1
    participant Core as GameCore
    participant Board as GameBoard
    participant Cards as CardResolver
    participant P2 as Player 2

    Note over P1,P2: Turn Start

    Core->>P1: Draw card
    P1->>Core: Play card (or pass)

    alt Card played
        Core->>Cards: resolveCard(card)
        Cards->>Board: Apply effects
        Cards->>P1: Update state (shields, damage, etc.)
        Cards->>P2: Update state (shields, damage, etc.)
        Cards-->>Core: Effects complete
    end

    P1->>Core: Place piece at position
    Core->>Board: updateBoard(position, player1)

    Core->>Board: checkWin()
    Board-->>Core: Winner or continue

    alt Winner found
        Core->>P1: You win!
        Core->>P2: You lose!
    else No winner
        Core->>Core: Switch turn
        Note over P1,P2: Player 2's Turn
    end
```

### Matchmaking Flow

```mermaid
flowchart TD
    Start([Player Connects]) --> Find{Find Available Game?}

    Find -->|Game Found| Join[Join as Player 2]
    Find -->|No Game| Create[Create New Game as Player 1]

    Join --> Wait2[Wait for Other Player]
    Create --> Wait1[Wait for Player 2]

    Wait1 --> Check{Player 2 Joined?}
    Wait2 --> Check

    Check -->|Yes| StartGame[Start Game<br/>Both draw 3 cards]
    Check -->|No| Wait1

    StartGame --> Play[Play Game]
    Play --> End{Game Ends?}

    End -->|Win/Loss| Cleanup[Remove from game]
    End -->|Disconnect| Cleanup

    Cleanup --> Find
```

---

## Data Models

### Board State Structure

The game board consists of four separate layers, all 4x4 grids:

```mermaid
graph TB
    subgraph "Board State"
        Results["results[][]<br/>Piece Placement<br/>0 = empty<br/>1 = Player 1<br/>-1 = Player 2"]
        Frost["frost[][]<br/>Frozen Squares<br/>Duration counter"]
        Rock["rock[][]<br/>Blocked Squares<br/>Duration counter"]
        Shields["shields[][]<br/>Shield Count<br/>Per square"]
    end

    Results --> BoardState[Complete Board State]
    Frost --> BoardState
    Rock --> BoardState
    Shields --> BoardState
```

### Player State

```typescript
interface GamePlayer {
  // Core state
  host: boolean;           // Is this player the host?
  state: string;           // "connecting", "waiting", "playing"

  // Card management
  hand: Card[];           // Current hand (max 7)
  deck: Card[];           // Remaining deck
  discard: Card[];        // Discard pile

  // Action state flags (set by card effects)
  cards_to_play: number;  // Must play N more cards
  pieces_to_play: number; // Must place N more pieces
  discarding: number;     // Must discard N cards
  shielding: number;      // Must shield N pieces
  damage_to_apply: number;// Must deal N damage
  destroying: number;     // Must destroy N pieces
  drawing: number;        // Must draw N cards
  deshielding: number;    // Must remove N shields
  thawing: number;        // Must thaw N squares
  blocking: number;       // Must block N squares
  freezing: number;       // Must freeze N squares
}
```

### Card Structure

```typescript
interface Card {
  name: string;           // e.g., "Fire Blast"
  rarity: 'Basic' | 'Rare' | 'Elite';
  effects: string[];      // Effect descriptions

  // Deck constraints
  // Basic: max 3 copies
  // Rare: max 2 copies
  // Elite: max 1 copy, max 5 elite cards per deck
}
```

### Game Entity Model

```typescript
interface Game {
  id: string;                    // Unique game ID
  player_host: Player;           // First player
  player_client: Player | null;  // Second player (null if waiting)
  player_count: number;          // 1 or 2
  active: boolean;               // Is game running?
  gamecore: GameCore;            // Game logic engine
}
```

---

## Communication Protocol

### Socket.IO Message Format

Messages use a period-delimited format:

```
TYPE.DATA1.DATA2.DATA3
```

### Client → Server Messages

| Type | Format | Description |
|------|--------|-------------|
| `i` | `i.COMMANDS.TIME.SEQUENCE` | Input (card play, piece placement) |
| `p` | `p.TIMESTAMP` | Ping for latency measurement |
| `r` | `r.LATENCY` | Latency report |
| `m` | `m.MMR` | MMR (rating) report |
| `w` | `w` | Win notification |

### Server → Client Messages

| Type | Format | Description |
|------|--------|-------------|
| `s.h` | `s.h.TIME` | Hosted (you are player 1) |
| `s.j` | `s.j.HOST_ID` | Joined (player 2 joined) |
| `s.r` | `s.r.TIME` | Ready (game starting) |
| `s.n` | `s.n.PLAYER_NAME` | Name change |
| `s.e` | `s.e` | End game |
| `s.p` | `s.p.TIMESTAMP` | Pong (ping response) |
| `onconnected` | `{id, name}` | Connection acknowledgment |

### Input Command Format

The input message (`i`) contains comma-separated commands:

```
CARD_INDEX-PIECE_POSITION,CARD_INDEX-PIECE_POSITION,...
```

Example: `i.3-7,5-12.1234567.001`
- Play card at index 3, place piece at position 7
- Play card at index 5, place piece at position 12
- Timestamp: 1234567
- Sequence: 001

---

## AI System

### AI Architecture

```mermaid
graph TB
    subgraph "AI Manager"
        Manager[AI Manager<br/>ai_manager.js]
        Spawner[Instance Spawner]
        Tracker[Performance Tracker]
    end

    subgraph "AI Instance"
        AICore[AI GameCore<br/>Decision Engine]
        Evaluator[Board Evaluator]
        Params[Genetic Parameters]
    end

    subgraph "Evolution System"
        GA[Genetic Algorithm]
        Crossover[Crossover Function]
        Mutation[Mutation 20%]
        Selection[Fitness Selection]
    end

    subgraph "Rating System"
        Elo[Elo Rating System]
        MMR[MMR Tracking]
    end

    Manager --> Spawner
    Spawner --> AICore
    AICore --> Evaluator
    Evaluator --> Params
    AICore --> Server[Game Server]

    Tracker --> Elo
    Elo --> MMR
    MMR --> GA
    GA --> Crossover
    GA --> Mutation
    GA --> Selection
    Selection --> Params

    style GA fill:#ffe1ff
    style Elo fill:#e1ffe1
```

### AI Decision Algorithm

The AI evaluates board states using a parameterized scoring function:

```typescript
function evaluateBoard(board: GameBoard, params: AIParams): number {
  let score = 0;

  // Evaluate all rows, columns, and diagonals
  for (const line of getAllLines(board)) {
    const playerPieces = countPieces(line, AI_PLAYER);
    const enemyPieces = countPieces(line, ENEMY_PLAYER);
    const shields = countShields(line);
    const frozen = countFrozen(line);
    const blocked = countBlocked(line);

    // Apply genetic parameters
    score += playerPieces * params.playerCardValue;
    score -= enemyPieces * params.enemyCardValue;
    score += shields * params.shieldMod;
    score += frozen * params.freezeMod;
    score += blocked * params.rockMod;

    // Center position bonus
    if (isCenterPosition(line)) {
      score += params.centerMod;
    }

    // Enemy proximity modifier
    if (hasEnemyAdjacent(line)) {
      score *= params.enemyMod;
    }
  }

  return score;
}
```

### Genetic Parameters

The AI uses 7 evolved parameters for decision-making:

| Parameter | Range | Purpose |
|-----------|-------|---------|
| `playerCardValue` | 0-97 | Weight of own pieces |
| `enemyCardValue` | 0-70 | Weight of opponent pieces |
| `centerMod` | 0.6-2.7 | Center square preference |
| `enemyMod` | 1.4-2.2 | Opponent position weight |
| `shieldMod` | 0.6-1.8 | Shield priority |
| `freezeMod` | 0.6 | Freeze effect priority |
| `rockMod` | 0.8 | Block priority |

### Evolution Process

```mermaid
flowchart TD
    Start([Generation N]) --> Create[Create AI Pool<br/>Population Size: 20-30]
    Create --> Play[Play Games<br/>Round Robin]
    Play --> Track[Track Performance<br/>Elo Rating System]
    Track --> Evaluate[Evaluate Fitness<br/>Based on MMR]
    Evaluate --> Select[Select Top Performers<br/>Weighted Selection]
    Select --> Crossover[Crossover<br/>Inherit parameters 1-6]
    Crossover --> Mutate{Mutation?<br/>20% chance}
    Mutate -->|Yes| Random[Random Parameters]
    Mutate -->|No| Inherit[Inherited Parameters]
    Random --> NewGen[Generation N+1]
    Inherit --> NewGen
    NewGen --> Converge{Variance Small?}
    Converge -->|No| Play
    Converge -->|Yes| End([Evolution Complete])
```

---

## Card System

### Card Effect Resolution Flow

```mermaid
flowchart TD
    Start([Player Plays Card]) --> Parse[CardParser<br/>Parse effect descriptions]
    Parse --> Resolve[CardResolver<br/>Resolve all effects]

    Resolve --> Loop{More Effects?}
    Loop -->|Yes| CheckType{Effect Type?}
    Loop -->|No| Complete[Effect Complete]

    CheckType -->|Damage| Damage[Apply Damage<br/>Reduce shields first]
    CheckType -->|Destroy| Destroy[Remove Pieces]
    CheckType -->|Shield| Shield[Add Shields]
    CheckType -->|Freeze| Freeze[Freeze Squares]
    CheckType -->|Draw| Draw[Draw Cards]
    CheckType -->|Discard| Discard[Discard Cards]
    CheckType -->|Block| Block[Block Squares]

    Damage --> UpdateState[Update Game State]
    Destroy --> UpdateState
    Shield --> UpdateState
    Freeze --> UpdateState
    Draw --> UpdateState
    Discard --> UpdateState
    Block --> UpdateState

    UpdateState --> Loop
    Complete --> CheckFlags{State Flags Set?}
    CheckFlags -->|Yes| WaitAction[Wait for Player Action]
    CheckFlags -->|No| TurnContinue[Continue Turn]
```

### Effect Types

```typescript
enum EffectType {
  DAMAGE = 'damage',              // Deal damage to pieces
  DESTROY = 'destroy',            // Remove pieces outright
  SHIELD = 'shield',              // Protect pieces
  DESHIELD = 'deshield',          // Remove shields
  FREEZE = 'freeze',              // Block square usage
  THAW = 'thaw',                  // Unfreeze squares
  BLOCK = 'block',                // Place blocking rock
  DRAW = 'draw',                  // Draw cards
  DISCARD = 'discard',            // Discard cards
  RETURN_TO_HAND = 'return',      // Return card to hand
  END_TURN = 'end_turn'           // End turn immediately
}

enum TargetType {
  SELF = 'self',                  // Own pieces
  OPPONENT = 'opponent',          // Enemy pieces
  SQUARE = 'square',              // Specific square
  ALL = 'all',                    // All pieces
  CONDITIONAL = 'conditional'     // Conditional targeting
}
```

### Card Examples

**Fire Blast** (Basic)
```json
{
  "name": "Fire Blast",
  "rarity": "Basic",
  "effects": ["Deal 1 damage"]
}
```

**Floods** (Rare)
```json
{
  "name": "Floods",
  "rarity": "Rare",
  "effects": ["Destroy all pieces", "End your turn"]
}
```

**Armour Up** (Basic)
```json
{
  "name": "Armour Up",
  "rarity": "Basic",
  "effects": ["Shield a piece", "Draw a card"]
}
```

---

## Technology Stack

### Frontend Stack

```mermaid
graph LR
    Browser[Browser] --> React[React 19]
    React --> NextJS[Next.js 15]
    NextJS --> TypeScript[TypeScript]
    React --> Canvas[Canvas API<br/>2D Rendering]
    Browser --> jQuery[jQuery<br/>Legacy Support]
    Browser --> SocketIOClient[Socket.IO Client 4.8]

    style React fill:#61dafb
    style NextJS fill:#000000,color:#fff
    style TypeScript fill:#3178c6
```

### Backend Stack

```mermaid
graph LR
    Node[Node.js] --> Express[Express 4.18]
    Express --> SocketIO[Socket.IO 4.7]
    Node --> NextJS[Next.js 15]
    Express --> Winston[Winston<br/>Logging]
    NextJS --> Redis[Vercel KV<br/>Redis]

    style Node fill:#68a063
    style Express fill:#000000,color:#fff
    style SocketIO fill:#010101,color:#fff
```

### Technology Matrix

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| **Framework** | Next.js | 15.5.6 | Full-stack React framework, SSR |
| **Frontend** | React | 19.2.0 | UI component library |
| **Language** | TypeScript | 5.3.3 | Type-safe JavaScript |
| **Backend** | Express | 4.18.2 | HTTP server, routing |
| **Real-time** | Socket.IO | 4.7.4 | WebSocket communication |
| **Database** | Vercel KV | 3.0.0 | Redis for serverless |
| **Rendering** | Canvas API | Native | Game visualization |
| **Logging** | Winston | 3.11.0 | Structured logging |
| **Testing** | Jest | 29.7.0 | Unit testing |
| **Linting** | ESLint | 8.56.0 | Code quality |
| **Formatting** | Prettier | 3.6.2 | Code formatting |

---

## Deployment

### Deployment Modes

```mermaid
graph TB
    subgraph "Local Development"
        LocalNode[Node.js Server<br/>Port 3000]
        LocalMem[In-Memory<br/>Game Storage]
        LocalNode --> LocalMem
    end

    subgraph "Production Server"
        ProdNode[Node.js Server<br/>Configurable Port]
        ProdMem[In-Memory<br/>Game Storage]
        ProdNode --> ProdMem
    end

    subgraph "Vercel Serverless"
        VercelFunc[Serverless Functions]
        VercelMem[In-Memory Cache]
        VercelKV[Vercel KV Redis<br/>Metadata Storage]
        VercelFunc --> VercelMem
        VercelFunc --> VercelKV
    end

    Dev[Developer] --> LocalNode
    Users[Users] --> ProdNode
    Internet[Internet] --> VercelFunc

    style LocalNode fill:#e1f5ff
    style ProdNode fill:#e1ffe1
    style VercelFunc fill:#ffe1e1
```

### Build and Run Scripts

```bash
# Development
npm run dev           # Copy assets + start dev server

# Production Build
npm run build         # Copy assets + build Next.js

# Production Run
npm start             # Start production server

# AI Training
npm run create-ai     # Spawn AI instances for training

# Testing
npm test              # Run Jest tests

# Code Quality
npm run lint          # Run ESLint
npm run format        # Run Prettier
```

### Environment Configuration

```bash
# Optional: Vercel KV (Redis) for serverless deployment
KV_REST_API_URL=https://your-kv.vercel.com
KV_REST_API_TOKEN=your-token
KV_URL=redis://...

# Server Configuration
PORT=3000                    # Server port (default: 3000)
NODE_ENV=production          # Environment mode
```

### Redis Integration

The game uses a hybrid storage approach:

1. **In-Memory (Fast)**: All game state is kept in memory for performance
2. **Redis (Persistence)**: Game metadata is persisted to Redis for:
   - Cross-instance game discovery (serverless environments)
   - Recovery from instance restarts
   - Automatic cleanup with 1-hour TTL

```typescript
// Storage strategy
class GameService {
  private games: Map<string, Game> = new Map(); // In-memory
  private storage?: RedisGameStorage;           // Optional Redis

  async createGame(player: Player): Promise<Game> {
    const game = new Game(player);

    // Always store in memory (fast)
    this.games.set(game.id, game);

    // Optionally persist metadata to Redis (serverless)
    if (this.storage) {
      await this.storage.saveGame({
        id: game.id,
        player_host: player.id,
        player_count: 1
      });
    }

    return game;
  }
}
```

---

## Key Implementation Files

### Critical Files Reference

| File | LOC | Description | Key Classes/Functions |
|------|-----|-------------|----------------------|
| `src/game.core.server.js` | 606 | Server game engine | GameCore, GameBoard, GamePlayer |
| `src/game.server.js` | 185+ | Connection manager | GameServer |
| `src/server/services/GameService.js` | 140+ | Game lifecycle | GameService.findGame(), createGame() |
| `src/game.core.client.js` | 500+ | Client renderer | Canvas rendering, input handling |
| `src/cards/card-resolver.cjs` | 200+ | Card effects | resolveCard(), applyEffect() |
| `src/ai/core/GameCore.ts` | 300+ | AI decision engine | evaluateBoard(), getMoves() |
| `components/Game.tsx` | 150+ | React component | Game component, library loading |

---

## Future Architecture Considerations

### Potential Improvements

1. **State Management**
   - Consider Redux/Zustand for client state management
   - Migrate from Canvas to React components for better maintainability

2. **Performance**
   - Implement delta compression for network messages
   - Add client-side prediction for reduced latency

3. **Scalability**
   - Implement Redis pub/sub for multi-server coordination
   - Add game session migration for server restarts

4. **Code Organization**
   - Migrate all JavaScript to TypeScript
   - Separate client/server code into distinct packages
   - Create shared types package for client/server

5. **Testing**
   - Add integration tests for game flow
   - Implement E2E tests with Playwright
   - Add AI unit tests with known scenarios

---

## Glossary

| Term | Definition |
|------|------------|
| **TCG** | Trading Card Game - a card-based strategy game |
| **Elo Rating** | Chess rating system adapted for AI performance tracking |
| **MMR** | Matchmaking Rating - player/AI skill level |
| **Genetic Algorithm** | Evolutionary optimization technique for AI parameters |
| **Serverless** | Cloud execution model where server management is abstracted |
| **Socket.IO** | Real-time bidirectional event-based communication library |
| **SSR** | Server-Side Rendering - rendering React on the server |

---

## Documentation Maintenance

This documentation should be updated when:

- New features are added to the game
- Architecture changes are made (new components, refactoring)
- Technology stack is updated (version bumps, new libraries)
- Game mechanics are modified (rules, cards, win conditions)
- Deployment strategy changes

See `.claude/instructions.md` for guidelines on keeping this documentation current.

---

**Last Updated**: 2025-10-22
**Version**: 1.2.0
**Maintained By**: Development Team
