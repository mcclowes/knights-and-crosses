import { BOARD_SIZE, WIN_CONDITION, state } from "../config/constants";

interface BoardState {
  results: number[][];
  frost: number[][];
  rock: number[][];
  shields: number[][];
}

export class GameBoard {
  private boardState: BoardState;
  public boardDistance: number = 0;

  constructor() {
    this.boardState = {
      results: Array(BOARD_SIZE)
        .fill(0)
        .map(() => Array(BOARD_SIZE).fill(state.EMPTY)),
      frost: Array(BOARD_SIZE)
        .fill(0)
        .map(() => Array(BOARD_SIZE).fill(0)),
      rock: Array(BOARD_SIZE)
        .fill(0)
        .map(() => Array(BOARD_SIZE).fill(0)),
      shields: Array(BOARD_SIZE)
        .fill(0)
        .map(() => Array(BOARD_SIZE).fill(0)),
    };
  }

  public getState(): BoardState {
    return this.boardState;
  }

  public reduceState(): void {
    for (let i = 0; i < BOARD_SIZE; i++) {
      for (let j = 0; j < BOARD_SIZE; j++) {
        if (this.boardState.frost[i][j] > 0) this.boardState.frost[i][j]--;
        if (this.boardState.rock[i][j] > 0) this.boardState.rock[i][j]--;
      }
    }
  }

  public checkWin(): number | undefined {
    return this.checkRows() || this.checkCols() || this.checkDiagonals();
  }

  private checkRows(): number | undefined {
    for (let i = 0; i < BOARD_SIZE; i++) {
      const sum = this.boardState.results[i].reduce((a, b) => a + b, 0);
      if (Math.abs(sum) === WIN_CONDITION) {
        return this.boardState.results[i][0];
      }
    }
  }

  private checkCols(): number | undefined {
    for (let i = 0; i < BOARD_SIZE; i++) {
      const sum = this.boardState.results.reduce((a, row) => a + row[i], 0);
      if (Math.abs(sum) === WIN_CONDITION) {
        return this.boardState.results[0][i];
      }
    }
  }

  private checkDiagonals(): number | undefined {
    // Right-wards diagonal
    const rightDiagonal = this.boardState.results.reduce(
      (sum, row, i) => sum + row[i],
      0,
    );
    if (Math.abs(rightDiagonal) === WIN_CONDITION) {
      return this.boardState.results[0][0];
    }

    // Left-wards diagonal
    const leftDiagonal = this.boardState.results.reduce(
      (sum, row, i) => sum + row[BOARD_SIZE - 1 - i],
      0,
    );
    if (Math.abs(leftDiagonal) === WIN_CONDITION) {
      return this.boardState.results[0][BOARD_SIZE - 1];
    }
  }

  public setCell(row: number, col: number, value: number): void {
    if (row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE) {
      this.boardState.results[row][col] = value;
    }
  }

  public getCell(row: number, col: number): number {
    return this.boardState.results[row][col];
  }

  public isCellEmpty(row: number, col: number): boolean {
    return (
      this.boardState.results[row][col] === state.EMPTY &&
      this.boardState.frost[row][col] === 0 &&
      this.boardState.rock[row][col] === 0
    );
  }

  public hasShield(row: number, col: number): boolean {
    return this.boardState.shields[row][col] > 0;
  }

  public setShield(row: number, col: number, value: number): void {
    this.boardState.shields[row][col] = value;
  }
}
