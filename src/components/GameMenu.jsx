import React from 'react';

// Game modes and AI difficulty levels imported from constants
import { GAME_MODES, AI_DIFFICULTY } from '../constants';

/**
 * Game menu component for selecting game mode and AI difficulty
 */
function GameMenu({ 
  gameMode, 
  setGameMode, 
  aiDifficulty, 
  setAiDifficulty, 
  startGame 
}) {
  return (
    <div className="bg-gray-700 p-6 rounded-lg shadow-lg w-full max-w-[600px] text-white">
      <h1 className="text-2xl font-bold mb-6 text-center">Soccer Stars Game</h1>
      
      <h2 className="text-xl mb-4">Select Game Mode:</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <button 
          className="bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg flex flex-col items-center"
          onClick={() => startGame(GAME_MODES.VS_PLAYER)}
        >
          <span className="text-lg font-bold">vs Player</span>
          <span className="text-sm mt-1">Play against a friend locally</span>
        </button>
        
        <button 
          className="bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg flex flex-col items-center"
          onClick={() => setGameMode(GAME_MODES.VS_AI)}
        >
          <span className="text-lg font-bold">vs AI</span>
          <span className="text-sm mt-1">Play against the computer</span>
        </button>
      </div>
      
      {gameMode === GAME_MODES.VS_AI && (
        <div className="mb-6">
          <h2 className="text-xl mb-4">Select AI Difficulty:</h2>
          <div className="grid grid-cols-3 gap-3">
            <button 
              className={`py-2 px-4 rounded-lg ${aiDifficulty === AI_DIFFICULTY.EASY ? 'bg-yellow-600' : 'bg-gray-600 hover:bg-gray-500'}`}
              onClick={() => setAiDifficulty(AI_DIFFICULTY.EASY)}
            >
              Easy
            </button>
            <button 
              className={`py-2 px-4 rounded-lg ${aiDifficulty === AI_DIFFICULTY.MEDIUM ? 'bg-yellow-600' : 'bg-gray-600 hover:bg-gray-500'}`}
              onClick={() => setAiDifficulty(AI_DIFFICULTY.MEDIUM)}
            >
              Medium
            </button>
            <button 
              className={`py-2 px-4 rounded-lg ${aiDifficulty === AI_DIFFICULTY.HARD ? 'bg-yellow-600' : 'bg-gray-600 hover:bg-gray-500'}`}
              onClick={() => setAiDifficulty(AI_DIFFICULTY.HARD)}
            >
              Hard
            </button>
          </div>
        </div>
      )}
      
      {gameMode === GAME_MODES.VS_AI && (
        <button 
          className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 px-4 rounded-lg font-bold"
          onClick={() => startGame(GAME_MODES.VS_AI, aiDifficulty)}
        >
          Start Game vs AI ({aiDifficulty})
        </button>
      )}
    </div>
  );
}

export default GameMenu;
