import React, { useState, useRef, useEffect, useCallback } from 'react';

// Import components
import GameMenu from './components/GameMenu';

// Import AI logic
import { calculateAIMove, executeAIMove } from './ai/GameAI';

// Import constants
import {
  PLAYER_SIZE,
  BALL_SIZE,
  MAX_PULL_DISTANCE,
  POWER_FACTOR,
  DAMPING_FACTOR,
  WALL_BOUNCE_FACTOR,
  BALL_COLLISION_BOUNCE_FACTOR,
  MIN_VELOCITY_THRESHOLD,
  ARROW_COLOR,
  ARROW_MAX_WIDTH,
  GOAL_HEIGHT,
  GAME_MODES,
  AI_DIFFICULTY
} from './constants';

// Team and player setup
const initialGameState = (gameMode = GAME_MODES.VS_PLAYER, aiDifficulty = AI_DIFFICULTY.MEDIUM) => {
  const fieldWidth = 600;
  const fieldHeight = 400;
  
  // Soccer ball
  const ball = {
    id: 'ball',
    pos: { x: fieldWidth / 2, y: fieldHeight / 2 },
    vel: { x: 0, y: 0 },
    size: BALL_SIZE,
    color: 'bg-white',
    isPlayer: false,
    team: null
  };
  
  // Team 1 (Red)
  const team1Players = [
    {
      id: 'team1-player1',
      pos: { x: fieldWidth * 0.2, y: fieldHeight * 0.25 },
      vel: { x: 0, y: 0 },
      size: PLAYER_SIZE,
      color: 'bg-red-500',
      isPlayer: true,
      team: 1
    },
    {
      id: 'team1-player2',
      pos: { x: fieldWidth * 0.2, y: fieldHeight * 0.5 },
      vel: { x: 0, y: 0 },
      size: PLAYER_SIZE,
      color: 'bg-red-500',
      isPlayer: true,
      team: 1
    },
    {
      id: 'team1-player3',
      pos: { x: fieldWidth * 0.2, y: fieldHeight * 0.75 },
      vel: { x: 0, y: 0 },
      size: PLAYER_SIZE,
      color: 'bg-red-500',
      isPlayer: true,
      team: 1
    }
  ];
  
  // Team 2 (Blue)
  const team2Players = [
    {
      id: 'team2-player1',
      pos: { x: fieldWidth * 0.8, y: fieldHeight * 0.25 },
      vel: { x: 0, y: 0 },
      size: PLAYER_SIZE,
      color: 'bg-blue-500',
      isPlayer: true,
      team: 2
    },
    {
      id: 'team2-player2',
      pos: { x: fieldWidth * 0.8, y: fieldHeight * 0.5 },
      vel: { x: 0, y: 0 },
      size: PLAYER_SIZE,
      color: 'bg-blue-500',
      isPlayer: true,
      team: 2
    },
    {
      id: 'team2-player3',
      pos: { x: fieldWidth * 0.8, y: fieldHeight * 0.75 },
      vel: { x: 0, y: 0 },
      size: PLAYER_SIZE,
      color: 'bg-blue-500',
      isPlayer: true,
      team: 2
    }
  ];
  
  return {
    balls: [ball, ...team1Players, ...team2Players],
    currentTeam: 1,  // Team 1 starts
    selectedPlayerId: null,  // No player selected initially
    isMoving: false,
    score: { team1: 0, team2: 0 },
    gameMode: gameMode,
    aiDifficulty: aiDifficulty
  };
};

function SoccerStarsGame() {
  // State initialization
  const [showGameModeSelection, setShowGameModeSelection] = useState(true);
  const [gameMode, setGameMode] = useState(GAME_MODES.VS_PLAYER);
  const [aiDifficulty, setAiDifficulty] = useState(AI_DIFFICULTY.MEDIUM);
  const [gameState, setGameState] = useState(() => initialGameState(GAME_MODES.VS_PLAYER, AI_DIFFICULTY.MEDIUM));
  const [isDragging, setIsDragging] = useState(false);
  const [startDragPos, setStartDragPos] = useState({ x: 0, y: 0 });
  const [currentDragPos, setCurrentDragPos] = useState({ x: 0, y: 0 });
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  
  // Refs
  const containerRef = useRef(null);
  const activePlayerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const aiTimeoutRef = useRef(null);
  
  // Get selected player
  const getSelectedPlayer = useCallback(() => {
    return gameState.balls.find(b => b.id === gameState.selectedPlayerId);
  }, [gameState.balls, gameState.selectedPlayerId]);
  
  // Select a player
  const selectPlayer = useCallback((playerId) => {
    if (gameState.isMoving) return;
    
    const player = gameState.balls.find(b => b.id === playerId);
    if (!player || player.team !== gameState.currentTeam) return;
    
    setGameState(prev => ({
      ...prev,
      selectedPlayerId: playerId
    }));
  }, [gameState.isMoving, gameState.currentTeam, gameState.balls]);
  
  // Goal checking is now handled directly in the updatePhysics function
  
  // We don't need a separate function to check if pieces are still
  // as this is now handled directly in the updatePhysics function
  
  // Pointer position helper
  const getPointerPosition = (e) => {
    if (e.touches && e.touches[0]) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  };
  
  // Start interaction (mouse down / touch start)
  const handleInteractionStart = useCallback((e, playerId) => {
    if (gameState.isMoving) return;
    
    const player = gameState.balls.find(b => b.id === playerId);
    if (!player || player.team !== gameState.currentTeam) return;
    
    // Select this player if not already selected
    selectPlayer(playerId);
    
    e.preventDefault();
    const pointerPos = getPointerPosition(e);
    setIsDragging(true);
    setStartDragPos(pointerPos);
    setCurrentDragPos(pointerPos);
    
    // Stop any animations
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, [gameState.isMoving, gameState.currentTeam, selectPlayer, gameState.balls]);
  
  // Move interaction (mouse move / touch move)
  const handleInteractionMove = useCallback((e) => {
    if (!isDragging) return;
    if (e.type === 'touchmove') e.preventDefault();
    const pointerPos = getPointerPosition(e);
    setCurrentDragPos(pointerPos);
  }, [isDragging]);
  
  // End interaction (mouse up / touch end)
  const handleInteractionEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    
    const selectedPlayer = getSelectedPlayer();
    if (!selectedPlayer) return;
    
    const dx = startDragPos.x - currentDragPos.x;
    const dy = startDragPos.y - currentDragPos.y;
    let distance = Math.sqrt(dx * dx + dy * dy);
    distance = Math.min(distance, MAX_PULL_DISTANCE);
    
    if (distance < 5) return;
    
    const angle = Math.atan2(dy, dx);
    const directionX = Math.cos(angle);
    const directionY = Math.sin(angle);
    const initialSpeed = distance * POWER_FACTOR;
    
    setGameState(prev => {
      const newBalls = prev.balls.map(ball => {
        if (ball.id === selectedPlayer.id) {
          return {
            ...ball,
            vel: { 
              x: directionX * initialSpeed, 
              y: directionY * initialSpeed 
            }
          };
        }
        return ball;
      });
      
      return {
        ...prev,
        balls: newBalls,
        isMoving: true
      };
    });
  }, [isDragging, startDragPos, currentDragPos, getSelectedPlayer]);
  
  // Helper function for AI to make a move - using the imported function
  const handleAIMove = useCallback(() => {
    console.log('Handling AI move, current team:', gameState.currentTeam);
    
    if (gameState.currentTeam !== 2 || gameState.isMoving) {
      console.log('Cannot make AI move - not AI turn or pieces are moving');
      setIsAiProcessing(false);
      return;
    }
    
    // Get game constants to pass to AI functions
    const gameConstants = {
      MAX_PULL_DISTANCE,
      POWER_FACTOR,
      MIN_VELOCITY_THRESHOLD
    };
    
    try {
      // Calculate AI move based on current difficulty level
      const aiMove = calculateAIMove(
        gameState,
        aiDifficulty, // Use current difficulty setting
        containerRef,
        selectPlayer,
        gameConstants
      );
      
      if (aiMove) {
        // Execute the calculated AI move
        executeAIMove(aiMove, setGameState, gameConstants);
      } else {
        // Fallback to simple move if no good move found
        const aiPlayer = gameState.balls.find(b => b.isPlayer && b.team === 2);
        if (!aiPlayer) {
          console.error('No AI player found!');
          setIsAiProcessing(false);
          return;
        }
        
        console.log('AI player found:', aiPlayer.id);
        
        // Select a blue player
        selectPlayer(aiPlayer.id);
        
        // Create a direct shot toward the goal
        const directionX = -1; // Shoot left toward red goal
        const directionY = 0;  // Straight shot
        const power = MAX_PULL_DISTANCE * POWER_FACTOR;
        
        console.log('Setting AI velocity:', { x: directionX * power, y: directionY * power });
        
        // Apply the move directly
        setGameState(prev => {
          const newBalls = prev.balls.map(ball => {
            if (ball.id === aiPlayer.id) {
              return {
                ...ball,
                vel: { 
                  x: directionX * power, 
                  y: directionY * power 
                }
              };
            }
            return ball;
          });
          
          return {
            ...prev,
            balls: newBalls,
            isMoving: true
          };
        });
      }
      
      console.log('AI move executed with difficulty:', aiDifficulty);
    } catch (error) {
      console.error('Error executing AI move:', error);
      setIsAiProcessing(false);
    }
  }, [gameState, aiDifficulty, containerRef, selectPlayer, setGameState]);
  
  // Effect to trigger AI move when it's AI's turn
  useEffect(() => {
    // If it's AI's turn and the game is not in motion and AI is not already processing
    if (gameMode === GAME_MODES.VS_AI && 
        gameState.currentTeam === 2 && 
        !gameState.isMoving && 
        !showGameModeSelection &&
        !isAiProcessing) {
      console.log('AI turn detected, preparing to make a move with difficulty:', aiDifficulty);
      
      // Set AI processing flag to prevent multiple calls
      setIsAiProcessing(true);
      
      // Clear any existing timeout
      if (aiTimeoutRef.current) {
        clearTimeout(aiTimeoutRef.current);
        aiTimeoutRef.current = null;
      }
      
      // Execute AI move after a short delay
      aiTimeoutRef.current = setTimeout(() => {
        console.log('Executing AI move now');
        handleAIMove();
      }, 500);
    }
    
    return () => {
      if (aiTimeoutRef.current) {
        clearTimeout(aiTimeoutRef.current);
        aiTimeoutRef.current = null;
      }
    };
  }, [gameMode, gameState.currentTeam, gameState.isMoving, showGameModeSelection, handleAIMove, aiDifficulty, isAiProcessing]);

  // Physics update effect
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    
    const updatePhysics = () => {
      setGameState(prev => {
        if (!prev.isMoving) return prev;
        
        const newBalls = JSON.parse(JSON.stringify(prev.balls));
        const containerWidth = container.offsetWidth;
        const containerHeight = container.offsetHeight;
        const restitution = BALL_COLLISION_BOUNCE_FACTOR;
        let isStillMoving = false;
        
        // Ball-Ball Collision Detection & Response
        for (let i = 0; i < newBalls.length; i++) {
          for (let j = i + 1; j < newBalls.length; j++) {
            const ball1 = newBalls[i];
            const ball2 = newBalls[j];
            const radius1 = ball1.size / 2;
            const radius2 = ball2.size / 2;
            
            const dx = ball2.pos.x - ball1.pos.x;
            const dy = ball2.pos.y - ball1.pos.y;
            const distanceSq = dx * dx + dy * dy;
            const minDistance = radius1 + radius2;
            const minDistanceSq = minDistance * minDistance;
            
            if (distanceSq < minDistanceSq && distanceSq > 0.001) {
              const distance = Math.sqrt(distanceSq);
              
              // Resolve Overlap
              const overlap = minDistance - distance;
              const nx = dx / distance;
              const ny = dy / distance;
              ball1.pos.x -= nx * overlap * 0.5;
              ball1.pos.y -= ny * overlap * 0.5;
              ball2.pos.x += nx * overlap * 0.5;
              ball2.pos.y += ny * overlap * 0.5;
              
              // Calculate Collision Response
              const tx = -ny;
              const ty = nx;
              
              const v1n = ball1.vel.x * nx + ball1.vel.y * ny;
              const v1t = ball1.vel.x * tx + ball1.vel.y * ty;
              const v2n = ball2.vel.x * nx + ball2.vel.y * ny;
              const v2t = ball2.vel.x * tx + ball2.vel.y * ty;
              
              const new_v1n = (v1n * (1 - restitution) + 2 * restitution * v2n) / 2;
              const new_v2n = (v2n * (1 - restitution) + 2 * restitution * v1n) / 2;
              
              const new_v1t = v1t;
              const new_v2t = v2t;
              
              ball1.vel.x = (new_v1n * nx) + (new_v1t * tx);
              ball1.vel.y = (new_v1n * ny) + (new_v1t * ty);
              ball2.vel.x = (new_v2n * nx) + (new_v2t * tx);
              ball2.vel.y = (new_v2n * ny) + (new_v2t * ty);
            }
          }
        }
        
        // Update Position, Wall Collision, Damping
        for (let i = 0; i < newBalls.length; i++) {
          const ball = newBalls[i];
          const radius = ball.size / 2;
          
          // Update position
          ball.pos.x += ball.vel.x;
          ball.pos.y += ball.vel.y;
          
          // Wall collision (with special goal areas)
          const goalY = containerHeight / 2;
          const halfGoalHeight = GOAL_HEIGHT / 2;
          
          // Left wall with goal opening
          if (ball.pos.x - radius < 0) {
            if (ball.pos.y < goalY - halfGoalHeight || 
                ball.pos.y > goalY + halfGoalHeight) {
              ball.pos.x = radius;
              ball.vel.x = -ball.vel.x * WALL_BOUNCE_FACTOR;
            }
          }
          
          // Right wall with goal opening
          if (ball.pos.x + radius > containerWidth) {
            if (ball.pos.y < goalY - halfGoalHeight || 
                ball.pos.y > goalY + halfGoalHeight) {
              ball.pos.x = containerWidth - radius;
              ball.vel.x = -ball.vel.x * WALL_BOUNCE_FACTOR;
            }
          }
          
          // Top and bottom walls (no goals)
          if (ball.pos.y - radius < 0) {
            ball.pos.y = radius;
            ball.vel.y = -ball.vel.y * WALL_BOUNCE_FACTOR;
          }
          if (ball.pos.y + radius > containerHeight) {
            ball.pos.y = containerHeight - radius;
            ball.vel.y = -ball.vel.y * WALL_BOUNCE_FACTOR;
          }
          
          // Ensure pieces don't go out of bounds (especially for blue pieces)
          if (ball.isPlayer) {
            // Ensure x is within bounds
            ball.pos.x = Math.max(radius, Math.min(containerWidth - radius, ball.pos.x));
            // Ensure y is within bounds
            ball.pos.y = Math.max(radius, Math.min(containerHeight - radius, ball.pos.y));
          }
          
          // Damping
          ball.vel.x *= DAMPING_FACTOR;
          ball.vel.y *= DAMPING_FACTOR;
          
          // Check movement
          if (Math.abs(ball.vel.x) > MIN_VELOCITY_THRESHOLD || Math.abs(ball.vel.y) > MIN_VELOCITY_THRESHOLD) {
            isStillMoving = true;
          } else {
            ball.vel.x = 0;
            ball.vel.y = 0;
          }
        }
        
        // Check for goals (continuously during gameplay)
        const ball = newBalls.find(b => b.id === 'ball');
        const goalY = containerHeight / 2;
        const halfGoalHeight = GOAL_HEIGHT / 2;
        let newScore = {...prev.score};
        let goalScored = false;
        
        // Check if ball is in left goal (team 2 scores)
        if (ball.id === 'ball' && 
            ball.pos.x < 10 && 
            ball.pos.y > goalY - halfGoalHeight && 
            ball.pos.y < goalY + halfGoalHeight) {
          newScore.team2 += 1;
          goalScored = true;
          console.log('Goal scored by Team 2 (Blue)!');
        }
        
        // Check if ball is in right goal (team 1 scores)
        if (ball.id === 'ball' && 
            ball.pos.x > containerWidth - 10 && 
            ball.pos.y > goalY - halfGoalHeight && 
            ball.pos.y < goalY + halfGoalHeight) {
          newScore.team1 += 1;
          goalScored = true;
          console.log('Goal scored by Team 1 (Red)!');
        }
        
        if (goalScored) {
          // Reset the game with updated score if goal scored
          const initialState = initialGameState(prev.gameMode, prev.aiDifficulty);
          return {
            ...initialState,
            score: newScore,
            gameMode: prev.gameMode,
            aiDifficulty: prev.aiDifficulty
          };
        }
        
        // If pieces have stopped moving, change the turn
        const shouldChangeTurn = prev.isMoving && !isStillMoving;
        
        if (shouldChangeTurn) {
          // Reset AI processing flag when turn changes
          if (prev.currentTeam === 2) {
            setIsAiProcessing(false);
          }
          
          return {
            ...prev,
            balls: newBalls,
            isMoving: false,
            // Change turn when movement stops
            currentTeam: prev.currentTeam === 1 ? 2 : 1,
            // Clear selected player when turn changes
            selectedPlayerId: null
          };
        } else {
          return {
            ...prev,
            balls: newBalls,
            isMoving: isStillMoving
          };
        }
      });
      
      animationFrameRef.current = requestAnimationFrame(updatePhysics);
    };
    
    if (gameState.isMoving && !animationFrameRef.current) {
      animationFrameRef.current = requestAnimationFrame(updatePhysics);
    } else if (!gameState.isMoving && animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [gameState.isMoving]);
  
  // Effect for global interaction listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleInteractionMove);
      window.addEventListener('touchmove', handleInteractionMove, { passive: false });
      window.addEventListener('mouseup', handleInteractionEnd);
      window.addEventListener('touchend', handleInteractionEnd);
      window.addEventListener('mouseleave', handleInteractionEnd);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleInteractionMove);
      window.removeEventListener('touchmove', handleInteractionMove);
      window.removeEventListener('mouseup', handleInteractionEnd);
      window.removeEventListener('touchend', handleInteractionEnd);
      window.removeEventListener('mouseleave', handleInteractionEnd);
    };
  }, [isDragging, handleInteractionMove, handleInteractionEnd]);
  
  // Arrow display for shooting
  const getArrowStyle = () => {
    const selectedPlayer = getSelectedPlayer();
    
    if (!isDragging || !selectedPlayer || !containerRef.current) return { display: 'none' };
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const startRelativeX = startDragPos.x - containerRect.left;
    const startRelativeY = startDragPos.y - containerRect.top;
    const currentRelativeX = currentDragPos.x - containerRect.left;
    const currentRelativeY = currentDragPos.y - containerRect.top;
    
    const launchVectorX = startRelativeX - currentRelativeX;
    const launchVectorY = startRelativeY - currentRelativeY;
    let pullDistance = Math.sqrt(launchVectorX * launchVectorX + launchVectorY * launchVectorY);
    const launchAngleRad = Math.atan2(launchVectorY, launchVectorX);
    const launchAngleDeg = launchAngleRad * (180 / Math.PI);
    
    const clampedDistance = Math.min(pullDistance, MAX_PULL_DISTANCE);
    if (clampedDistance < 5) return { display: 'none' };
    
    const arrowLength = clampedDistance;
    const arrowWidth = Math.min(ARROW_MAX_WIDTH, Math.max(2, clampedDistance / 15));
    
    return {
      position: 'absolute',
      left: `${selectedPlayer.pos.x}px`,
      top: `${selectedPlayer.pos.y}px`,
      transformOrigin: 'left center',
      transform: `translateY(-50%) rotate(${launchAngleDeg}deg)`,
      width: `${arrowLength}px`,
      height: `${arrowWidth}px`,
      backgroundColor: ARROW_COLOR,
      borderRadius: `${arrowWidth / 2}px`,
      pointerEvents: 'none',
      zIndex: 100
    };
  };
  
  // Restart game
  const handleRestart = () => {
    setGameState(initialGameState(gameMode, aiDifficulty));
  };
  
  // Start a new game with selected mode
  const startGame = (mode, difficulty = AI_DIFFICULTY.MEDIUM) => {
    setGameMode(mode);
    setAiDifficulty(difficulty);
    setGameState(initialGameState(mode, difficulty));
    setShowGameModeSelection(false);
    setIsAiProcessing(false); // Reset AI processing state when starting a new game
  };
  
  // Return to game mode selection
  const returnToModeSelection = () => {
    setShowGameModeSelection(true);
    // Clear any pending AI moves
    if (aiTimeoutRef.current) {
      clearTimeout(aiTimeoutRef.current);
      aiTimeoutRef.current = null;
    }
  };
  

  
  // This has been moved up before the return statement
  
  // Get selected player for rendering (used in the component)
  
  return (
    <div className="flex flex-col justify-center items-center h-screen bg-gray-800 p-4">
      {showGameModeSelection ? (
        <GameMenu
          aiDifficulty={aiDifficulty}
          startGame={startGame}
        />
      ) : (
        <>
          <div className="mb-4 w-full max-w-[600px] flex justify-between items-center text-white">
            <div className="text-red-500 font-bold text-xl">Red: {gameState.score.team1}</div>
            <div className="bg-gray-600 px-4 py-2 rounded-lg">
              {gameState.isMoving ? (
                <span>Balls in motion...</span>
              ) : (
                <span>
                  {gameState.currentTeam === 1 ? "🔴 Red" : "🔵 Blue"}'s turn
                  {gameState.currentTeam === 2 && gameMode === GAME_MODES.VS_AI ? " (AI)" : ""}
                  {!gameState.selectedPlayerId && gameState.currentTeam === 1 && " - Select a player"}
                </span>
              )}
            </div>
            <div className="text-blue-500 font-bold text-xl">Blue: {gameState.score.team2}</div>
          </div>
          
          <div 
            ref={containerRef} 
            className="relative w-full max-w-[600px] h-[400px] bg-green-800 border-4 border-gray-400 rounded-lg overflow-hidden cursor-default"
            style={{ touchAction: 'none' }}
          >
        {/* Field markings */}
        <div className="absolute top-0 left-0 w-full h-full">
          {/* Center circle */}
          <div className="absolute top-1/2 left-1/2 w-24 h-24 border-2 border-white rounded-full opacity-50" style={{ transform: 'translate(-50%, -50%)' }}></div>
          {/* Center line */}
          <div className="absolute top-0 left-1/2 h-full w-0.5 bg-white opacity-50" style={{ transform: 'translateX(-50%)' }}></div>
          
          {/* Left goal */}
          <div className="absolute top-1/2 left-0 w-2 h-24 bg-gray-200" style={{ transform: 'translateY(-50%)' }}></div>
          {/* Right goal */}
          <div className="absolute top-1/2 right-0 w-2 h-24 bg-gray-200" style={{ transform: 'translateY(-50%)' }}></div>
        </div>
        
        {/* Players and ball */}
        {gameState.balls.map(ball => {
          const isCurrentTeamPlayer = ball.isPlayer && ball.team === gameState.currentTeam;
          const isSelected = ball.id === gameState.selectedPlayerId;
          
          return (
            <div 
              key={ball.id}
              ref={isSelected ? activePlayerRef : null}
              className={`absolute ${ball.color} rounded-full select-none flex items-center justify-center 
                        ${!gameState.isMoving && isCurrentTeamPlayer ? 'hover:ring-2 hover:ring-yellow-300' : ''}
                        ${isSelected ? 'ring-2 ring-yellow-300' : ''}`}
              style={{
                width: `${ball.size}px`,
                height: `${ball.size}px`,
                left: `${ball.pos.x}px`,
                top: `${ball.pos.y}px`,
                transform: 'translate(-50%, -50%)',
                touchAction: 'none',
                zIndex: ball.id === 'ball' ? 5 : 10,
                cursor: !gameState.isMoving && isCurrentTeamPlayer ? 'pointer' : 'default',
                opacity: !gameState.isMoving && isCurrentTeamPlayer ? 1 : 0.8
              }}
              onMouseDown={!gameState.isMoving && isCurrentTeamPlayer ? 
                (e) => handleInteractionStart(e, ball.id) : undefined}
              onTouchStart={!gameState.isMoving && isCurrentTeamPlayer ? 
                (e) => handleInteractionStart(e, ball.id) : undefined}
              onClick={!gameState.isMoving && isCurrentTeamPlayer ? 
                () => selectPlayer(ball.id) : undefined}
            >
              {ball.id === 'ball' ? '⚽' : ''}
            </div>
          );
        })}
        
        {/* Shooting arrow */}
        {isDragging && <div style={getArrowStyle()}></div>}
        
        {/* Game control buttons */}
        <div className="absolute bottom-4 right-4 flex space-x-2">
          <button 
            className="bg-gray-700 text-white px-3 py-1 rounded-md hover:bg-gray-600"
            onClick={returnToModeSelection}
          >
            Menu
          </button>
          <button 
            className="bg-gray-700 text-white px-3 py-1 rounded-md hover:bg-gray-600"
            onClick={handleRestart}
          >
            Restart
          </button>
        </div>
        
        {/* AI Difficulty Controls (only shown in VS_AI mode) */}
        {gameMode === GAME_MODES.VS_AI && (
          <div className="absolute bottom-4 left-4 flex items-center">
            <div className="flex space-x-1">
              <button 
                className={`px-2 py-1 text-xs rounded-md ${aiDifficulty === AI_DIFFICULTY.EASY ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-white hover:bg-gray-600'}`}
                onClick={() => setAiDifficulty(AI_DIFFICULTY.EASY)}
              >
                Easy
              </button>
              <button 
                className={`px-2 py-1 text-xs rounded-md ${aiDifficulty === AI_DIFFICULTY.MEDIUM ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-white hover:bg-gray-600'}`}
                onClick={() => setAiDifficulty(AI_DIFFICULTY.MEDIUM)}
              >
                Medium
              </button>
              <button 
                className={`px-2 py-1 text-xs rounded-md ${aiDifficulty === AI_DIFFICULTY.HARD ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-white hover:bg-gray-600'}`}
                onClick={() => setAiDifficulty(AI_DIFFICULTY.HARD)}
              >
                Hard
              </button>
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-4 text-white text-center">
        <p>
          {gameMode === GAME_MODES.VS_PLAYER
            ? "Click on any of your team players to select, then drag to shoot. Take turns to score in the opponent's goal."
            : "You play as Red. Click on any of your players to select, then drag to shoot. The AI plays as Blue."}
        </p>
        {gameMode === GAME_MODES.VS_AI && (
          <p className="mt-2 text-sm text-gray-400">AI Difficulty: {aiDifficulty}</p>
        )}
      </div>
    </>
    )}
  </div>
  );
}

export default SoccerStarsGame;