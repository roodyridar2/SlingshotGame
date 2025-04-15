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

// Interval to clean up abandoned rooms (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  const abandonedRooms = [];
  
  // Find rooms with no activity for more than 10 minutes
  Object.keys(gameRooms).forEach(roomId => {
    const room = gameRooms[roomId];
    if (room.lastActivity && now - room.lastActivity > 10 * 60 * 1000) {
      abandonedRooms.push(roomId);
    }
  });
  
  // Remove abandoned rooms
  abandonedRooms.forEach(roomId => {
    console.log(`Cleaning up abandoned room: ${roomId}`);
    delete gameRooms[roomId];
  });
}, 5 * 60 * 1000);

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
        lastMove: null,
        lastActivity: Date.now(),
        spectators: [],
        turnTimer: null,
        turnStartTime: null,
        turnTimeLimit: 30 // 30 seconds per turn
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
        
        // Auto-start the game immediately when players are matched
        io.to(roomId).emit('gameStart');
        
        // Start turn timer for Team 1 (first turn)
        startTurnTimer(roomId, 1);
        
        console.log(`Matched players ${player1Id} and ${player2Id} in room ${roomId}`);
        console.log(`Game started in room ${roomId}`);
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
    if (!room) {
      console.log(`Error: Room ${roomId} not found for move`);
      return;
    }
    
    // Validate move data to ensure it has all required fields
    if (!move || !move.playerId) {
      console.log(`Error: Invalid move data in room ${roomId}`);
      return;
    }
    
    // Update last activity timestamp
    room.lastActivity = Date.now();
    room.lastMove = move;
    
    // No need to reset timer here as it will be reset in the gameStateUpdate event
    // when the turn actually changes after the pieces stop moving
    
    // Move contains: playerId, playerPos, direction, power
    socket.to(roomId).emit('opponentMove', { move });
    console.log(`Move in room ${roomId} by player ${socket.id} - Player: ${move.playerId}`);
  });

  // Game state update - only used for critical state synchronization
  socket.on('gameStateUpdate', ({ roomId, gameState }) => {
    const room = gameRooms[roomId];
    if (!room) {
      console.log(`Error: Room ${roomId} not found for state update`);
      return;
    }
    
    // Update room activity time
    room.lastActivity = Date.now();
    
    // Store previous team to check for turn change
    const prevTeam = room.gameState ? room.gameState.currentTeam : null;
    const currentTeam = gameState.currentTeam;
    
    // Store the current game state for potential reconnections
    room.gameState = gameState;
    
    // Reset turn timer if the team has changed
    if (prevTeam !== null && prevTeam !== currentTeam) {
      console.log(`Turn changed from Team ${prevTeam} to Team ${currentTeam} - Resetting timer`);
      startTurnTimer(roomId, currentTeam);
    }
    
    // Send the state update to the other player
    socket.to(roomId).emit('gameStateUpdated', { gameState });
    console.log(`Game state updated in room ${roomId} - Current team: ${gameState.currentTeam}`);
  });

  // Game over
  socket.on('gameOver', ({ roomId, winner }) => {
    const room = gameRooms[roomId];
    if (!room) return;
    
    // Notify all players in the room about the game end and winner
    io.to(roomId).emit('gameEnded', { winner });
    console.log(`Game ended in room ${roomId}, winner: Team ${winner}`);
    
    // Clear turn timer if it exists
    if (room.turnTimer) {
      clearTimeout(room.turnTimer);
      room.turnTimer = null;
    }
    
    // Reset player ready status for potential rematch
    room.players.forEach(player => {
      player.ready = false;
    });
    
    // Reset game state but keep the room and players
    room.gameState = null;
    
    // Inform players they can play again with the 'Main Menu' button
    io.to(roomId).emit('readyForMainMenu');
  });

  // Leave room
  socket.on('leaveRoom', ({ roomId }) => {
    leaveRoom(socket, roomId);
  });

  // Handle player disconnection
  socket.on('disconnect', () => {
    console.log(`Player ${socket.id} disconnected`);
    
    // Find any game rooms where this player was active
    for (const roomId in gameRooms) {
      const room = gameRooms[roomId];
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      
      if (playerIndex !== -1) {
        // Only notify other players about disconnection if a game is in progress
        if (room.gameState) {
          // There's an active game in progress, notify opponents about forfeit
          socket.to(roomId).emit('playerDisconnected');
          
          const leavingPlayer = room.players[playerIndex];
          console.log(`Player ${socket.id} (Team ${leavingPlayer.team}) disconnected during an active game in room ${roomId}`);
        } else {
          // No active game, quietly remove the player
          console.log(`Player ${socket.id} disconnected from room ${roomId} (no active game)`);
        }
        
        // Remove player from room
        room.players.splice(playerIndex, 1);
        
        // If no players left, remove the room
        if (room.players.length === 0) {
          delete gameRooms[roomId];
          console.log(`Room ${roomId} removed due to all players disconnecting`);
        }
      }
    }
    
    // Remove from matchmaking queue if present
    const queueIndex = matchmakingQueue.findIndex(id => id === socket.id);
    if (queueIndex !== -1) {
      matchmakingQueue.splice(queueIndex, 1);
      console.log(`Removed disconnected player ${socket.id} from matchmaking queue`);
    }
  });
});

// Turn timer functions
function startTurnTimer(roomId, currentTeam) {
  const room = gameRooms[roomId];
  if (!room) return;

  // Clear any existing timer
  if (room.turnTimer) {
    clearTimeout(room.turnTimer);
    room.turnTimer = null;
  }

  // Set the turn start time
  room.turnStartTime = Date.now();
  
  // Notify players about the turn start and timer
  io.to(roomId).emit('turnTimerStarted', { team: currentTeam, timeLimit: room.turnTimeLimit });
  
  // Set a new timer
  room.turnTimer = setTimeout(() => {
    // Time's up! Current team loses
    handleTurnTimeout(roomId, currentTeam);
  }, room.turnTimeLimit * 1000);
  
  console.log(`Turn timer started for Team ${currentTeam} in room ${roomId}`);
}

function resetTurnTimer(roomId, nextTeam) {
  // Simply start a new timer for the next team
  startTurnTimer(roomId, nextTeam);
}

function handleTurnTimeout(roomId, currentTeam) {
  const room = gameRooms[roomId];
  if (!room) return;
  
  // The current team ran out of time and loses
  const winnerTeam = currentTeam === 1 ? 2 : 1;
  console.log(`Team ${currentTeam} ran out of time in room ${roomId}. Team ${winnerTeam} wins!`);
  
  // Notify all players in the room about the timeout and game result
  io.to(roomId).emit('turnTimeout', { 
    losingTeam: currentTeam,
    winnerTeam: winnerTeam,
    message: `Team ${currentTeam} ran out of time! Team ${winnerTeam} wins!`
  });
  
  // Game over - winner is the other team
  io.to(roomId).emit('gameEnded', { winner: winnerTeam });
  
  // Clear the timer
  room.turnTimer = null;
  room.turnStartTime = null;
  
  // Reset player ready status for potential rematch
  room.players.forEach(player => {
    player.ready = false;
  });
  
  // Use resetTurnTimer for any rematch to properly reset the timer
  resetTurnTimer(roomId, currentTeam === 1 ? 2 : 1);
  
  io.to(roomId).emit('readyForRematch');
}

// Helper function to handle a player leaving a room
function leaveRoom(socket, roomId) {
  const room = gameRooms[roomId];
  if (!room) return;
  
  const playerIndex = room.players.findIndex(p => p.id === socket.id);
  if (playerIndex !== -1) {
    const leavingPlayer = room.players[playerIndex];
    const leavingTeam = leavingPlayer.team;
    
    // Check if there's an opponent still in the room
    const opponent = room.players.find(p => p.id !== socket.id);
    
    // If game is in progress and there's an opponent, declare opponent as winner
    if (room.gameState && opponent) {
      const winnerTeam = opponent.team;
      console.log(`Player ${socket.id} (Team ${leavingTeam}) left the game. Team ${winnerTeam} wins by forfeit.`);
      
      // Notify the remaining player about the win
      io.to(opponent.id).emit('opponentDisconnected', { 
        winner: winnerTeam,
        message: 'Your opponent disconnected. You win!'
      });
    }
    
    // Remove the player from the room
    room.players.splice(playerIndex, 1);
    socket.leave(roomId);
    io.to(roomId).emit('playerLeft', { playerId: socket.id, team: leavingTeam });
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
