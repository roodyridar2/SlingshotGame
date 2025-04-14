import React, { useState } from 'react';

const WaitingRoom = ({ roomId, isHost, onReady, onCancel, opponentReady, playerReady }) => {
  const [copied, setCopied] = useState(false);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gray-700 rounded-lg p-8 shadow-lg text-white max-w-[400px] w-full">
      <h2 className="text-3xl font-bold mb-6 text-center">Waiting Room</h2>
      
      <div className="mb-6 text-center">
        <p className="text-gray-300 mb-2">Room Code:</p>
        <div className="flex items-center justify-center">
          <div className="bg-gray-800 px-4 py-2 rounded-lg text-xl font-mono mr-2">
            {roomId}
          </div>
          <button 
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors"
            onClick={copyRoomCode}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <p className="text-gray-400 mt-2 text-sm">Share this code with your friend to join</p>
      </div>
      
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
            <span>You {isHost ? '(Host)' : ''}</span>
          </div>
          <div className="bg-blue-500 px-3 py-1 rounded-full text-sm">
            {playerReady ? 'Ready' : 'Not Ready'}
          </div>
        </div>
        
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <div className={`w-3 h-3 ${isHost ? 'bg-gray-500' : 'bg-green-500'} rounded-full mr-2`}></div>
            <span>{isHost ? 'Waiting for opponent...' : 'Opponent (Host)'}</span>
          </div>
          {!isHost && (
            <div className="bg-blue-500 px-3 py-1 rounded-full text-sm">
              {opponentReady ? 'Ready' : 'Not Ready'}
            </div>
          )}
        </div>
      </div>
      
      <div className="flex space-x-4">
        <button 
          className={`flex-1 ${playerReady 
            ? 'bg-gray-600 hover:bg-gray-500' 
            : 'bg-green-600 hover:bg-green-700'} 
            text-white font-bold py-3 px-6 rounded-lg transition-colors`}
          onClick={onReady}
          disabled={playerReady}
        >
          {playerReady ? 'Ready ✓' : 'Ready Up'}
        </button>
        
        <button 
          className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default WaitingRoom;
