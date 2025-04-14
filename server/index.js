const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
const server = http.createServer(app);

// Create Socket.IO server with CORS configuration
const io = new Server(server, {
  cors: {
    origin: '*', // In production, restrict this to your frontend URL
    methods: ['GET', 'POST'],
  },
});

// Game rooms storage
const gameRooms = {};

// Matchmaking queue
let matchmakingQueue = [];

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Join matchmaking queue
  socket.on('joinMatchmaking', () => {
    console.log(`Player ${socket.id} joined matchmaking queue`);
    
    // Check if player is already in queue
    const existingIndex = matchmakingQueue.findIndex(id => id === socket.id);
    if (existingIndex !== -1) {
      console.log(`Player ${socket.id} is already in matchmaking queue`);
      return;
    }
    
    // Add player to queue
    matchmakingQueue.push(socket.id);
    socket.emit('joinedMatchmaking');
    
    // If we have at least 2 players in queue, match them
    if (matchmakingQueue.length >= 2) {
      const player1Id = matchmakingQueue.shift();
      const player2Id = matchmakingQueue.shift();
      
      // Create a new room for the matched players
      const roomId = uuidv4().substring(0, 6);
      
      gameRooms[roomId] = {
        id: roomId,
        players: [
          { id: player1Id, team: 1, ready: false },
          { id: player2Id, team: 2, ready: false }
        ],
        gameState: null,
        spectators: []
      };
      
      // Join both players to the room
      const player1Socket = io.sockets.sockets.get(player1Id);
      const player2Socket = io.sockets.sockets.get(player2Id);
      
      if (player1Socket && player2Socket) {
        player1Socket.join(roomId);
        player2Socket.join(roomId);
        
        // Notify players they've been matched
        player1Socket.emit('matchFound', { roomId, playerId: player1Id, team: 1 });
        player2Socket.emit('matchFound', { roomId, playerId: player2Id, team: 2 });
        
        console.log(`Matched players ${player1Id} and ${player2Id} in room ${roomId}`);
      } else {
        // If one of the sockets is no longer connected, put the other back in queue
        if (player1Socket) {
          matchmakingQueue.unshift(player1Id);
          player1Socket.emit('matchmakingContinued');
        }
        if (player2Socket) {
          matchmakingQueue.unshift(player2Id);
          player2Socket.emit('matchmakingContinued');
        }
        
        // Remove the room
        delete gameRooms[roomId];
      }
    }
  });
  
  // Leave matchmaking queue
  socket.on('leaveMatchmaking', () => {
    const index = matchmakingQueue.indexOf(socket.id);
    if (index !== -1) {
      matchmakingQueue.splice(index, 1);
      socket.emit('leftMatchmaking');
      console.log(`Player ${socket.id} left matchmaking queue`);
    }
  });

  // Create a new game room (manual room creation still available)
  socket.on('createRoom', () => {
    const roomId = uuidv4().substring(0, 6); // Generate a short room ID
    
    gameRooms[roomId] = {
      id: roomId,
      players: [{ id: socket.id, team: 1, ready: false }],
      gameState: null,
      spectators: []
    };
    
    socket.join(roomId);
    socket.emit('roomCreated', { roomId, playerId: socket.id, team: 1 });
    
    console.log(`Room created: ${roomId} by player ${socket.id}`);
  });

  // Join an existing game room
  socket.on('joinRoom', ({ roomId }) => {
    const room = gameRooms[roomId];
    
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    if (room.players.length >= 2) {
      // Room is full, join as spectator
      room.spectators.push(socket.id);
      socket.join(roomId);
      socket.emit('joinedAsSpectator', { roomId });
      io.to(roomId).emit('spectatorJoined', { spectatorId: socket.id });
      return;
    }
    
    // Join as player 2
    room.players.push({ id: socket.id, team: 2, ready: false });
    socket.join(roomId);
    
    socket.emit('roomJoined', { roomId, playerId: socket.id, team: 2 });
    io.to(roomId).emit('playerJoined', { playerId: socket.id, team: 2 });
    
    console.log(`Player ${socket.id} joined room ${roomId}`);
  });

  // Player ready status
  socket.on('playerReady', ({ roomId }) => {
    const room = gameRooms[roomId];
    if (!room) return;
    
    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      player.ready = true;
      io.to(roomId).emit('playerStatusUpdate', { playerId: socket.id, ready: true });
      
      // Check if all players are ready
      const allReady = room.players.length === 2 && room.players.every(p => p.ready);
      if (allReady) {
        // Start the game
        io.to(roomId).emit('gameStart');
        console.log(`Game started in room ${roomId}`);
      }
    }
  });

  // Game move
  socket.on('gameMove', ({ roomId, move }) => {
    const room = gameRooms[roomId];
    if (!room) return;
    
    // Broadcast the move to all players in the room
    socket.to(roomId).emit('opponentMove', { move });
    console.log(`Move in room ${roomId} by player ${socket.id}`);
  });

  // Game state update
  socket.on('gameStateUpdate', ({ roomId, gameState }) => {
    const room = gameRooms[roomId];
    if (!room) return;
    
    room.gameState = gameState;
    socket.to(roomId).emit('gameStateUpdated', { gameState });
  });

  // Game over
  socket.on('gameOver', ({ roomId, winner }) => {
    const room = gameRooms[roomId];
    if (!room) return;
    
    io.to(roomId).emit('gameEnded', { winner });
    console.log(`Game ended in room ${roomId}, winner: Team ${winner}`);
    
    // Reset player ready status for rematch
    room.players.forEach(player => {
      player.ready = false;
    });
    
    io.to(roomId).emit('readyForRematch');
  });

  // Leave room
  socket.on('leaveRoom', ({ roomId }) => {
    leaveRoom(socket, roomId);
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    // Remove from matchmaking queue if present
    const queueIndex = matchmakingQueue.indexOf(socket.id);
    if (queueIndex !== -1) {
      matchmakingQueue.splice(queueIndex, 1);
      console.log(`Removed disconnected player ${socket.id} from matchmaking queue`);
    }
    
    // Find and leave all rooms the socket was in
    Object.keys(gameRooms).forEach(roomId => {
      const room = gameRooms[roomId];
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      
      if (playerIndex !== -1) {
        leaveRoom(socket, roomId);
      } else {
        // Check if was a spectator
        const spectatorIndex = room.spectators.indexOf(socket.id);
        if (spectatorIndex !== -1) {
          room.spectators.splice(spectatorIndex, 1);
          io.to(roomId).emit('spectatorLeft', { spectatorId: socket.id });
        }
      }
    });
  });
});

// Helper function to handle a player leaving a room
function leaveRoom(socket, roomId) {
  const room = gameRooms[roomId];
  if (!room) return;
  
  const playerIndex = room.players.findIndex(p => p.id === socket.id);
  if (playerIndex !== -1) {
    const team = room.players[playerIndex].team;
    room.players.splice(playerIndex, 1);
    
    socket.leave(roomId);
    io.to(roomId).emit('playerLeft', { playerId: socket.id, team });
    console.log(`Player ${socket.id} left room ${roomId}`);
    
    // If no players left, remove the room
    if (room.players.length === 0 && room.spectators.length === 0) {
      delete gameRooms[roomId];
      console.log(`Room ${roomId} removed`);
    }
  }
}

// Start the server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
