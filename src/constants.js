// Game physics and appearance constants
export const PLAYER_SIZE = 40;
export const BALL_SIZE = 30;
export const MAX_PULL_DISTANCE = 150;
export const POWER_FACTOR = 0.2;
export const DAMPING_FACTOR = 0.985;
export const WALL_BOUNCE_FACTOR = 0.85;
export const BALL_COLLISION_BOUNCE_FACTOR = 0.98;
export const MIN_VELOCITY_THRESHOLD = 0.05;
export const ARROW_COLOR = 'rgba(255, 255, 255, 0.7)';
export const ARROW_MAX_WIDTH = 8;
export const GOAL_HEIGHT = 100;

// Game modes
export const GAME_MODES = {
  VS_PLAYER: 'vs_player',
  VS_AI: 'vs_ai'
};

// AI difficulty levels
export const AI_DIFFICULTY = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard'
};

// Default AI settings
export const DEFAULT_AI_DIFFICULTY = AI_DIFFICULTY.MEDIUM;
export const AI_POWER_SCALING_FACTOR = 0.5; // Multiplier for AI shot power (1.0 = normal)
