import React, { useState, useRef, useEffect, useCallback } from "react";

// Import components
import GameMenu from "./components/GameMenu";
import MultiplayerMenu from "./components/MultiplayerMenu";
import WaitingRoom from "./components/WaitingRoom";
import MatchmakingQueue from "./components/MatchmakingQueue";

// Import AI logic
import { calculateAIMove, executeAIMove } from "./ai/GameAI";

// Import Socket.IO service
import {
  initializeSocket,
  disconnectSocket,
  registerCallbacks,
  leaveRoom,
  joinMatchmaking,
  leaveMatchmaking,
  setPlayerReady as socketSetPlayerReady,
  sendGameMove,
  updateGameState,
  sendGameOver,
  getSocketId
} from "./services/socketService";

// Import game images
import fieldImage from "./assets/images/field.png";
import playerImage from "./assets/images/player.png";
import opponentImage from "./assets/images/opponent.png";
import ballImage from "./assets/images/ball.png";

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
  AI_DIFFICULTY,
  DEFAULT_AI_DIFFICULTY,
  AI_POWER_SCALING_FACTOR,
} from "./constants";

// Team and player setup
const initialGameState = (gameMode = GAME_MODES.VS_PLAYER) => {
  // Vertical field for mobile - swap width and height
  const fieldWidth = 400;
  const fieldHeight = 600;

  // Soccer ball
  const ball = {
    id: "ball",
    pos: { x: fieldWidth / 2, y: fieldHeight / 2 },
    vel: { x: 0, y: 0 },
    size: BALL_SIZE,
    color: "bg-white",
    isPlayer: false,
    team: null,
  };

  // Team 1 (Red) - Now at the bottom of the field
  const team1Players = [
    {
      id: "team1-player1",
      pos: { x: fieldWidth * 0.25, y: fieldHeight * 0.8 },
      vel: { x: 0, y: 0 },
      size: PLAYER_SIZE,
      color: "bg-red-500",
      isPlayer: true,
      team: 1,
    },
    {
      id: "team1-player2",
      pos: { x: fieldWidth * 0.5, y: fieldHeight * 0.8 },
      vel: { x: 0, y: 0 },
      size: PLAYER_SIZE,
      color: "bg-red-500",
      isPlayer: true,
      team: 1,
    },
    {
      id: "team1-player3",
      pos: { x: fieldWidth * 0.75, y: fieldHeight * 0.8 },
      vel: { x: 0, y: 0 },
      size: PLAYER_SIZE,
      color: "bg-red-500",
      isPlayer: true,
      team: 1,
    },
  ];

  // Team 2 (Blue) - Now at the top of the field
  const team2Players = [
    {
      id: "team2-player1",
      pos: { x: fieldWidth * 0.25, y: fieldHeight * 0.2 },
      vel: { x: 0, y: 0 },
      size: PLAYER_SIZE,
      color: "bg-blue-500",
      isPlayer: true,
      team: 2,
    },
    {
      id: "team2-player2",
      pos: { x: fieldWidth * 0.5, y: fieldHeight * 0.2 },
      vel: { x: 0, y: 0 },
      size: PLAYER_SIZE,
      color: "bg-blue-500",
      isPlayer: true,
      team: 2,
    },
    {
      id: "team2-player3",
      pos: { x: fieldWidth * 0.75, y: fieldHeight * 0.2 },
      vel: { x: 0, y: 0 },
      size: PLAYER_SIZE,
      color: "bg-blue-500",
      isPlayer: true,
      team: 2,
    },
  ];

  return {
    balls: [ball, ...team1Players, ...team2Players],
    currentTeam: 1, // Team 1 starts
    selectedPlayerId: null, // No player selected initially
    isMoving: false,
    score: { team1: 0, team2: 0 },
    gameMode: gameMode,
    aiDifficulty: AI_DIFFICULTY.HARD,
  };
};

function SoccerStarsGame() {
  // State initialization
  const [showGameModeSelection, setShowGameModeSelection] = useState(true);
  const [gameMode, setGameMode] = useState(GAME_MODES.VS_PLAYER);
  // Always use hard difficulty
  const [aiDifficulty] = useState(AI_DIFFICULTY.HARD);
  const [gameState, setGameState] = useState(() =>
    initialGameState(GAME_MODES.VS_PLAYER)
  );
  
  // Turn timer state
  const [turnTimeLeft, setTurnTimeLeft] = useState(null);
  const [turnTimeLimit, setTurnTimeLimit] = useState(30); // 30 seconds per turn by default
  const turnTimerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startDragPos, setStartDragPos] = useState({ x: 0, y: 0 });
  const [currentDragPos, setCurrentDragPos] = useState({ x: 0, y: 0 });
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [cameraShake, setCameraShake] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  
  // Online multiplayer states
  const [showMultiplayerMenu, setShowMultiplayerMenu] = useState(false);
  const [showWaitingRoom, setShowWaitingRoom] = useState(false);
  const [showMatchmakingQueue, setShowMatchmakingQueue] = useState(false);
  const [roomId, setRoomId] = useState(null);
  // Socket ID and player role for online play
  const [playerId, setPlayerId] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [playerTeam, setPlayerTeam] = useState(1);
  const [playerReady, setPlayerReady] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);
  const [isOnlineGameStarted, setIsOnlineGameStarted] = useState(false);
  const [isMyTurn, setIsMyTurn] = useState(true); // For online mode
  const [disconnectMessage, setDisconnectMessage] = useState(null); // For forfeit messages
  const [showNotification, setShowNotification] = useState(false); // For notifications
  const [notificationMessage, setNotificationMessage] = useState(''); // Notification message

  // Refs
  const containerRef = useRef(null);
  const activePlayerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const aiTimeoutRef = useRef(null);
  
  // Reset camera shake after a delay
  useEffect(() => {
    if (cameraShake) {
      const timer = setTimeout(() => {
        setCameraShake(false);
      }, 500); // 500ms shake duration
      return () => clearTimeout(timer);
    }
  }, [cameraShake]);

  // Get selected player
  const getSelectedPlayer = useCallback(() => {
    return gameState.balls.find((b) => b.id === gameState.selectedPlayerId);
  }, [gameState.balls, gameState.selectedPlayerId]);

  // Select a player
  const selectPlayer = useCallback(
    (playerId) => {
      if (gameState.isMoving) return;

      const player = gameState.balls.find((b) => b.id === playerId);
      
      // For online mode, check if the player belongs to the player's assigned team
      if (gameMode === GAME_MODES.ONLINE) {
        // Only allow selecting pieces from your assigned team (playerTeam)
        if (!player || player.team !== playerTeam || player.team !== gameState.currentTeam) return;
      } else {
        // For local modes, just check if it's the current team's turn
        if (!player || player.team !== gameState.currentTeam) return;
      }

      setGameState((prev) => ({
        ...prev,
        selectedPlayerId: playerId,
      }));
    },
    [gameState.isMoving, gameState.currentTeam, gameState.balls, gameMode, playerTeam]
  );

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
  const handleInteractionStart = useCallback(
    (e, playerId) => {
      if (gameState.isMoving) return;

      const player = gameState.balls.find((b) => b.id === playerId);
      
      // For online mode, check if the player belongs to the player's assigned team
      if (gameMode === GAME_MODES.ONLINE) {
        // Only allow selecting pieces from your assigned team (playerTeam)
        if (!player || player.team !== playerTeam || player.team !== gameState.currentTeam) return;
      } else {
        // For local modes, just check if it's the current team's turn
        if (!player || player.team !== gameState.currentTeam) return;
      }

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
    },
    [gameState.isMoving, gameState.currentTeam, selectPlayer, gameState.balls]
  );

  // Move interaction (mouse move / touch move)
  const handleInteractionMove = useCallback(
    (e) => {
      if (!isDragging) return;
      if (e.type === "touchmove") e.preventDefault();
      const pointerPos = getPointerPosition(e);
      setCurrentDragPos(pointerPos);
    },
    [isDragging]
  );

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

    setGameState((prev) => {
      const newBalls = prev.balls.map((ball) => {
        if (ball.id === selectedPlayer.id) {
          return {
            ...ball,
            vel: {
              x: directionX * initialSpeed,
              y: directionY * initialSpeed,
            },
          };
        }
        return ball;
      });

      // For online mode, send the detailed move to the opponent
      if (gameMode === GAME_MODES.ONLINE && isMyTurn) {
        const move = {
          playerId: selectedPlayer.id,
          playerPos: { ...selectedPlayer.pos }, // Exact position of the player
          direction: { x: directionX, y: directionY }, // Normalized direction vector
          power: initialSpeed // Power scalar
        };
        
        sendGameMove(roomId, move);
        setIsMyTurn(false); // Switch turns
      }

      return {
        ...prev,
        balls: newBalls,
        isMoving: true,
      };
    });
  }, [isDragging, startDragPos, currentDragPos, getSelectedPlayer, gameMode, isMyTurn, roomId]);

  // Helper function for AI to make a move - using the imported function
  const handleAIMove = useCallback(() => {
    console.log("Handling AI move, current team:", gameState.currentTeam);

    if (gameState.currentTeam !== 2 || gameState.isMoving) {
      console.log("Cannot make AI move - not AI turn or pieces are moving");
      setIsAiProcessing(false);
      return;
    }

    try {
      // Calculate AI move based on current difficulty level
      const aiMove = calculateAIMove(
        gameState,
        aiDifficulty, // Use current difficulty setting
        containerRef,
        selectPlayer
      );

      if (aiMove) {
        // Execute the calculated AI move
        executeAIMove(aiMove, setGameState);
        setIsAiProcessing(false); // Reset flag after successful execution
      } else {
        // Fallback to simple move if no good move found
        const aiPlayer = gameState.balls.find(
          (b) => b.isPlayer && b.team === 2
        );
        if (!aiPlayer) {
          console.error("No AI player found!");
          setIsAiProcessing(false);
          return;
        }

        console.log("AI player found:", aiPlayer.id);

        // Select a blue player
        selectPlayer(aiPlayer.id);

        // Create a direct shot toward the goal
        const directionX = -1; // Shoot left toward red goal
        const directionY = 0; // Straight shot
        const basePower = MAX_PULL_DISTANCE * POWER_FACTOR;
        const finalPower = basePower * AI_POWER_SCALING_FACTOR;

        console.log("Setting AI fallback velocity:", {
          x: directionX * finalPower,
          y: directionY * finalPower,
        });

        // Apply the move directly
        setGameState((prev) => {
          const newBalls = prev.balls.map((ball) => {
            if (ball.id === aiPlayer.id) {
              return {
                ...ball,
                vel: {
                  x: directionX * finalPower,
                  y: directionY * finalPower,
                },
              };
            }
            return ball;
          });

          return {
            ...prev,
            balls: newBalls,
            isMoving: true,
          };
        });
        setIsAiProcessing(false); // Reset flag after successful execution
      }

      console.log("AI move executed with difficulty:", aiDifficulty);
    } catch (error) {
      console.error("Error executing AI move:", error);
      setIsAiProcessing(false);
    }
  }, [gameState, aiDifficulty, containerRef, selectPlayer, setGameState]);

  // Effect to trigger AI move when it's AI's turn
  useEffect(() => {
    // If it's AI's turn and the game is not in motion and AI is not already processing
    if (
      gameMode === GAME_MODES.VS_AI &&
      gameState.currentTeam === 2 &&
      !gameState.isMoving &&
      !showGameModeSelection &&
      !isAiProcessing
    ) {
      // Restore the check here
      console.log(
        "AI turn detected, preparing to make a move with difficulty:",
        aiDifficulty
      );

      // Set AI processing flag to prevent multiple calls
      setIsAiProcessing(true);

      // Clear any existing timeout
      if (aiTimeoutRef.current) {
        clearTimeout(aiTimeoutRef.current);
        aiTimeoutRef.current = null;
      }

      // Execute AI move after a short delay
      aiTimeoutRef.current = setTimeout(() => {
        console.log("Executing AI move now");
        handleAIMove();
      }, 500);
    }

    return () => {
      if (aiTimeoutRef.current) {
        clearTimeout(aiTimeoutRef.current);
        aiTimeoutRef.current = null;
      }
    };
  }, [
    gameMode,
    gameState.currentTeam,
    gameState.isMoving,
    showGameModeSelection,
    handleAIMove,
    aiDifficulty,
    isAiProcessing,
  ]);

  // Physics update effect
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    // Don't run physics updates if we're in game mode selection
    if (showGameModeSelection) return;
    
    console.log("Physics update effect triggered, isMoving:", gameState.isMoving);

    const updatePhysics = () => {
      setGameState((prev) => {
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

              const new_v1n =
                (v1n * (1 - restitution) + 2 * restitution * v2n) / 2;
              const new_v2n =
                (v2n * (1 - restitution) + 2 * restitution * v1n) / 2;

              const new_v1t = v1t;
              const new_v2t = v2t;

              ball1.vel.x = new_v1n * nx + new_v1t * tx;
              ball1.vel.y = new_v1n * ny + new_v1t * ty;
              ball2.vel.x = new_v2n * nx + new_v2t * tx;
              ball2.vel.y = new_v2n * ny + new_v2t * ty;
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

          // Wall collision (with special goal areas) - Rotated 90 degrees
          const goalX = containerWidth / 2;
          const halfGoalWidth = GOAL_HEIGHT / 2; // Using GOAL_HEIGHT as the width now

          // Top wall with goal opening
          if (ball.pos.y - radius < 0) {
            if (
              ball.pos.x < goalX - halfGoalWidth ||
              ball.pos.x > goalX + halfGoalWidth
            ) {
              ball.pos.y = radius;
              ball.vel.y = -ball.vel.y * WALL_BOUNCE_FACTOR;
            } else if (ball.isPlayer) {
              // Apply bounce for players hitting the goal area
              ball.pos.y = radius;
              ball.vel.y = -ball.vel.y * WALL_BOUNCE_FACTOR;
            }
          }

          // Bottom wall with goal opening
          if (ball.pos.y + radius > containerHeight) {
            if (
              ball.pos.x < goalX - halfGoalWidth ||
              ball.pos.x > goalX + halfGoalWidth
            ) {
              ball.pos.y = containerHeight - radius;
              ball.vel.y = -ball.vel.y * WALL_BOUNCE_FACTOR;
            } else if (ball.isPlayer) {
              // Apply bounce for players hitting the goal area
              ball.pos.y = containerHeight - radius;
              ball.vel.y = -ball.vel.y * WALL_BOUNCE_FACTOR;
            }
          }

          // Left and right walls (no goals)
          if (ball.pos.x - radius < 0) {
            ball.pos.x = radius;
            ball.vel.x = -ball.vel.x * WALL_BOUNCE_FACTOR;
          }
          if (ball.pos.x + radius > containerWidth) {
            ball.pos.x = containerWidth - radius;
            ball.vel.x = -ball.vel.x * WALL_BOUNCE_FACTOR;
          }

          // Ensure pieces don't go out of bounds (especially for blue pieces)
          if (ball.isPlayer) {
            // Ensure x is within bounds
            ball.pos.x = Math.max(
              radius,
              Math.min(containerWidth - radius, ball.pos.x)
            );
            // Ensure y is within bounds
            ball.pos.y = Math.max(
              radius,
              Math.min(containerHeight - radius, ball.pos.y)
            );
          }

          // Damping
          ball.vel.x *= DAMPING_FACTOR;
          ball.vel.y *= DAMPING_FACTOR;

          // Check movement
          if (
            Math.abs(ball.vel.x) > MIN_VELOCITY_THRESHOLD ||
            Math.abs(ball.vel.y) > MIN_VELOCITY_THRESHOLD
          ) {
            isStillMoving = true;
          } else {
            ball.vel.x = 0;
            ball.vel.y = 0;
          }
        }

        // Check for goals (continuously during gameplay)
        const ball = newBalls.find((b) => b.id === "ball");
        const goalX = containerWidth / 2;
        const halfGoalWidth = GOAL_HEIGHT / 2;
        let newScore = { ...prev.score };
        let goalScored = false;

        // Check if ball is in top goal (team 2 scores) - Rotated 90 degrees
        if (
          ball.id === "ball" &&
          ball.pos.y < 10 &&
          ball.pos.x > goalX - halfGoalWidth &&
          ball.pos.x < goalX + halfGoalWidth
        ) {
          newScore.team2 += 1;
          goalScored = true;
          console.log("Goal scored by Team 2 (Blue)!");
        }

        // Check if ball is in bottom goal (team 1 scores) - Rotated 90 degrees
        if (
          ball.id === "ball" &&
          ball.pos.y > containerHeight - 10 &&
          ball.pos.x > goalX - halfGoalWidth &&
          ball.pos.x < goalX + halfGoalWidth
        ) {
          newScore.team1 += 1;
          goalScored = true;
          console.log("Goal scored by Team 1 (Red)!");
        }

        if (goalScored) {
          // Trigger camera shake animation
          setCameraShake(true);
          
          // Check if either team has reached 3 goals
          if (newScore.team1 >= 3 || newScore.team2 >= 3) {
            // Game over - set winner
            setGameOver(true);
            setWinner(newScore.team1 >= 3 ? 1 : 2);
            
            // For online mode, notify opponent about game over
            if (gameMode === GAME_MODES.ONLINE) {
              sendGameOver(roomId, newScore.team1 >= 3 ? 1 : 2);
            }
          }
          
          // Reset the game with updated score if goal scored
          const initialState = initialGameState(prev.gameMode);
          const updatedState = {
            ...initialState,
            score: newScore,
            gameMode: prev.gameMode,
            aiDifficulty: prev.aiDifficulty,
          };
          
          // For online mode, explicitly send the updated game state to opponent after a goal
          if (gameMode === GAME_MODES.ONLINE) {
            console.log('Goal scored in online mode - syncing game state');
            updateGameState(roomId, updatedState);
          }
          
          return updatedState;
        }

        // If pieces have stopped moving, change the turn
        const shouldChangeTurn = prev.isMoving && !isStillMoving;

        if (shouldChangeTurn) {
          // Reset AI processing flag when turn changes
          if (prev.currentTeam === 2) {
            setIsAiProcessing(false);
          }
          
          // For online mode, update turn state and send game state to opponent
          if (gameMode === GAME_MODES.ONLINE) {
            // It's my turn if the current team is my team
            const nextTeam = prev.currentTeam === 1 ? 2 : 1;
            setIsMyTurn(nextTeam === playerTeam);
            
            // Send updated game state to opponent
            const updatedState = {
              ...prev,
              balls: newBalls,
              isMoving: false,
              currentTeam: nextTeam,
              selectedPlayerId: null,
            };
            
            updateGameState(roomId, updatedState);
            return updatedState;
          }

          return {
            ...prev,
            balls: newBalls,
            isMoving: false,
            // Change turn when movement stops
            currentTeam: prev.currentTeam === 1 ? 2 : 1,
            // Clear selected player when turn changes
            selectedPlayerId: null,
          };
        } else {
          return {
            ...prev,
            balls: newBalls,
            isMoving: isStillMoving,
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
  }, [gameState.isMoving, showGameModeSelection, gameMode, playerTeam, roomId]);

  // Effect for global interaction listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleInteractionMove);
      window.addEventListener("touchmove", handleInteractionMove, {
        passive: false,
      });
      window.addEventListener("mouseup", handleInteractionEnd);
      window.addEventListener("touchend", handleInteractionEnd);
      window.addEventListener("mouseleave", handleInteractionEnd);
    }

    return () => {
      window.removeEventListener("mousemove", handleInteractionMove);
      window.removeEventListener("touchmove", handleInteractionMove);
      window.removeEventListener("mouseup", handleInteractionEnd);
      window.removeEventListener("touchend", handleInteractionEnd);
      window.removeEventListener("mouseleave", handleInteractionEnd);
    };
  }, [isDragging, handleInteractionMove, handleInteractionEnd]);
  
  // Debug effect to log when isMoving changes
  useEffect(() => {
    if (gameMode === GAME_MODES.ONLINE) {
      console.log("isMoving changed to:", gameState.isMoving);
    }
  }, [gameState.isMoving, gameMode]);

  // Arrow display for shooting
  const getArrowStyle = () => {
    const selectedPlayer = getSelectedPlayer();

    if (!isDragging || !selectedPlayer || !containerRef.current)
      return { display: "none" };

    const containerRect = containerRef.current.getBoundingClientRect();
    const startRelativeX = startDragPos.x - containerRect.left;
    const startRelativeY = startDragPos.y - containerRect.top;
    const currentRelativeX = currentDragPos.x - containerRect.left;
    const currentRelativeY = currentDragPos.y - containerRect.top;

    const launchVectorX = startRelativeX - currentRelativeX;
    const launchVectorY = startRelativeY - currentRelativeY;
    let pullDistance = Math.sqrt(
      launchVectorX * launchVectorX + launchVectorY * launchVectorY
    );
    const launchAngleRad = Math.atan2(launchVectorY, launchVectorX);
    const launchAngleDeg = launchAngleRad * (180 / Math.PI);

    const clampedDistance = Math.min(pullDistance, MAX_PULL_DISTANCE);
    if (clampedDistance < 5) return { display: "none" };

    const arrowLength = clampedDistance;
    const arrowWidth = Math.min(
      ARROW_MAX_WIDTH,
      Math.max(2, clampedDistance / 15)
    );

    return {
      position: "absolute",
      left: `${selectedPlayer.pos.x}px`,
      top: `${selectedPlayer.pos.y}px`,
      transformOrigin: "left center",
      transform: `translateY(-50%) rotate(${launchAngleDeg}deg)`,
      width: `${arrowLength}px`,
      height: `${arrowWidth}px`,
      backgroundColor: ARROW_COLOR,
      borderRadius: `${arrowWidth / 2}px`,
      pointerEvents: "none",
      zIndex: 100,
    };
  };

  // Restart game
  const handleRestart = () => {
    setGameState(initialGameState(gameMode));
    setGameOver(false); // Reset game over state
    setWinner(null); // Reset winner
    setDisconnectMessage(null); // Reset disconnect message
    setShowNotification(false); // Reset notification
    setNotificationMessage(''); // Clear notification message
  };

  // Start a new game with selected mode
  const startGame = (mode) => {
    setGameMode(mode);
    
    if (mode === GAME_MODES.ONLINE) {
      // For online mode, directly join matchmaking instead of showing the multiplayer menu
      setShowGameModeSelection(false);
      setShowMatchmakingQueue(true); // Show matchmaking queue immediately
      
      // Initialize Socket.IO connection
      initializeSocket();
      setupSocketCallbacks();
      
      // Directly join matchmaking
      joinMatchmaking();
      
      // Reset timer state when starting a new online game
      setTurnTimeLeft(null);
      clearInterval(turnTimerRef.current);
      turnTimerRef.current = null;
    } else {
      // For local modes (VS_PLAYER, VS_AI)
      setGameState(initialGameState(mode));
      setShowGameModeSelection(false);
      setIsAiProcessing(false); // Reset AI processing state when starting a new game
      setGameOver(false); // Reset game over state
      setWinner(null); // Reset winner
    }
  };
  
  // Setup Socket.IO event callbacks
  const setupSocketCallbacks = () => {
    registerCallbacks({
      // Connection events
      onConnect: (id) => {
        console.log('Connected with ID:', id);
        // Store socket ID for reference
        setPlayerId(id);
      },
      
      // Matchmaking events
      joinedMatchmaking: () => {
        console.log('Joined matchmaking queue');
      },
      
      leftMatchmaking: () => {
        console.log('Left matchmaking queue');
      },
      
      matchFound: (data) => {
        console.log('Match found:', data);
        setRoomId(data.roomId);
        setPlayerTeam(data.team);
        setIsHost(data.team === 1); // Team 1 is considered the host
        setShowMatchmakingQueue(false);
        // Skip waiting room and start the game immediately
        setIsOnlineGameStarted(true);
        setGameState(initialGameState(GAME_MODES.ONLINE));
        setGameMode(GAME_MODES.ONLINE);
        setShowGameModeSelection(false);
      },
      
      matchmakingContinued: () => {
        console.log('Matchmaking continued due to opponent disconnect');
      },
      
      // Room events
      roomCreated: (data) => {
        console.log('Room created:', data);
        setRoomId(data.roomId);
        setPlayerTeam(data.team);
        setIsHost(true);
        setShowMultiplayerMenu(false);
        setShowWaitingRoom(true);
      },
      
      roomJoined: (data) => {
        console.log('Room joined:', data);
        setRoomId(data.roomId);
        setPlayerTeam(data.team);
        setIsHost(false);
        setShowMultiplayerMenu(false);
        setShowWaitingRoom(true);
      },
      
      playerJoined: (data) => {
        console.log('Player joined:', data);
      },
      
      playerStatusUpdate: (data) => {
        console.log('Player status update:', data);
        if (data.playerId !== getSocketId()) {
          setOpponentReady(data.ready);
        }
      },
      
      // Game events
      gameStart: () => {
        console.log('Game starting!');
        setShowWaitingRoom(false);
        setIsOnlineGameStarted(true);
        setIsMyTurn(playerTeam === 1); // Team 1 goes first
        
        // Initialize game state for online mode
        const initialState = initialGameState(GAME_MODES.ONLINE);
        setGameState(initialState);
        
        // If host, send initial game state
        if (isHost) {
          updateGameState(roomId, initialState);
        }
      },
      
      opponentMove: ({ move }) => {
        console.log('Opponent move received:', move);
        
        // Apply opponent's move with the detailed information
        setGameState((prev) => {
          const newBalls = JSON.parse(JSON.stringify(prev.balls)); // Deep copy to avoid reference issues
          const playerIndex = newBalls.findIndex(ball => ball.id === move.playerId);
          
          if (playerIndex !== -1) {
            // IMPORTANT: First update player position to match exactly what the opponent had
            // This ensures perfect synchronization between clients
            if (move.playerPos) {
              newBalls[playerIndex].pos = { ...move.playerPos };
            }
            
            // Calculate velocity from direction and power
            // Using the exact same calculation as the sender
            const velX = move.direction.x * move.power;
            const velY = move.direction.y * move.power;
            
            // Apply velocity
            newBalls[playerIndex].vel = { x: velX, y: velY };
            
            console.log(`Applied move to player ${move.playerId} at position:`, 
              newBalls[playerIndex].pos, 
              'with velocity:', { x: velX, y: velY });
            
            // Force animation frame to start if it's not already running
            if (animationFrameRef.current === null) {
              setTimeout(() => {
                // This will trigger the physics update effect
                setGameState(current => ({
                  ...current,
                  isMoving: true
                }));
              }, 0);
            }
            
            return {
              ...prev,
              balls: newBalls,
              isMoving: true,
            };
          }
          
          return prev;
        });
        
        // It's now my turn (will be switched back when pieces stop moving)
        setIsMyTurn(false);
      },
      
      gameStateUpdated: ({ gameState: newState }) => {
        console.log('Game state updated from server:', newState);
        
        // Check if this is an update after a goal (score differs from current state)
        setGameState(prevState => {
          const scoreChanged = 
            prevState.score.team1 !== newState.score.team1 || 
            prevState.score.team2 !== newState.score.team2;
          
          // If score changed (goal was scored), always accept the server's state
          if (scoreChanged) {
            console.log('Score changed, accepting server state (goal was scored)');
            setCameraShake(true); // Trigger camera shake for the receiver as well
            return newState;
          }
          
          // If we're currently moving, keep our local state
          if (prevState.isMoving && !newState.isMoving) {
            console.log('Keeping local state while pieces are moving');
            return prevState;
          }
          
          console.log('Updating to server state');
          return newState;
        });
        
        // If it's our turn now, update the turn state
        if (newState.currentTeam === playerTeam) {
          setIsMyTurn(true);
        }
      },
      
      gameEnded: ({ winner }) => {
        console.log('Game ended, winner:', winner);
        setGameOver(true);
        setWinner(winner);
        setPlayerReady(false);
        setOpponentReady(false);
      },
      
      opponentDisconnected: ({ winner, message }) => {
        console.log('Opponent disconnected:', message);
        // Show notification first instead of immediately ending the game
        setNotificationMessage(message);
        setShowNotification(true);
        
        // Store the winner information for when the user acknowledges the notification
        setWinner(winner);
        setDisconnectMessage(message);
      },
      
      playerLeft: (data) => {
        console.log('Player left:', data);
        // Handle opponent disconnection
        if (isOnlineGameStarted) {
          alert('Your opponent has left the game.');
          returnToMultiplayerMenu();
        } else if (showWaitingRoom) {
          alert('Your opponent has left the waiting room.');
          returnToMultiplayerMenu();
        }
      },
      
      error: (error) => {
        console.error('Socket error:', error);
        alert(`Error: ${error.message}`);
      },
      
      // Turn timer events
      turnTimerStarted: ({ team, timeLimit }) => {
        console.log(`Turn timer started for Team ${team} with ${timeLimit} seconds`);
        
        // Store the time limit
        setTurnTimeLimit(timeLimit);
        
        // Clear any existing timer
        if (turnTimerRef.current) {
          clearInterval(turnTimerRef.current);
          turnTimerRef.current = null;
        }
        
        // Set initial time left
        setTurnTimeLeft(timeLimit);
        
        // Start countdown timer
        turnTimerRef.current = setInterval(() => {
          setTurnTimeLeft(prevTime => {
            if (prevTime <= 1) {
              // Timer is about to finish, clear the interval
              clearInterval(turnTimerRef.current);
              turnTimerRef.current = null;
              return 0;
            }
            return prevTime - 1;
          });
        }, 1000);
      },
      
      turnTimeout: ({ losingTeam, winnerTeam, message }) => {
        console.log(`Turn timeout: ${message}`);
        
        // Clear the timer
        if (turnTimerRef.current) {
          clearInterval(turnTimerRef.current);
          turnTimerRef.current = null;
        }
        
        // Display notification about timeout
        setNotificationMessage(message);
        setShowNotification(true);
        
        // Game is over, set winner
        setGameOver(true);
        setWinner(winnerTeam);
      }
    });
  };

  // Return to game mode selection
  const returnToModeSelection = () => {
    setShowGameModeSelection(true);
    setShowMultiplayerMenu(false);
    setShowWaitingRoom(false);
    setShowMatchmakingQueue(false);
    setIsOnlineGameStarted(false);
    
    // Leave matchmaking queue if active
    if (showMatchmakingQueue) {
      leaveMatchmaking();
    }
    
    // Disconnect from Socket.IO if in online mode
    if (gameMode === GAME_MODES.ONLINE) {
      disconnectSocket();
    }
    
    // Clear any pending AI moves
    if (aiTimeoutRef.current) {
      clearTimeout(aiTimeoutRef.current);
      aiTimeoutRef.current = null;
    }
  };
  
  // Online multiplayer functions
  const handleJoinMatchmaking = () => {
    // Show matchmaking queue and join it
    setShowMultiplayerMenu(false);
    setShowMatchmakingQueue(true);
    joinMatchmaking();
  };
  
  const handlePlayerReady = () => {
    // Update local state
    setPlayerReady(true);
    // Send ready status to server
    socketSetPlayerReady(roomId);
  };
  
  const cancelMatchmaking = () => {
    // Leave matchmaking queue
    leaveMatchmaking();
    // Return to multiplayer menu
    setShowMatchmakingQueue(false);
    setShowMultiplayerMenu(true);
  };
  
  const returnToMultiplayerMenu = () => {
    // Leave current room
    if (roomId) {
      leaveRoom(roomId);
    }
    
    // Reset online game states
    setRoomId(null);
    setIsHost(false);
    setPlayerReady(false);
    setOpponentReady(false);
    setShowWaitingRoom(false);
    setIsOnlineGameStarted(false);
    setShowMultiplayerMenu(true);
  };

  // This has been moved up before the return statement

  // Get selected player for rendering (used in the component)

  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-gray-800 p-4">
      {showGameModeSelection ? (
        <GameMenu aiDifficulty={aiDifficulty} startGame={startGame} />
      ) : showMatchmakingQueue ? (
        <MatchmakingQueue onCancel={cancelMatchmaking} />
      ) : showMultiplayerMenu ? (
        <MultiplayerMenu 
          onJoinMatchmaking={handleJoinMatchmaking}
          onReturnToMainMenu={returnToModeSelection}
        />
      ) : showWaitingRoom ? (
        <WaitingRoom 
          roomId={roomId}
          isHost={isHost}
          onReady={handlePlayerReady}
          onCancel={returnToMultiplayerMenu}
          opponentReady={opponentReady}
          playerReady={playerReady}
        />
      ) : gameOver ? (
        // Game Over Screen
        <div className="flex flex-col items-center justify-center bg-gray-700 rounded-lg p-8 shadow-lg text-white max-w-[400px] w-full">
          <h2 className="text-3xl font-bold mb-6">Game Over!</h2>
          <div className="text-2xl mb-8">
            {disconnectMessage ? (
              <span className="font-bold">{disconnectMessage}</span>
            ) : winner === 1 ? (
              <span className="text-red-500 font-bold">Red Team Wins!</span>
            ) : (
              <span className="text-blue-500 font-bold">Blue Team Wins!</span>
            )}
          </div>
          <div className="mb-4 text-xl">
            Final Score: <span className="text-red-500 font-bold">{gameState.score.team1}</span> - <span className="text-blue-500 font-bold">{gameState.score.team2}</span>
          </div>
          <div className="flex space-x-4 mt-4">
            <button
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg transition-colors"
              onClick={handleRestart}
            >
              Play Again
            </button>
            <button
              className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded-lg transition-colors"
              onClick={returnToModeSelection}
            >
              Main Menu
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Team indicator for online multiplayer */}
          {gameMode === GAME_MODES.ONLINE && (
            <div className="mb-4 w-full max-w-[400px] text-center py-2 px-4 rounded-lg" 
              style={{
                backgroundColor: playerTeam === 1 ? "#ff6b6b" : "#4dabf7",
                color: "white",
                fontWeight: "bold",
                fontSize: "18px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
              }}>
              You are playing as {playerTeam === 1 ? "RED" : "BLUE"} team
            </div>
          )}
          <div className="mb-4 w-full max-w-[400px] flex justify-between items-center text-white">
            <div className="text-red-500 font-bold text-xl">
              Red: {gameState.score.team1}
            </div>
            <div className="bg-gray-600 px-3 py-1 rounded-lg text-sm">
              {gameState.isMoving ? (
                <span>Balls in motion...</span>
              ) : (
                <span>
                  {gameState.currentTeam === 1 ? "🔴 Red" : "🔵 Blue"}'s turn
                  {gameState.currentTeam === 2 && gameMode === GAME_MODES.VS_AI
                    ? " (AI)"
                    : ""}
                  {!gameState.selectedPlayerId &&
                    gameState.currentTeam === 1 &&
                    " - Select a player"}
                </span>
              )}
            </div>
            <div className="text-blue-500 font-bold text-xl">
              Blue: {gameState.score.team2}
            </div>
          </div>

          {/* Turn Timer */}
          {gameMode === GAME_MODES.ONLINE && turnTimeLeft !== null && !gameState.isMoving && (
            <div className="mb-4 w-full max-w-[400px] flex justify-center">
              <div 
                className={`text-center py-1 px-6 rounded-full font-bold ${turnTimeLeft <= 10 ? 'bg-red-600' : 'bg-green-600'}`}
                style={{ minWidth: '80px' }}
              >
                <span className="text-white">{turnTimeLeft}</span>
                <span className="text-white text-xs ml-1">sec</span>
              </div>
            </div>
          )}

          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes shake {
              0% { transform: translate(0, 0) rotate(0deg); }
              10% { transform: translate(-5px, -5px) rotate(-0.5deg); }
              20% { transform: translate(5px, -5px) rotate(0.5deg); }
              30% { transform: translate(-5px, 5px) rotate(0deg); }
              40% { transform: translate(5px, 5px) rotate(0.5deg); }
              50% { transform: translate(-5px, -5px) rotate(-0.5deg); }
              60% { transform: translate(5px, -5px) rotate(0deg); }
              70% { transform: translate(-5px, 5px) rotate(-0.5deg); }
              80% { transform: translate(-5px, -5px) rotate(0.5deg); }
              90% { transform: translate(5px, 5px) rotate(0deg); }
              100% { transform: translate(0, 0) rotate(0deg); }
            }
            .camera-shake {
              animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
            }
          `}} />
          
          {/* Notification overlay */}
          {showNotification && (
            <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
              <div className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-md text-center">
                <h3 className="text-xl font-bold text-white mb-4">Opponent Left</h3>
                <p className="text-white mb-6">{notificationMessage}</p>
                <button 
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors"
                  onClick={() => {
                    setShowNotification(false);
                    setGameOver(true); // Now show the game over screen
                  }}
                >
                  OK
                </button>
              </div>
            </div>
          )}
          
          <div
            ref={containerRef}
            className={`relative w-full max-w-[400px] h-[600px] border-4 border-gray-400 rounded-lg overflow-hidden cursor-default ${cameraShake ? 'camera-shake' : ''}`}
            style={{ 
              touchAction: "none",
              backgroundImage: `url(${fieldImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center"
            }}
          >
            {/* Field markings - Rotated 90 degrees */}
            <div className="absolute top-0 left-0 w-full h-full">
              {/* Center circle */}
              <div
                className="absolute top-1/2 left-1/2 w-24 h-24 border-2 border-white rounded-full opacity-50"
                style={{ transform: "translate(-50%, -50%)" }}
              ></div>
              {/* Center line - now horizontal */}
              <div
                className="absolute left-0 top-1/2 w-full h-0.5 bg-white opacity-50"
                style={{ transform: "translateY(-50%)" }}
              ></div>

              {/* Top goal */}
              <div
                className="absolute top-0 left-1/2 h-2 w-24 bg-gray-200"
                style={{ transform: "translateX(-50%)" }}
              ></div>
              {/* Bottom goal */}
              <div
                className="absolute bottom-0 left-1/2 h-2 w-24 bg-gray-200"
                style={{ transform: "translateX(-50%)" }}
              ></div>
            </div>

            {/* Players and ball */}
            {gameState.balls.map((ball) => {
              const isCurrentTeamPlayer =
                ball.isPlayer && ball.team === gameState.currentTeam;
              const isSelected = ball.id === gameState.selectedPlayerId;

              return (
                <div
                  key={ball.id}
                  ref={isSelected ? activePlayerRef : null}
                  className={`absolute select-none flex items-center justify-center 
                        ${
                          !gameState.isMoving && isCurrentTeamPlayer
                            ? "hover:ring-2 hover:ring-yellow-300"
                            : ""
                        }
                        ${isSelected ? "ring-2 ring-yellow-300 rounded-full" : ""}`}
                  style={{
                    width: `${ball.size}px`,
                    height: `${ball.size}px`,
                    left: `${ball.pos.x}px`,
                    top: `${ball.pos.y}px`,
                    transform: "translate(-50%, -50%)",
                    touchAction: "none",
                    zIndex: ball.id === "ball" ? 5 : 10,
                    cursor:
                      !gameState.isMoving && isCurrentTeamPlayer
                        ? "pointer"
                        : "default",
                    opacity:
                      !gameState.isMoving && isCurrentTeamPlayer ? 1 : 0.8,
                    backgroundImage: ball.id === "ball" 
                      ? `url(${ballImage})` 
                      : ball.team === 1 
                        ? `url(${playerImage})` 
                        : `url(${opponentImage})`,
                    backgroundSize: "contain",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat"
                  }}
                  onMouseDown={
                    !gameState.isMoving && 
                    ((gameMode === GAME_MODES.ONLINE && ball.team === playerTeam && ball.team === gameState.currentTeam) || 
                     (gameMode !== GAME_MODES.ONLINE && isCurrentTeamPlayer))
                      ? (e) => handleInteractionStart(e, ball.id)
                      : undefined
                  }
                  onTouchStart={
                    !gameState.isMoving && 
                    ((gameMode === GAME_MODES.ONLINE && ball.team === playerTeam && ball.team === gameState.currentTeam) || 
                     (gameMode !== GAME_MODES.ONLINE && isCurrentTeamPlayer))
                      ? (e) => handleInteractionStart(e, ball.id)
                      : undefined
                  }
                  onClick={
                    !gameState.isMoving && isCurrentTeamPlayer
                      ? () => selectPlayer(ball.id)
                      : undefined
                  }
                ></div>
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

            {/* AI Difficulty Controls removed - game always uses hard difficulty */}
          </div>

          <div className="mt-4 text-white text-center">
            <p className="text-sm px-2">
              {gameMode === GAME_MODES.VS_PLAYER
                ? "Click on any of your team players to select, then drag to shoot. Take turns to score in the opponent's goal."
                : "You play as Red. Click on any of your players to select, then drag to shoot. The AI plays as Blue."}
            </p>
            {gameMode === GAME_MODES.VS_AI && (
              <p className="mt-2 text-xs text-gray-400">AI Difficulty: Hard</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default SoccerStarsGame;
