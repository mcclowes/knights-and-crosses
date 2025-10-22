import { GameBoard } from "../board/GameBoard";
import { GamePlayer } from "../player/GamePlayer";
import { AI_PARAMETERS, FRAME_TIME } from "../config/constants";
import { setupAnimationFrame } from "../utils/helpers";
import * as fs from "fs";
import { CARD_DATA_PATH, CARDS_PATH } from "../config/constants";

export class GameCore {
  private board: GameBoard;
  private players: {
    self: GamePlayer;
    other: GamePlayer;
  };
  private turn: number = 1;
  private localTime: number = FRAME_TIME;
  private lastUpdateTime: number = Date.now();
  private serverTime: number = 0;
  private lastState: any = {};
  private mmr: number = 1;
  private gameCount: number = 0;

  constructor(
    private playerCardValue: number = AI_PARAMETERS.PLAYER_CARD_VALUE,
    private enemyCardValue: number = AI_PARAMETERS.ENEMY_CARD_VALUE,
    private centerMod: number = AI_PARAMETERS.CENTER_MOD,
    private enemyMod: number = AI_PARAMETERS.ENEMY_MOD,
    private shieldMod: number = AI_PARAMETERS.SHIELD_MOD,
    private freezeMod: number = AI_PARAMETERS.FREEZE_MOD,
    private rockMod: number = AI_PARAMETERS.ROCK_MOD,
    private gameInstance?: any,
  ) {
    this.board = new GameBoard();
    this.players = {
      self: new GamePlayer(this, true),
      other: new GamePlayer(this, false),
    };

    setupAnimationFrame();
    this.initializeClient();
  }

  private initializeClient(): void {
    this.setupClientConfiguration();
    this.setupPingTimer();
  }

  private setupClientConfiguration(): void {
    // Add client-specific configuration
  }

  private setupPingTimer(): void {
    // Add ping timer setup
  }

  public update(currentTime: number): void {
    const deltaTime = (currentTime - this.lastUpdateTime) / 1000;
    this.localTime = deltaTime;
    this.lastUpdateTime = currentTime;

    // Update game state
    this.updateGameState();
  }

  private updateGameState(): void {
    // Update game state logic
  }

  public checkFreeSquare(): number {
    let space = 0;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        if (this.board.isCellEmpty(i, j)) {
          space++;
        }
      }
    }
    return space;
  }

  public checkEnemySquare(): boolean {
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const cellValue = this.board.getCell(i, j);
        if (
          (this.players.self.host && cellValue === 1) ||
          (!this.players.self.host && cellValue === -1)
        ) {
          return true;
        }
      }
    }
    return false;
  }

  public checkSelfSquare(): boolean {
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const cellValue = this.board.getCell(i, j);
        if (
          (this.players.self.host && cellValue === -1) ||
          (!this.players.self.host && cellValue === 1)
        ) {
          return true;
        }
      }
    }
    return false;
  }

  public checkShield(): boolean {
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        if (this.board.hasShield(i, j)) {
          return true;
        }
      }
    }
    return false;
  }

  public checkUnshielded(): boolean {
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        if (!this.board.hasShield(i, j) && this.board.getCell(i, j) !== 0) {
          return true;
        }
      }
    }
    return false;
  }

  public getBoard(): GameBoard {
    return this.board;
  }

  public getPlayers(): { self: GamePlayer; other: GamePlayer } {
    return this.players;
  }

  public getTurn(): number {
    return this.turn;
  }

  public getMMR(): number {
    return this.mmr;
  }

  public getGameCount(): number {
    return this.gameCount;
  }

  public incrementGameCount(): void {
    this.gameCount++;
  }

  public updateMMR(newMMR: number): void {
    this.mmr = newMMR;
  }
}
