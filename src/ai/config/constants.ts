export const FRAME_TIME = 60 / 1000;
export const BOARD_SIZE = 4;
export const WIN_CONDITION = 4;

export const CARD_DATA_PATH = "json/card_data.json";
export const CARDS_PATH = "json/cards.json";

export const AI_PARAMETERS = {
  PLAYER_CARD_VALUE: 0,
  ENEMY_CARD_VALUE: 1,
  CENTER_MOD: 2,
  ENEMY_MOD: 3,
  SHIELD_MOD: 4,
  FREEZE_MOD: 5,
  ROCK_MOD: 6,
} as const;

export const state = {
  EMPTY: 0,
  PLAYER_ONE: 1,
  PLAYER_TWO: -1,
} as const;
