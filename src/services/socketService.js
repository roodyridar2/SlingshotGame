import { io } from 'socket.io-client';

// Socket.io instance
let socket = null;
let callbacks = {};

// Server URL - change this to your production URL in production
const SERVER_URL = 'http://localhost:3001';

// Initialize socket connection
export const initializeSocket = () => {
  if (!socket) {
    socket = io(SERVER_URL);
    console.log('Socket initialized');
    
    // Set up default event listeners
    socket.on('connect', () => {
      console.log('Connected to server with ID:', socket.id);
      if (callbacks.onConnect) callbacks.onConnect(socket.id);
    });
    
    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      if (callbacks.onDisconnect) callbacks.onDisconnect();
    });
    
    socket.on('error', (error) => {
      console.error('Socket error:', error);
      if (callbacks.onError) callbacks.onError(error);
    });
  }
  
  return socket;
};

// Disconnect socket
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    callbacks = {};
    console.log('Socket disconnected');
  }
};

// Register callback functions for socket events
export const registerCallbacks = (newCallbacks) => {
  callbacks = { ...callbacks, ...newCallbacks };
  
  // Set up event listeners for the callbacks
  if (socket) {
    Object.keys(newCallbacks).forEach(event => {
      // Skip the special callbacks that don't directly map to socket events
      if (['onConnect', 'onDisconnect', 'onError'].includes(event)) return;
      
      // Remove any existing listener for this event
      socket.off(event);
      
      // Add the new listener
      socket.on(event, (data) => {
        if (callbacks[event]) callbacks[event](data);
      });
    });
  }
};

// Matchmaking and room management
export const joinMatchmaking = () => {
  if (socket) {
    socket.emit('joinMatchmaking');
  }
};

export const leaveMatchmaking = () => {
  if (socket) {
    socket.emit('leaveMatchmaking');
  }
};

// Room management (manual room creation/joining)
export const createRoom = () => {
  if (socket) {
    socket.emit('createRoom');
  }
};

export const joinRoom = (roomId) => {
  if (socket) {
    socket.emit('joinRoom', { roomId });
  }
};

export const leaveRoom = (roomId) => {
  if (socket) {
    socket.emit('leaveRoom', { roomId });
  }
};

// Game actions
export const setPlayerReady = (roomId) => {
  if (socket) {
    socket.emit('playerReady', { roomId });
  }
};

export const sendGameMove = (roomId, move) => {
  if (socket) {
    socket.emit('gameMove', { roomId, move });
  }
};

export const updateGameState = (roomId, gameState) => {
  if (socket) {
    socket.emit('gameStateUpdate', { roomId, gameState });
  }
};

export const sendGameOver = (roomId, winner) => {
  if (socket) {
    socket.emit('gameOver', { roomId, winner });
  }
};

// Get socket ID
export const getSocketId = () => {
  return socket ? socket.id : null;
};
