import React, { useState, useEffect } from 'react';

const MatchmakingQueue = ({ onCancel }) => {
  const [waitTime, setWaitTime] = useState(0);
  
  // Update wait time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setWaitTime(prev => prev + 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Format wait time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="bg-gray-700 rounded-lg p-8 shadow-lg text-white max-w-[400px] w-full">
      <h2 className="text-3xl font-bold mb-6 text-center">Finding Match</h2>
      
      <div className="flex flex-col items-center mb-8">
        <div className="w-24 h-24 mb-4 relative">
          <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl font-bold">{formatTime(waitTime)}</span>
          </div>
        </div>
        <p className="text-gray-300 text-center">
          Searching for an opponent...<br />
          Please wait while we find you a match.
        </p>
      </div>
      
      <div className="flex justify-center">
        <button 
          className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default MatchmakingQueue;
