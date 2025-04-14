import React from 'react';

const MultiplayerMenu = ({ onJoinMatchmaking, onReturnToMainMenu }) => {
  return (
    <div className="bg-gray-700 rounded-lg p-8 shadow-lg text-white max-w-[400px] w-full">
      <h2 className="text-3xl font-bold mb-6 text-center">Online Multiplayer</h2>
      
      <div className="mb-8">
        <div className="text-center text-gray-300 mb-6">
          <p>Click Play to join the matchmaking queue.</p>
          <p className="text-sm text-gray-400 mt-2">You'll be automatically matched with another player.</p>
        </div>
        
        <button 
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg mb-4 transition-colors text-xl"
          onClick={onJoinMatchmaking}
        >
          Play
        </button>
      </div>
      
      <button 
        className="w-full bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition-colors"
        onClick={onReturnToMainMenu}
      >
        Back to Main Menu
      </button>
    </div>
  );
};

export default MultiplayerMenu;
