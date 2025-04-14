import { 
  AI_DIFFICULTY, 
  AI_POWER_SCALING_FACTOR, 
  PLAYER_SIZE, 
  BALL_SIZE, 
  MAX_PULL_DISTANCE,
  POWER_FACTOR,
  WALL_BOUNCE_FACTOR
} from '../constants';

/**
 * Calculate the best move for AI based on current game state and difficulty
 * 
 * @param {Object} gameState - Current game state
 * @param {String} aiDifficulty - AI difficulty level
 * @param {Object} containerRef - Reference to game container
 * @param {Function} selectPlayer - Function to select a player
 * @returns {Object} AI move information
 */
export const calculateAIMove = (
  gameState, 
  aiDifficulty, 
  containerRef, 
  selectPlayer
) => {
  if (gameState.isMoving || gameState.currentTeam !== 2) return null;
  
  console.log('AI calculating move with difficulty:', aiDifficulty);
  
  const fieldWidth = containerRef.current?.offsetWidth || 600;
  const fieldHeight = containerRef.current?.offsetHeight || 400;
  const ball = gameState.balls.find(b => b.id === 'ball');
  const aiPlayers = gameState.balls.filter(b => b.isPlayer && b.team === 2);
  const goalY = fieldHeight / 2;
  
  // Using advanced 8-ball pool like calculations
  // Get all opponent players as obstacles
  const opponentPlayers = gameState.balls.filter(b => b.isPlayer && b.team === 1);
  const obstacles = opponentPlayers.map(p => ({ pos: p.pos, radius: PLAYER_SIZE / 2 }));
    
    // Calculate target points within opponent's goal (left side at x=0)
    const goalHeight = fieldHeight / 4; // Goal is typically smaller than field height
    const targetPoints = [];
    const numTargetPoints = 5; // More target points for better precision
    
    for (let i = 0; i < numTargetPoints; i++) {
      const y = goalY - goalHeight/2 + (i * goalHeight/(numTargetPoints-1));
      targetPoints.push({ x: 0, y });
    }
    
    // Check for possible bank shots (1-cushion rebounds)
    const wallPoints = [
      // Top wall - multiple points along the wall
      ...Array.from({ length: 5 }, (_, i) => ({ x: fieldWidth * (i + 1) / 6, y: 0 })),
      // Bottom wall - multiple points along the wall
      ...Array.from({ length: 5 }, (_, i) => ({ x: fieldWidth * (i + 1) / 6, y: fieldHeight }))
    ];
    
    // Track best shot information
    let bestShotScore = -Infinity;
    let bestPlayer = null;
    let bestAngle = 0;
    let bestPower = 0;
    let bestIsBankShot = false;
    let bestBankPoint = null;
    
    // For each AI player
    for (const player of aiPlayers) {
      const distPlayerToBall = Math.sqrt(
        Math.pow(player.pos.x - ball.pos.x, 2) + 
        Math.pow(player.pos.y - ball.pos.y, 2)
      );
      
      // If player is too far from ball, skip
      if (distPlayerToBall > MAX_PULL_DISTANCE * 1.2) continue;
      
      // Calculate angle from player to ball
      const anglePlayerToBall = Math.atan2(
        ball.pos.y - player.pos.y,
        ball.pos.x - player.pos.x
      );
      
      // Check direct shots to each target point
      for (const target of targetPoints) {
        const distBallToTarget = Math.sqrt(
          Math.pow(ball.pos.x - target.x, 2) + 
          Math.pow(ball.pos.y - target.y, 2)
        );
        
        // Calculate angle from ball to target
        const angleBallToTarget = Math.atan2(
          target.y - ball.pos.y,
          target.x - ball.pos.x
        );
        
        // Calculate optimal impact point on the ball
        // For a direct shot, we want to hit the ball slightly off-center
        // to impart the correct direction
        const impactOffsetAngle = angleBallToTarget;
        const impactPoint = {
          x: ball.pos.x - Math.cos(impactOffsetAngle) * (BALL_SIZE / 3),
          y: ball.pos.y - Math.sin(impactOffsetAngle) * (BALL_SIZE / 3)
        };
        
        // Calculate the angle the player should approach to hit the impact point
        const anglePlayerToImpact = Math.atan2(
          impactPoint.y - player.pos.y,
          impactPoint.x - player.pos.x
        );
        
        // Calculate the optimal hitting angle based on physics
        const hitAngle = anglePlayerToImpact;
        
        // Check if the path from ball to target is clear
        if (isPathClear(ball.pos, target, obstacles, BALL_SIZE)) {
          // Calculate how good the shot positioning is
          const angleDifference = Math.abs(normalizeAngle(hitAngle - anglePlayerToBall));
          const angleScore = 1 - (angleDifference / Math.PI); // 1 for perfect alignment, 0 for opposite
          
          // Calculate distance factors
          const distanceFactor = 1 - (distPlayerToBall / (MAX_PULL_DISTANCE * 1.5));
          
          // Calculate shot difficulty based on distance to ball and target
          const shotDifficulty = Math.min(1, (distBallToTarget / fieldWidth) * 0.7);
          
          // Calculate a more sophisticated shot score
          const positionScore = distanceFactor * 0.4;
          const accuracyScore = angleScore * 0.5;
          const difficultyBonus = shotDifficulty * 0.3; // Harder shots get bonus points if makeable
          
          const shotScore = positionScore + accuracyScore + difficultyBonus;
          
          // If this is the best shot so far, record it
          if (shotScore > bestShotScore) {
            bestShotScore = shotScore;
            bestPlayer = player;
            bestAngle = hitAngle;
            
            // Calculate optimal power based on distance and desired ball speed
            // Use physics principles to determine the right amount of force
            const optimalBallSpeed = Math.min(distBallToTarget * 0.4, MAX_PULL_DISTANCE);
            const powerFactor = 1.2; // Slightly more power to ensure the ball reaches the target
            bestPower = Math.min(MAX_PULL_DISTANCE, optimalBallSpeed * powerFactor) * AI_POWER_SCALING_FACTOR;
            
            bestIsBankShot = false;
          }
        }
      }
      
      // Check bank shots (wall rebounds) with improved physics calculations
      for (const wallPoint of wallPoints) {
        for (const target of targetPoints) {
          // Calculate if the bank shot is geometrically possible
          const isBankShotPossible = isBankShotGeometricallyValid(
            ball.pos,
            wallPoint,
            target,
            fieldWidth,
            fieldHeight
          );
          
          if (isBankShotPossible) {
            // Calculate vectors for the bank shot using proper billiards physics
            
            // We determine which wall we're hitting for optimal impact calculations
            // This helps us calculate the best approach angle
            
            // Calculate incoming vector (from ball to wall)
            const incomingVector = {
              x: wallPoint.x - ball.pos.x,
              y: wallPoint.y - ball.pos.y
            };
            const incomingLength = Math.sqrt(incomingVector.x * incomingVector.x + incomingVector.y * incomingVector.y);
            const incomingNormalized = {
              x: incomingVector.x / incomingLength,
              y: incomingVector.y / incomingLength
            };
            
            // Calculate reflection physics using the formula: r = i - 2(i·n)n
            // where i is incoming vector, n is normal vector, and r is reflection vector
            
            // Calculate the optimal impact point on the ball for this shot
            const impactPoint = {
              x: ball.pos.x - incomingNormalized.x * (BALL_SIZE / 2.5),
              y: ball.pos.y - incomingNormalized.y * (BALL_SIZE / 2.5)
            };
            
            // Calculate the angle the player should approach to hit the impact point
            const anglePlayerToImpact = Math.atan2(
              impactPoint.y - player.pos.y,
              impactPoint.x - player.pos.x
            );
            
            // This is our final hitting angle
            const hitAngle = anglePlayerToImpact;
            
            // Check if the paths are clear
            if (isPathClear(ball.pos, wallPoint, obstacles, BALL_SIZE) && 
                isPathClear(wallPoint, target, obstacles, BALL_SIZE)) {
              
              // Calculate precision score - how well the player is positioned for this shot
              const angleDifference = Math.abs(normalizeAngle(hitAngle - anglePlayerToBall));
              const angleScore = 1 - (angleDifference / Math.PI);
              
              // Calculate position score
              const distanceFactor = 1 - (distPlayerToBall / (MAX_PULL_DISTANCE * 1.5));
              
              // Calculate distances for power calculation
              const distBallToWall = Math.sqrt(
                Math.pow(ball.pos.x - wallPoint.x, 2) + 
                Math.pow(ball.pos.y - wallPoint.y, 2)
              );
              const distWallToTarget = Math.sqrt(
                Math.pow(wallPoint.x - target.x, 2) + 
                Math.pow(wallPoint.y - target.y, 2)
              );
              
              // Calculate shot difficulty based on angles and distances
              const shotComplexity = (distBallToWall + distWallToTarget) / fieldWidth;
              const difficultyScore = Math.min(1, shotComplexity * 0.7);
              
              // Bank shots are harder but more impressive, so we give a bonus for difficult but makeable shots
              const positionScore = distanceFactor * 0.3;
              const precisionScore = angleScore * 0.4;
              const complexityBonus = difficultyScore * 0.5; // Higher bonus for bank shots
              
              // Calculate final score with a small penalty for bank shots since they're less reliable
              const shotScore = (positionScore + precisionScore + complexityBonus) * 0.9; // 10% reliability penalty
              
              if (shotScore > bestShotScore) {
                bestShotScore = shotScore;
                bestPlayer = player;
                bestAngle = hitAngle;
                
                // Calculate optimal power with physics compensation
                const totalDistance = distPlayerToBall + distBallToWall + distWallToTarget;
                
                // Compensate for energy loss on bounce using the wall bounce factor
                // Add extra power for longer shots
                const distanceCompensation = 1 + (totalDistance / (fieldWidth * 1.5)) * 0.3;
                const bounceCompensation = 1 / WALL_BOUNCE_FACTOR;
                
                bestPower = Math.min(
                  MAX_PULL_DISTANCE,
                  totalDistance * 0.5 * distanceCompensation * bounceCompensation
                ) * AI_POWER_SCALING_FACTOR;
                
                bestIsBankShot = true;
                bestBankPoint = wallPoint;
              }
            }
          }
        }
      }
    }
    
    // If we found a good shot
    if (bestPlayer && bestShotScore > -Infinity) {
      console.log(`AI found ${bestIsBankShot ? 'bank' : 'direct'} shot with score: ${bestShotScore.toFixed(2)}`);
      if (bestIsBankShot) {
        console.log('Bank point:', bestBankPoint);
      }
      selectPlayer(bestPlayer.id);
      return {
        player: bestPlayer,
        angle: bestAngle,
        power: bestPower
      };
    }
    
    // Fallback: If no clear shots, find the closest AI player to the ball
    // and make a simple hit
    let closestPlayer = null;
    let minDistance = Infinity;
    
    for (const player of aiPlayers) {
      const dist = Math.sqrt(
        Math.pow(player.pos.x - ball.pos.x, 2) + 
        Math.pow(player.pos.y - ball.pos.y, 2)
      );
      
      if (dist < minDistance) {
        closestPlayer = player;
        minDistance = dist;
      }
    }
    
    if (closestPlayer) {
      console.log('No clear shots found. Using fallback simple hit.');
      const angle = Math.atan2(
        ball.pos.y - closestPlayer.pos.y,
        ball.pos.x - closestPlayer.pos.x
      );
      
      selectPlayer(closestPlayer.id);
      return {
        player: closestPlayer,
        angle: angle,
        power: MAX_PULL_DISTANCE * 0.7 * AI_POWER_SCALING_FACTOR
      };
    }
  
  // If no viable shot found
  console.log('AI could not find any viable move');
  return null;
};


/**
 * Checks if a path is clear of obstacles
 * @param {Object} startPos - Start position {x, y}
 * @param {Object} endPos - End position {x, y}
 * @param {Array} obstacles - Array of obstacles with position and radius
 * @param {Number} pathWidth - Width of the path to check
 * @returns {Boolean} True if path is clear
 */
const isPathClear = (startPos, endPos, obstacles, pathWidth) => {
  // Vector from start to end
  const dx = endPos.x - startPos.x;
  const dy = endPos.y - startPos.y;
  const pathLength = Math.sqrt(dx * dx + dy * dy);
  
  // Unit vector in direction of path
  const ux = dx / pathLength;
  const uy = dy / pathLength;
  
  // Check each obstacle
  for (const obstacle of obstacles) {
    // Vector from start to obstacle
    const ox = obstacle.pos.x - startPos.x;
    const oy = obstacle.pos.y - startPos.y;
    
    // Project obstacle vector onto path vector
    const projection = ox * ux + oy * uy;
    
    // If projection is outside the path length, obstacle is not in the way
    if (projection < 0 || projection > pathLength) continue;
    
    // Calculate closest point on line to obstacle
    const closestX = startPos.x + projection * ux;
    const closestY = startPos.y + projection * uy;
    
    // Distance from obstacle to line
    const distanceToLine = Math.sqrt(
      Math.pow(obstacle.pos.x - closestX, 2) + 
      Math.pow(obstacle.pos.y - closestY, 2)
    );
    
    // If distance is less than sum of path width and obstacle radius, path is blocked
    if (distanceToLine < (pathWidth / 2 + obstacle.radius)) {
      return false;
    }
  }
  
  return true;
};



/**
 * Normalize angle to be between -π and π
 * @param {Number} angle - Angle in radians
 * @returns {Number} Normalized angle
 */
const normalizeAngle = (angle) => {
  return ((angle + Math.PI) % (2 * Math.PI)) - Math.PI;
};

/**
 * Check if a bank shot is geometrically valid
 * @param {Object} ballPos - Ball position
 * @param {Object} wallPoint - Point on the wall to bounce from
 * @param {Object} targetPos - Target position
 * @param {Number} fieldWidth - Width of the field
 * @param {Number} fieldHeight - Height of the field
 * @returns {Boolean} True if the bank shot is geometrically valid
 */
const isBankShotGeometricallyValid = (ballPos, wallPoint, targetPos, fieldWidth, fieldHeight) => {
  // Check if wall point is actually on a wall
  const onTopWall = Math.abs(wallPoint.y) < 1;
  const onBottomWall = Math.abs(wallPoint.y - fieldHeight) < 1;
  const onLeftWall = Math.abs(wallPoint.x) < 1;
  const onRightWall = Math.abs(wallPoint.x - fieldWidth) < 1;
  
  if (!onTopWall && !onBottomWall && !onLeftWall && !onRightWall) {
    return false;
  }
  
  // Calculate angles
  const angleBallToWall = Math.atan2(
    wallPoint.y - ballPos.y,
    wallPoint.x - ballPos.x
  );
  
  const angleWallToTarget = Math.atan2(
    targetPos.y - wallPoint.y,
    targetPos.x - wallPoint.x
  );
  
  // For a valid bank shot on horizontal walls (top/bottom):
  // The y-components of the vectors should have opposite signs
  if (onTopWall || onBottomWall) {
    const ballToWallY = Math.sin(angleBallToWall);
    const wallToTargetY = Math.sin(angleWallToTarget);
    return ballToWallY * wallToTargetY < 0; // Different signs
  }
  
  // For vertical walls (left/right):
  // The x-components of the vectors should have opposite signs
  if (onLeftWall || onRightWall) {
    const ballToWallX = Math.cos(angleBallToWall);
    const wallToTargetX = Math.cos(angleWallToTarget);
    return ballToWallX * wallToTargetX < 0; // Different signs
  }
  
  return false;
};





/**
 * Execute the AI move with the calculated parameters
 * 
 * @param {Object} aiMove - AI move information
 * @param {Function} setGameState - Function to update game state
 */
export const executeAIMove = (aiMove, setGameState) => {
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
