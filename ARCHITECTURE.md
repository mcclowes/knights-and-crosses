# Knights and Crosses - Multiplayer Architecture

## Table of Contents

1. [Overview](#overview)
2. [Architecture Diagrams](#architecture-diagrams)
3. [System Components](#system-components)
4. [Multiplayer Infrastructure](#multiplayer-infrastructure)
5. [Game Flow](#game-flow)
6. [Technology Stack](#technology-stack)
7. [Deployment Strategy](#deployment-strategy)

---

## Overview

**Knights and Crosses** is a real-time multiplayer Trading Card Game (TCG) that combines strategic card play with a 4x4 Tic-Tac-Toe board. The architecture is designed to support:

- **Persistent WebSocket connections** for real-time gameplay
- **Matchmaking system** for pairing players
- **Game room management** for concurrent matches
- **State synchronization** between server and clients
- **Scalable serverless deployment** with Vercel KV (Redis)

### Key Features

- Real-time multiplayer with Socket.IO
- Automatic matchmaking and game lobbies
- Persistent game state with Redis
- AI opponents with genetic algorithm training
- Canvas-based game rendering
- Next.js 15 with App Router

---

## Architecture Diagrams

### High-Level System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        Browser[Web Browser]
        UI[Next.js App Router Pages]
        Canvas[Canvas Game Renderer]
        SocketClient[Socket.IO Client]
    end

    subgraph "Edge/CDN Layer"
        Vercel[Vercel Edge Network]
        Static[Static Assets CDN]
    end

    subgraph "Application Server"
        NextServer[Next.js Server<br/>Custom Server Mode]
        HTTPHandler[HTTP Request Handler]
        WSHandler[WebSocket Handler]
    end

    subgraph "Game Services"
        GameServer[GameServer<br/>Connection Manager]
        GameService[GameService<br/>Matchmaking & Lifecycle]
        MessageHandler[MessageHandler<br/>Game Logic Router]
    end

    subgraph "Game Engine"
        GameCore[GameCore<br/>Server-Side Game Logic]
        CardResolver[CardResolver<br/>Card Effects Engine]
        BoardState[BoardState Manager]
    end

    subgraph "Persistence Layer"
        MemoryCache[In-Memory Game State<br/>Active Games]
        Redis[Vercel KV Redis<br/>Game Metadata & Recovery]
        FileSystem[JSON Files<br/>Cards & AI Data]
    end

    subgraph "AI System"
        AIManager[AI Manager<br/>Bot Spawner]
        AICore[AI GameCore<br/>Decision Engine]
        Evolution[Genetic Algorithm]
    end

    Browser --> UI
    UI --> Canvas
    Browser --> SocketClient
    SocketClient <-->|WSS| WSHandler
    UI -->|HTTP/S| HTTPHandler

    Vercel --> NextServer
    Static --> Browser

    NextServer --> HTTPHandler
    NextServer --> WSHandler

    WSHandler --> GameServer
    GameServer --> GameService
    GameServer --> MessageHandler

    GameService --> GameCore
    MessageHandler --> GameCore
    GameCore --> CardResolver
    GameCore --> BoardState

    GameService --> MemoryCache
    GameService -.->|Persist| Redis
    CardResolver --> FileSystem

    AIManager --> AICore
    AICore <-->|Socket.IO| GameServer
    Evolution --> FileSystem

    style Browser fill:#e1f5ff
    style Redis fill:#ff6b6b
    style GameCore fill:#95e1d3
    style AICore fill:#f38181
```

### Multiplayer Connection Flow

```mermaid
sequenceDiagram
    participant P1 as Player 1 Browser
    participant WS1 as WebSocket
    participant Server as Game Server
    participant Service as Game Service
    participant Redis as Vercel KV
    participant Core as GameCore
    participant P2 as Player 2 Browser
    participant WS2 as WebSocket

    Note over P1,Redis: Player 1 Connects
    P1->>WS1: Connect to ws://
    WS1->>Server: connection event
    Server->>Server: Generate player ID
    Server->>Service: findGame(player1)
    Service->>Redis: Check for available games
    Redis-->>Service: No games found
    Service->>Service: createGame(player1)
    Service->>Redis: Save game metadata
    Service->>Core: Initialize GameCore
    Core-->>Service: Game ready
    Service-->>Server: Game created
    Server->>WS1: onconnected {id, name}
    Server->>WS1: s.h (you are host)
    WS1-->>P1: Waiting for opponent...

    Note over P1,Redis: Player 2 Connects
    P2->>WS2: Connect to ws://
    WS2->>Server: connection event
    Server->>Server: Generate player ID
    Server->>Service: findGame(player2)
    Service->>Redis: Check for available games
    Redis-->>Service: Game found (Player 1's game)
    Service->>Service: addClient(player2)
    Service->>Redis: Update game metadata
    Service->>Core: Add player 2 to game
    Server->>WS2: onconnected {id, name}
    Server->>WS1: s.j (player joined)
    Server->>WS2: s.r (game ready)
    Server->>WS1: s.r (game ready)
    Core->>Core: Deal initial cards
    WS1-->>P1: Game starting!
    WS2-->>P2: Game starting!

    Note over P1,P2: Gameplay Loop
    P1->>WS1: i (input: play card)
    WS1->>Server: message event
    Server->>Core: handleServerInput()
    Core->>Core: Apply card effects
    Core->>Core: Update board state
    Core->>Core: Check win conditions
    Core->>WS1: State update
    Core->>WS2: State update
    WS1-->>P1: Render update
    WS2-->>P2: Render update

    Note over P1,Redis: Game Ends
    Core->>Core: Win detected
    Core->>Service: winGame(winner)
    Service->>Redis: Update player stats
    Service->>Redis: Delete game
    Server->>WS1: s.e (game ended)
    Server->>WS2: s.e (game ended)
    Service->>Service: findGame(player1)
    Service->>Service: findGame(player2)
```

### WebSocket Persistence Strategy

```mermaid
graph TB
    subgraph "Next.js Custom Server"
        NextApp[Next.js App]
        HTTPServer[HTTP Server]
        SocketIO[Socket.IO Server]
    end

    subgraph "WebSocket Lifecycle"
        Connect[Client Connect]
        Upgrade[HTTP → WebSocket Upgrade]
        Persistent[Persistent Connection]
        Heartbeat[Ping/Pong Heartbeat]
        Disconnect[Graceful Disconnect]
    end

    subgraph "State Management"
        InMemory[In-Memory Active Connections]
        SessionMap[User ID → Socket Mapping]
        GameMap[Game ID → Players Mapping]
    end

    subgraph "Failover & Recovery"
        RedisStore[Redis Game State Snapshot]
        Reconnect[Reconnection Logic]
        StateRestore[State Restoration]
    end

    NextApp --> HTTPServer
    HTTPServer --> SocketIO

    SocketIO --> Connect
    Connect --> Upgrade
    Upgrade --> Persistent
    Persistent --> Heartbeat
    Heartbeat --> Disconnect

    SocketIO --> InMemory
    InMemory --> SessionMap
    InMemory --> GameMap

    GameMap -.->|Periodic Sync| RedisStore
    Disconnect --> RedisStore
    Reconnect --> RedisStore
    RedisStore --> StateRestore
    StateRestore --> Persistent

    style SocketIO fill:#ffd93d
    style Persistent fill:#6bcf7f
    style RedisStore fill:#ff6b6b
```

---

## System Components

### 1. Next.js Custom Server (`server.js`)

**Purpose**: Bootstrap Next.js with custom HTTP and WebSocket server

**Key Responsibilities**:
- Create HTTP server for Next.js
- Attach Socket.IO to HTTP server
- Initialize GameServer with Socket.IO instance
- Handle server lifecycle

```javascript
// server.js
const httpServer = createServer((req, res) => {
  const parsedUrl = parse(req.url, true);
  handle(req, res, parsedUrl);
});

const io = new Server(httpServer, {
  cors: { origin: "*" }, // Configure for production
  pingTimeout: 60000,
  pingInterval: 25000
});

const gameServer = new GameServer(io, httpServer);
```

**Why Custom Server?**
- Next.js serverless functions timeout after 10 seconds
- WebSockets require persistent connections
- Game state needs to persist across requests
- Custom server allows Socket.IO integration

### 2. GameServer (`src/game.server.js`)

**Purpose**: Manage WebSocket connections and player sessions

**Key Responsibilities**:
- Handle Socket.IO connection/disconnection events
- Assign unique IDs to players
- Delegate game finding to GameService
- Route messages to MessageHandler
- Clean up disconnected players

**Key Methods**:
```javascript
class GameServer {
  setupSocketHandlers() {
    this.io.on('connection', (client) => {
      // Assign player ID and name
      client.userid = UUID();
      client.playername = 'Player ' + client.userid.slice(0, 4);

      // Find or create game
      this.gameService.findGame(client);

      // Handle messages
      client.on('message', (message) => {
        this.messageHandler.handleMessage(client, message);
      });

      // Handle disconnection
      client.on('disconnect', () => {
        if (client.game?.id) {
          this.gameService.endGame(client.game.id, client.userid);
        }
      });
    });
  }
}
```

### 3. GameService (`src/server/services/GameService.js`)

**Purpose**: Game lifecycle and matchmaking

**Key Responsibilities**:
- Create new games
- Find available games for matchmaking
- Manage game state persistence to Redis
- Handle game end and cleanup
- Track player statistics and MMR

**Matchmaking Algorithm**:
```javascript
async findGame(player) {
  // 1. Check in-memory games (fast path)
  for (const game of Object.values(this.games)) {
    if (game.player_count < 2) {
      game.addClient(player);
      await this.saveGameToKV(game);
      return game;
    }
  }

  // 2. Check Redis for games from other instances
  if (this.storage) {
    const availableGame = await this.storage.findAvailableGame();
    if (availableGame) {
      const game = await this.loadGameFromKV(availableGame.id, null, player);
      if (game) {
        game.addClient(player);
        await this.saveGameToKV(game);
        return game;
      }
    }
  }

  // 3. No games found - create new
  return await this.createGame(player);
}
```

### 4. GameCore (`src/game.core.server.js`)

**Purpose**: Server-authoritative game logic engine

**Key Responsibilities**:
- Maintain board state
- Process player inputs
- Apply card effects
- Validate moves
- Detect win conditions
- Synchronize state to clients

**State Structure**:
```javascript
class GameCore {
  constructor(game) {
    this.board = {
      results: [], // 4x4 grid: 0=empty, 1=player1, -1=player2
      frost: [],   // Frozen squares
      rock: [],    // Blocked squares
      shields: []  // Shield counts per square
    };

    this.players = {
      self: new GamePlayer(true),  // Host
      other: new GamePlayer(false) // Client
    };

    this.turn = 1; // Current turn number
  }

  handleServerInput(commands) {
    // Parse and validate input
    // Apply card effects via CardResolver
    // Update board state
    // Check win conditions
    // Broadcast state changes
  }
}
```

### 5. Redis Storage (`src/server/storage/RedisGameStorage.js`)

**Purpose**: Persistent game metadata for serverless environments

**Data Stored**:
- Game metadata (ID, player count, active status)
- Game state snapshots
- Player statistics (MMR, wins, losses)

**TTL Strategy**:
- Active games: 1 hour TTL (auto-cleanup)
- Player stats: No expiration

**Key Methods**:
```javascript
class RedisGameStorage {
  async saveGame(game) {
    await kv.set(`game:${game.id}`, {
      id: game.id,
      playerCount: game.player_count,
      active: game.active,
      createdAt: Date.now()
    }, { ex: 3600 }); // 1 hour TTL
  }

  async findAvailableGame() {
    const keys = await kv.keys('game:*');
    for (const key of keys) {
      const game = await kv.get(key);
      if (game.playerCount < 2) return game;
    }
    return null;
  }
}
```

---

## Multiplayer Infrastructure

### WebSocket Connection Management

**Connection Lifecycle**:

1. **Client connects** → Server assigns unique ID
2. **Matchmaking** → Find existing game or create new
3. **Game start** → When 2 players matched
4. **Active gameplay** → Real-time message exchange
5. **Game end** → Return both players to matchmaking
6. **Disconnect handling** → Clean up game, rematch opponent

**Heartbeat Mechanism**:
```javascript
// Socket.IO configuration
const io = new Server(httpServer, {
  pingTimeout: 60000,  // 60 seconds
  pingInterval: 25000, // 25 seconds
  upgradeTimeout: 30000,
  transports: ['websocket', 'polling']
});
```

**Reconnection Strategy**:
```javascript
// Client-side
const socket = io({
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5
});

socket.on('reconnect', () => {
  // Request game state restoration
  socket.emit('restore_session', { userId: savedUserId });
});
```

### Message Protocol

**Format**: Period-delimited strings for efficiency

```
TYPE.DATA1.DATA2.DATA3
```

**Message Types**:

| Direction | Type | Format | Description |
|-----------|------|--------|-------------|
| C→S | `i` | `i.COMMANDS.TIME.SEQ` | Player input (card/piece) |
| C→S | `p` | `p.TIMESTAMP` | Ping for latency |
| C→S | `m` | `m.MMR` | MMR rating report |
| C→S | `w` | `w` | Win notification |
| S→C | `s.h` | `s.h.TIME` | You are host |
| S→C | `s.j` | `s.j.HOST_ID` | Player 2 joined |
| S→C | `s.r` | `s.r.TIME` | Game ready to start |
| S→C | `s.e` | `s.e` | Game ended |
| S→C | `s.n` | `s.n.NAME` | Player name change |
| S→C | `onconnected` | `{id, name}` | Connection established |

**Input Command Format**:
```
CARD_INDEX-PIECE_POSITION,CARD_INDEX-PIECE_POSITION
```

Example: `i.3-7,5-12.1234567.001`
- Play card at index 3, place piece at position 7
- Play card at index 5, place piece at position 12
- Client timestamp: 1234567
- Sequence number: 001

### State Synchronization

**Server-Authoritative Model**:
- Server is source of truth
- Clients send inputs
- Server validates and applies
- Server broadcasts state updates

**State Update Flow**:
```mermaid
graph LR
    P1[Player 1] -->|Input| Server[Game Server]
    Server -->|Validate| Core[GameCore]
    Core -->|Apply| State[Board State]
    State -->|Broadcast| P1
    State -->|Broadcast| P2[Player 2]
```

**Optimistic Updates** (Client-side):
- Render local prediction immediately
- Await server confirmation
- Rollback if server rejects

---

## Game Flow

### Matchmaking Flow

```mermaid
stateDiagram-v2
    [*] --> Connecting: Player connects
    Connecting --> SearchingGame: Socket connected
    SearchingGame --> WaitingForOpponent: Created new game (Host)
    SearchingGame --> GameStarting: Joined existing game (Client)
    WaitingForOpponent --> GameStarting: Opponent found
    GameStarting --> Playing: Both players ready
    Playing --> GameEnded: Win condition met
    Playing --> GameEnded: Player disconnect
    GameEnded --> SearchingGame: Auto-rematch
    GameEnded --> [*]: Player leaves
```

### Game Lifecycle

```mermaid
stateDiagram-v2
    state Playing {
        [*] --> DrawPhase
        DrawPhase --> CardPhase: Card drawn
        CardPhase --> CardPhase: Play another card
        CardPhase --> PlacePhase: Cards played/skipped
        PlacePhase --> CheckWin: Piece placed
        CheckWin --> [*]: Winner found
        CheckWin --> NextTurn: No winner
        NextTurn --> DrawPhase: Switch player
    }
```

### Turn Phases

**1. Draw Phase**
- Automatic: Player draws 1 card from deck
- Skip if deck empty
- Skip if hand full (7 cards)

**2. Card Phase**
- Player may play 0+ cards
- Each card has effects (damage, shield, freeze, etc.)
- Effects resolved immediately via CardResolver
- Some cards allow playing multiple cards
- End card phase when player chooses

**3. Place Phase**
- Player must place 1 piece on board
- Validate: Square not frozen, not blocked, not occupied
- Update board state
- Some cards allow placing multiple pieces

**4. Check Win**
- Check all rows, columns, diagonals for 4-in-a-row
- If winner found: End game, update stats
- If no winner: Next player's turn

---

## Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 15.5.6 | React framework, SSR, routing |
| React | 19.2.0 | UI component library |
| TypeScript | 5.3.3 | Type-safe JavaScript |
| Socket.IO Client | 4.8.1 | WebSocket client |
| Canvas API | Native | Game rendering |
| jQuery | 3.7.1 | Legacy game code support |
| dat.GUI | 0.7.9 | Debug controls |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 20+ | JavaScript runtime |
| Next.js | 15.5.6 | Server framework |
| Express | 4.18.2 | HTTP server |
| Socket.IO | 4.7.4 | WebSocket server |
| Vercel KV | 3.0.0 | Redis for serverless |
| Winston | 3.11.0 | Logging |
| UUID | 9.0.1 | Unique ID generation |

### Development

| Technology | Version | Purpose |
|------------|---------|---------|
| Jest | 29.7.0 | Unit testing |
| ESLint | 8.56.0 | Code linting |
| Prettier | 3.6.2 | Code formatting |
| TypeScript | 5.3.3 | Type checking |
| Nodemon | 3.0.3 | Dev server auto-reload |

---

## Deployment Strategy

### Deployment Modes

#### 1. Local Development

```bash
npm run dev
```

**Configuration**:
- HTTP Server: `localhost:3000`
- WebSocket: `ws://localhost:3000`
- Storage: In-memory only
- Redis: Optional (development can skip)

**Pros**:
- Fast iteration
- Full debugging
- No external dependencies

**Cons**:
- No persistent state
- Single instance only

#### 2. Production Server (VPS/Dedicated)

```bash
npm run build
npm start
```

**Configuration**:
- HTTP Server: Custom domain
- WebSocket: `wss://yourdomain.com`
- Storage: In-memory + Redis
- Redis: Vercel KV or self-hosted

**Pros**:
- Persistent WebSocket connections
- Full control over server
- No cold starts

**Cons**:
- Manual scaling
- Server management overhead
- Single point of failure

#### 3. Vercel Serverless (Hybrid)

**Configuration**:
- Static pages: Vercel CDN
- API routes: Serverless functions
- WebSocket server: External (Railway, Render, Fly.io)
- Redis: Vercel KV

**Architecture**:
```mermaid
graph TB
    Client[Web Browser]
    VercelCDN[Vercel CDN<br/>Static Assets]
    VercelFunc[Vercel Serverless<br/>API Routes]
    External[External WebSocket Server<br/>Railway/Render]
    Redis[Vercel KV Redis]

    Client --> VercelCDN
    Client --> VercelFunc
    Client <-->|WSS| External
    VercelFunc --> Redis
    External --> Redis
```

**Pros**:
- Scalable static delivery
- Managed infrastructure
- Global CDN

**Cons**:
- WebSocket server must be separate
- More complex deployment
- Additional cost for WebSocket server

### Recommended Production Setup

**Option A: Single Server** (Simplest)
- Deploy to Railway, Render, or Fly.io
- Use Vercel KV for Redis
- Configure custom domain with SSL

**Option B: Hybrid** (Most Scalable)
- Static assets on Vercel
- WebSocket server on Railway/Render
- Vercel KV for Redis
- CloudFlare for DNS and SSL

### Environment Variables

```bash
# Server Configuration
PORT=3000
NODE_ENV=production

# Redis (Vercel KV)
KV_REST_API_URL=https://your-kv.vercel.com
KV_REST_API_TOKEN=your_token_here
KV_URL=redis://default:token@endpoint:port

# Optional: Analytics
ANALYTICS_ID=your_analytics_id
```

### Monitoring and Logging

**Winston Logger Configuration**:
```javascript
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});
```

**Key Metrics to Monitor**:
- Active WebSocket connections
- Active games count
- Average game duration
- Player reconnection rate
- Redis hit/miss ratio
- Server memory usage
- Message throughput

---

## Scalability Considerations

### Current Limitations

1. **Single Server Instance**
   - All games run in one Node.js process
   - Memory limited by instance size
   - No horizontal scaling

2. **In-Memory State**
   - Game state lost on server restart
   - No load balancing across servers

3. **WebSocket Stickiness**
   - Players must connect to same server instance
   - Can't migrate games between servers

### Future Improvements

#### 1. Redis Pub/Sub for Multi-Server

```mermaid
graph TB
    subgraph "Server Instance 1"
        S1[Game Server 1]
        M1[Memory Cache 1]
    end

    subgraph "Server Instance 2"
        S2[Game Server 2]
        M2[Memory Cache 2]
    end

    subgraph "Shared State"
        RedisPubSub[Redis Pub/Sub]
        RedisStore[Redis Game Store]
    end

    S1 --> M1
    S2 --> M2
    S1 --> RedisPubSub
    S2 --> RedisPubSub
    S1 -.-> RedisStore
    S2 -.-> RedisStore
    RedisPubSub --> RedisStore
```

**Implementation**:
```javascript
// Subscribe to game updates
redis.subscribe(`game:${gameId}`);
redis.on('message', (channel, message) => {
  const update = JSON.parse(message);
  this.syncGameState(update);
});

// Publish state changes
redis.publish(`game:${gameId}`, JSON.stringify(stateUpdate));
```

#### 2. Kubernetes Deployment

**Pod Configuration**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: game-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: game-server
  template:
    spec:
      containers:
      - name: game-server
        image: knights-crosses:latest
        env:
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-secret
              key: url
```

#### 3. Load Balancer Configuration

**Sticky Sessions** (required for WebSockets):
```nginx
upstream game_servers {
    ip_hash;  # Sticky sessions based on client IP
    server game-server-1:3000;
    server game-server-2:3000;
    server game-server-3:3000;
}

server {
    listen 443 ssl;
    server_name game.example.com;

    location / {
        proxy_pass http://game_servers;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Security Considerations

### Input Validation

**Server-Side Validation**:
```javascript
handleServerInput(commands) {
  // Validate input format
  if (!this.validateInputFormat(commands)) {
    return; // Reject invalid input
  }

  // Validate move legality
  if (!this.validateMove(cardIndex, piecePosition)) {
    return; // Reject illegal move
  }

  // Apply input
  this.applyInput(commands);
}
```

### Rate Limiting

**Socket.IO Rate Limiting**:
```javascript
const rateLimiter = new Map();

io.on('connection', (socket) => {
  const limit = { count: 0, resetTime: Date.now() + 1000 };
  rateLimiter.set(socket.id, limit);

  socket.on('message', (msg) => {
    const limit = rateLimiter.get(socket.id);

    if (Date.now() > limit.resetTime) {
      limit.count = 0;
      limit.resetTime = Date.now() + 1000;
    }

    if (limit.count >= 10) {
      socket.emit('rate_limit_exceeded');
      return;
    }

    limit.count++;
    this.handleMessage(socket, msg);
  });
});
```

### Authentication (Future)

**JWT Token-Based Auth**:
```javascript
io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) return next(new Error('Authentication error'));

    socket.userId = decoded.userId;
    next();
  });
});
```

---

## Performance Optimizations

### 1. Message Compression

**Binary Protocol** instead of JSON:
```javascript
// Current: JSON (verbose)
{ type: 'input', cardIndex: 3, position: 7 }

// Optimized: Binary buffer
const buffer = Buffer.allocUnsafe(5);
buffer.writeUInt8(1, 0);  // Message type
buffer.writeUInt8(3, 1);  // Card index
buffer.writeUInt8(7, 2);  // Position
buffer.writeUInt16BE(sequence, 3);
```

### 2. Delta Updates

**Send only changed state**:
```javascript
// Current: Full state
{ board: [[...]], players: {...} }

// Optimized: Delta only
{ type: 'delta', position: 7, value: 1, shields: 2 }
```

### 3. Client-Side Prediction

**Predict moves locally, reconcile with server**:
```javascript
// Client predicts move result
this.localBoard[pos] = 1;
this.render();

// Server confirms or corrects
socket.on('state_update', (serverState) => {
  if (this.localBoard !== serverState.board) {
    // Rollback and apply server state
    this.localBoard = serverState.board;
    this.render();
  }
});
```

---

## Testing Strategy

### Unit Tests

**GameCore Logic**:
```javascript
describe('GameCore', () => {
  it('should detect horizontal win', () => {
    const game = new GameCore();
    game.board.results[0] = [1, 1, 1, 1];
    expect(game.checkWin()).toBe(1);
  });

  it('should apply damage correctly', () => {
    const game = new GameCore();
    game.board.shields[0][0] = 2;
    game.applyDamage(0, 1);
    expect(game.board.shields[0][0]).toBe(1);
  });
});
```

### Integration Tests

**Multiplayer Flow**:
```javascript
describe('Multiplayer', () => {
  it('should match two players', async () => {
    const player1 = createMockSocket();
    const player2 = createMockSocket();

    await gameService.findGame(player1);
    const game = await gameService.findGame(player2);

    expect(game.player_count).toBe(2);
    expect(game.active).toBe(true);
  });
});
```

### Load Testing

**Socket.IO Load Test**:
```javascript
import { io } from 'socket.io-client';

async function loadTest(concurrentPlayers) {
  const sockets = [];

  for (let i = 0; i < concurrentPlayers; i++) {
    const socket = io('ws://localhost:3000');
    sockets.push(socket);

    await new Promise(resolve => {
      socket.on('onconnected', resolve);
    });
  }

  console.log(`${concurrentPlayers} players connected`);
}

loadTest(1000);
```

---

## Glossary

| Term | Definition |
|------|------------|
| **Socket.IO** | Real-time bidirectional event-based communication library |
| **WebSocket** | Protocol for persistent, full-duplex connections |
| **MMR** | Matchmaking Rating - player skill level |
| **TTL** | Time To Live - expiration time for cached data |
| **Pub/Sub** | Publish/Subscribe messaging pattern |
| **Redis** | In-memory data structure store used for caching |
| **SSR** | Server-Side Rendering |
| **CSR** | Client-Side Rendering |
| **App Router** | Next.js 13+ file-based routing system |
| **TCG** | Trading Card Game |

---

**Last Updated**: 2025-11-21
**Version**: 2.0.0
**Maintained By**: Development Team
