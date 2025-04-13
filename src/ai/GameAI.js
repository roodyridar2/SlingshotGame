import { AI_DIFFICULTY } from '../constants';

/**
 * Calculate the best move for AI based on current game state and difficulty
 * 
 * @param {Object} gameState - Current game state
 * @param {String} aiDifficulty - AI difficulty level
 * @param {Object} containerRef - Reference to game container
 * @param {Function} selectPlayer - Function to select a player
 * @param {Object} constants - Game constants
 * @returns {Object} AI move information
 */
export const calculateAIMove = (
  gameState, 
  aiDifficulty, 
  containerRef, 
  selectPlayer,
  constants
) => {
  if (gameState.isMoving || gameState.currentTeam !== 2) return null;
  
  console.log('AI calculating move with difficulty:', aiDifficulty);
  
  const { 
    MAX_PULL_DISTANCE,
    POWER_FACTOR
  } = constants;
  
  const fieldWidth = containerRef.current?.offsetWidth || 600;
  const fieldHeight = containerRef.current?.offsetHeight || 400;
  const ball = gameState.balls.find(b => b.id === 'ball');
  const aiPlayers = gameState.balls.filter(b => b.isPlayer && b.team === 2);
  const goalY = fieldHeight / 2;
  
  // Find the best player to move
  let bestPlayer = null;
  let bestScore = -Infinity;
  let bestMove = { angle: 0, power: 0 };
  
  // First priority: Check if any player can directly hit the ball into the goal
  const directScoringMove = findDirectScoringMove(aiPlayers, ball, goalY, MAX_PULL_DISTANCE);
  if (directScoringMove) {
    console.log('AI found direct scoring move!');
    selectPlayer(directScoringMove.player.id);
    return directScoringMove;
  }
  
  // For each AI player, evaluate possible moves
  aiPlayers.forEach(player => {
    // Calculate distance to ball
    const distToBall = Math.sqrt(
      Math.pow(player.pos.x - ball.pos.x, 2) + 
      Math.pow(player.pos.y - ball.pos.y, 2)
    );
    
    // Calculate angle to opponent's goal (left side)
    const angleToGoal = Math.atan2(
      goalY - player.pos.y,
      0 - player.pos.x
    );
    
    // Calculate angle to ball
    const angleToBall = Math.atan2(
      ball.pos.y - player.pos.y,
      ball.pos.x - player.pos.x
    );
    
    // Calculate angle from ball to goal
    const ballToGoalAngle = Math.atan2(
      goalY - ball.pos.y,
      0 - ball.pos.x
    );
    
    // Determine if this player has a good shot
    let playerScore = 0;
    let moveAngle = 0;
    let movePower = 0;
    
    // Different strategies based on difficulty
    if (aiDifficulty === AI_DIFFICULTY.EASY) {
      // Easy AI just tries to hit the ball directly with random power
      playerScore = 1000 - distToBall; // Prefer closer players
      moveAngle = angleToBall;
      movePower = Math.random() * 0.7 * MAX_PULL_DISTANCE + (MAX_PULL_DISTANCE * 0.3); // More power than before
    } 
    else if (aiDifficulty === AI_DIFFICULTY.MEDIUM) {
      // Medium AI tries to hit ball toward goal with moderate power
      const canHitBallTowardGoal = Math.abs(angleToBall - ballToGoalAngle) < Math.PI/3;
      playerScore = canHitBallTowardGoal ? (3000 - distToBall) : (1000 - distToBall);
      moveAngle = canHitBallTowardGoal ? angleToBall : ballToGoalAngle;
      movePower = Math.min(distToBall * 1.5, MAX_PULL_DISTANCE * 0.9);
    }
    else if (aiDifficulty === AI_DIFFICULTY.HARD) {
      // Hard AI uses more sophisticated strategy
      // Check if direct shot to goal is possible
      const directShotPossible = Math.abs(player.pos.x - ball.pos.x) < 150 && 
                                Math.abs(player.pos.y - ball.pos.y) < 80;
      
      // Calculate if there's a clear path to the goal
      const pathToGoal = Math.abs(ball.pos.y - goalY) < 120;
      
      if (directShotPossible && pathToGoal) {
        // Try to score directly
        playerScore = 5000 - distToBall;
        // Aim slightly ahead of the ball in the direction of the goal
        const adjustedAngle = calculateAdjustedAngle(angleToBall, ballToGoalAngle, 0.7);
        moveAngle = adjustedAngle;
        movePower = MAX_PULL_DISTANCE; // Full power for direct shots
      } else {
        // Try to position the ball better
        playerScore = 2000 - distToBall;
        moveAngle = angleToBall;
        movePower = Math.min(distToBall * 1.8, MAX_PULL_DISTANCE);
      }
    }
    
    // Add some randomness to make AI less predictable
    playerScore += Math.random() * 200;
    
    // Update best player if this one has a higher score
    if (playerScore > bestScore) {
      bestScore = playerScore;
      bestPlayer = player;
      bestMove = { angle: moveAngle, power: movePower };
    }
  });
  
  // If we found a good move, return it
  if (bestPlayer && bestMove) {
    console.log('AI found best move:', bestPlayer.id);
    // Select the best player
    selectPlayer(bestPlayer.id);
    
    return {
      player: bestPlayer,
      angle: bestMove.angle,
      power: bestMove.power
    };
  }
  
  console.log('AI could not find a good move');
  return null;
};

/**
 * Find if any player can directly hit the ball into the goal
 */
const findDirectScoringMove = (aiPlayers, ball, goalY, maxPullDistance) => {
  for (const player of aiPlayers) {
    // Check if player is in a good position to hit ball
    const distToBall = Math.sqrt(
      Math.pow(player.pos.x - ball.pos.x, 2) + 
      Math.pow(player.pos.y - ball.pos.y, 2)
    );
    
    if (distToBall > 150) continue; // Skip if too far from ball
    
    // Calculate angle to ball
    const angleToBall = Math.atan2(
      ball.pos.y - player.pos.y,
      ball.pos.x - player.pos.x
    );
    
    // Calculate angle from ball to goal
    const ballToGoalAngle = Math.atan2(
      goalY - ball.pos.y,
      0 - ball.pos.x
    );
    
    // Check if the angles are similar (can hit ball toward goal)
    const angleDiff = Math.abs(angleToBall - ballToGoalAngle);
    if (angleDiff < Math.PI/4) {
      // This player can potentially hit the ball toward the goal
      return {
        player: player,
        angle: angleToBall,
        power: maxPullDistance // Use full power for direct shots
      };
    }
  }
  
  return null;
};

/**
 * Calculate an adjusted angle between two angles with a weight factor
 */
const calculateAdjustedAngle = (angle1, angle2, weight) => {
  // Ensure angles are in the same range to avoid issues at the -π/π boundary
  let a1 = angle1;
  let a2 = angle2;
  
  // Adjust angles if they're more than π apart
  if (Math.abs(a1 - a2) > Math.PI) {
    if (a1 < a2) {
      a1 += 2 * Math.PI;
    } else {
      a2 += 2 * Math.PI;
    }
  }
  
  // Calculate weighted average
  const weightedAngle = a1 * (1 - weight) + a2 * weight;
  
  // Normalize back to -π to π range
  return ((weightedAngle + Math.PI) % (2 * Math.PI)) - Math.PI;
};

/**
 * Execute the AI move with the calculated parameters
 * 
 * @param {Object} aiMove - AI move information
 * @param {Function} setGameState - Function to update game state
 * @param {Object} constants - Game constants
 */
export const executeAIMove = (aiMove, setGameState, constants) => {
  if (!aiMove) {
    console.error('executeAIMove called with no move!');
    return;
  }
  
  console.log('Executing AI move:', {
    playerId: aiMove.player.id,
    angle: aiMove.angle.toFixed(2),
    power: aiMove.power.toFixed(2)
  });
  
  const { player, angle, power } = aiMove;
  const { POWER_FACTOR } = constants;
  
  // Calculate velocity from angle and power
  const directionX = Math.cos(angle);
  const directionY = Math.sin(angle);
  const initialSpeed = power * POWER_FACTOR;
  
  console.log('AI shot velocity:', {
    x: (directionX * initialSpeed).toFixed(2),
    y: (directionY * initialSpeed).toFixed(2),
    speed: initialSpeed.toFixed(2)
  });
  
  // Apply the move
  setGameState(prev => {
    // Double-check that we're still on AI's turn
    if (prev.currentTeam !== 2) {
      console.error('Not AI turn anymore when executing move!');
      return prev;
    }
    
    // Double-check that the player still exists
    const playerExists = prev.balls.some(b => b.id === player.id);
    if (!playerExists) {
      console.error('Player no longer exists:', player.id);
      return prev;
    }
    
    console.log('Setting velocity for player:', player.id);
    const newBalls = prev.balls.map(ball => {
      if (ball.id === player.id) {
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
    
    console.log('Setting game state to moving');
    return {
      ...prev,
      balls: newBalls,
      isMoving: true
    };
  });
};
