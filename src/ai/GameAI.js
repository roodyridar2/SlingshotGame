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
    
    // Determine if this player has a good shot
    let playerScore = 0;
    let moveAngle = 0;
    let movePower = 0;
    
    // Different strategies based on difficulty
    if (aiDifficulty === AI_DIFFICULTY.EASY) {
      // Easy AI just tries to hit the ball directly with random power
      playerScore = 1000 - distToBall; // Prefer closer players
      moveAngle = angleToBall;
      movePower = Math.random() * 0.7 * MAX_PULL_DISTANCE; // Random lower power
    } 
    else if (aiDifficulty === AI_DIFFICULTY.MEDIUM) {
      // Medium AI tries to hit ball toward goal with moderate power
      const canHitBallTowardGoal = Math.abs(angleToBall - angleToGoal) < Math.PI/4;
      playerScore = canHitBallTowardGoal ? (2000 - distToBall) : (1000 - distToBall);
      moveAngle = angleToBall;
      movePower = Math.min(distToBall * 1.2, MAX_PULL_DISTANCE * 0.8);
    }
    else if (aiDifficulty === AI_DIFFICULTY.HARD) {
      // Hard AI uses more sophisticated strategy
      // Check if direct shot to goal is possible
      const directShotPossible = Math.abs(player.pos.x - ball.pos.x) < 100 && 
                                Math.abs(player.pos.y - ball.pos.y) < 50;
      
      // Calculate if there's a clear path to the goal
      const pathToGoal = Math.abs(ball.pos.y - goalY) < 100;
      
      if (directShotPossible && pathToGoal) {
        // Try to score directly
        playerScore = 3000 - distToBall;
        moveAngle = angleToGoal;
        movePower = MAX_PULL_DISTANCE * 0.9;
      } else {
        // Try to position the ball better
        playerScore = 2000 - distToBall;
        moveAngle = angleToBall;
        movePower = Math.min(distToBall * 1.5, MAX_PULL_DISTANCE);
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
    // Select the best player
    selectPlayer(bestPlayer.id);
    
    return {
      player: bestPlayer,
      angle: bestMove.angle,
      power: bestMove.power
    };
  }
  
  return null;
};

/**
 * Execute the AI move with the calculated parameters
 * 
 * @param {Object} aiMove - AI move information
 * @param {Function} setGameState - Function to update game state
 * @param {Object} constants - Game constants
 */
export const executeAIMove = (aiMove, setGameState, constants) => {
  if (!aiMove) return;
  
  const { player, angle, power } = aiMove;
  const { POWER_FACTOR } = constants;
  
  // Calculate velocity from angle and power
  const directionX = Math.cos(angle);
  const directionY = Math.sin(angle);
  const initialSpeed = power * POWER_FACTOR;
  
  // Apply the move
  setGameState(prev => {
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
    
    return {
      ...prev,
      balls: newBalls,
      isMoving: true
    };
  });
};
