import React, { useState, useRef, useEffect, useCallback } from 'react';

// Constants for physics and appearance
const PLAYER_BALL_SIZE = 40;
const TARGET_BALL_SIZE = 35; // Keep size difference visual, physics assumes equal mass for simplicity
const MAX_PULL_DISTANCE = 150;
const POWER_FACTOR = 0.25; // Slightly increased power might feel better

// --- ADJUST THESE FOR POOL PHYSICS ---
const DAMPING_FACTOR = 0.985;      // Low friction, but still some damping
const WALL_BOUNCE_FACTOR = 0.85;   // Cushions aren't perfectly elastic
const BALL_COLLISION_BOUNCE_FACTOR = 0.98; // Pool collisions are highly elastic (close to 1.0)
// --- END ADJUSTMENTS ---

const MIN_VELOCITY_THRESHOLD = 0.05;
const ARROW_COLOR = 'rgba(255, 255, 255, 0.7)';
const ARROW_MAX_WIDTH = 8;
const BALL_Z_INDEX = 10;
const ARROW_Z_INDEX = 15;

// Initial ball states
const initialBallsData = [
  {
    id: 'player',
    pos: { x: 100, y: 200 },
    vel: { x: 0, y: 0 },
    size: PLAYER_BALL_SIZE,
    color: 'bg-red-500', // Should be white for cue ball, but keeping red for distinction
    isPlayer: true,
    // mass: 1, // Assuming equal mass for now
  },
  {
    id: 'target1',
    pos: { x: 450, y: 200 },
    vel: { x: 0, y: 0 },
    size: TARGET_BALL_SIZE,
    color: 'bg-blue-500',
    isPlayer: false,
    // mass: 1, // Assuming equal mass
  },
];

function SlingshotGame() {
  const containerRef = useRef(null);
  const playerBallRef = useRef(null);
  const animationFrameRef = useRef(null);

  const [balls, setBalls] = useState(initialBallsData);
  const [isDragging, setIsDragging] = useState(false);
  const [startDragPos, setStartDragPos] = useState({ x: 0, y: 0 });
  const [currentDragPos, setCurrentDragPos] = useState({ x: 0, y: 0 });

  const getPointerPosition = (e) => {
    if (e.touches && e.touches[0]) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  };

  const handleInteractionStart = useCallback((e) => {
    const playerBall = balls.find(b => b.isPlayer);
    if (!containerRef.current || !playerBallRef.current || !playerBall) return;

    let targetIsPlayer = false;
    if (e.type === 'touchstart') {
        if (playerBallRef.current.contains(e.target)) {
            e.preventDefault(); targetIsPlayer = true;
        }
    } else if (e.type === 'mousedown') {
        if (playerBallRef.current.contains(e.target)) {
             e.preventDefault(); targetIsPlayer = true;
        }
    }
    if (!targetIsPlayer) return;

    const pointerPos = getPointerPosition(e);
    setIsDragging(true); setStartDragPos(pointerPos); setCurrentDragPos(pointerPos);

    setBalls(prevBalls => prevBalls.map(ball => ball.isPlayer ? { ...ball, vel: { x: 0, y: 0 } } : ball));
    if (animationFrameRef.current) { cancelAnimationFrame(animationFrameRef.current); animationFrameRef.current = null; }
  }, [balls]);

  const handleInteractionMove = useCallback((e) => {
    if (!isDragging) return;
    if (e.type === 'touchmove') e.preventDefault();
    const pointerPos = getPointerPosition(e); setCurrentDragPos(pointerPos);
  }, [isDragging]);

  const handleInteractionEnd = useCallback(() => {
    if (!isDragging) return; setIsDragging(false);
    const playerBall = balls.find(b => b.isPlayer); if (!playerBall) return;

    const dx = startDragPos.x - currentDragPos.x; const dy = startDragPos.y - currentDragPos.y;
    let distance = Math.sqrt(dx * dx + dy * dy); distance = Math.min(distance, MAX_PULL_DISTANCE);

    if (distance < 5) {
        setBalls(prevBalls => prevBalls.map(ball => ball.isPlayer ? { ...ball, vel: { x: 0, y: 0 } } : ball)); return;
    }
    const angle = Math.atan2(dy, dx); const directionX = Math.cos(angle); const directionY = Math.sin(angle);
    const initialSpeed = distance * POWER_FACTOR;
    setBalls(prevBalls => prevBalls.map(ball => ball.isPlayer ? { ...ball, vel: { x: directionX * initialSpeed, y: directionY * initialSpeed } } : ball));
  }, [isDragging, startDragPos, currentDragPos, balls]);

  // --- Physics Update Effect ---
  useEffect(() => {
    const container = containerRef.current; if (!container) return;
    let isActive = false;

    const updatePhysics = () => {
       if (!animationFrameRef.current) return; isActive = false;

       setBalls(prevBalls => {
            const newBalls = JSON.parse(JSON.stringify(prevBalls)); // Deep copy to avoid mutation issues within loop
            const containerWidth = container.offsetWidth; const containerHeight = container.offsetHeight;
            const restitution = BALL_COLLISION_BOUNCE_FACTOR; // Use the constant

            // --- Ball-Ball Collision Detection & Response (POOL PHYSICS) ---
            for (let i = 0; i < newBalls.length; i++) {
                for (let j = i + 1; j < newBalls.length; j++) {
                    const ball1 = newBalls[i];
                    const ball2 = newBalls[j];
                    const radius1 = ball1.size / 2;
                    const radius2 = ball2.size / 2;

                    const dx = ball2.pos.x - ball1.pos.x;
                    const dy = ball2.pos.y - ball1.pos.y;
                    const distanceSq = dx * dx + dy * dy; // Use squared distance first
                    const minDistance = radius1 + radius2;
                    const minDistanceSq = minDistance * minDistance;

                    if (distanceSq < minDistanceSq && distanceSq > 0.001) { // Avoid division by zero if perfectly overlapping
                        const distance = Math.sqrt(distanceSq);
                        // 1. Resolve Overlap (Same as before)
                        const overlap = minDistance - distance;
                        const nx = dx / distance; // Normalized collision normal x
                        const ny = dy / distance; // Normalized collision normal y
                        ball1.pos.x -= nx * overlap * 0.5;
                        ball1.pos.y -= ny * overlap * 0.5;
                        ball2.pos.x += nx * overlap * 0.5;
                        ball2.pos.y += ny * overlap * 0.5;

                        // 2. Calculate Collision Response (Pool Physics - Equal Mass)
                        const tx = -ny; // Tangent vector x
                        const ty = nx;  // Tangent vector y

                        // Project velocities onto normal and tangent vectors
                        const v1n = ball1.vel.x * nx + ball1.vel.y * ny; // Ball 1 normal velocity scalar
                        const v1t = ball1.vel.x * tx + ball1.vel.y * ty; // Ball 1 tangent velocity scalar
                        const v2n = ball2.vel.x * nx + ball2.vel.y * ny; // Ball 2 normal velocity scalar
                        const v2t = ball2.vel.x * tx + ball2.vel.y * ty; // Ball 2 tangent velocity scalar

                        // Calculate new normal velocities after collision (incorporating restitution)
                        // Simplified formula for equal mass:
                        const new_v1n = (v1n * (1 - restitution) + 2 * restitution * v2n) / (1 + 1); // Using m1=m2=1
                        const new_v2n = (v2n * (1 - restitution) + 2 * restitution * v1n) / (1 + 1);
                        // Note: For *perfectly* elastic (restitution=1), this simplifies to new_v1n = v2n and new_v2n = v1n (they just swap normal velocities)


                        // Tangential velocities remain unchanged
                        const new_v1t = v1t;
                        const new_v2t = v2t;

                        // Convert scalar velocities back into vectors and update ball velocities
                        // Final velocity = (normal component vector) + (tangent component vector)
                        ball1.vel.x = (new_v1n * nx) + (new_v1t * tx);
                        ball1.vel.y = (new_v1n * ny) + (new_v1t * ty);
                        ball2.vel.x = (new_v2n * nx) + (new_v2t * tx);
                        ball2.vel.y = (new_v2n * ny) + (new_v2t * ty);
                    }
                }
            }

            // --- Update Position, Wall Collision, Damping for EACH ball (Same as before) ---
            for (let i = 0; i < newBalls.length; i++) {
                const ball = newBalls[i];
                const radius = ball.size / 2;
                ball.pos.x += ball.vel.x; ball.pos.y += ball.vel.y;

                // Wall collision
                if (ball.pos.x - radius < 0) { ball.pos.x = radius; ball.vel.x = -ball.vel.x * WALL_BOUNCE_FACTOR; }
                if (ball.pos.x + radius > containerWidth) { ball.pos.x = containerWidth - radius; ball.vel.x = -ball.vel.x * WALL_BOUNCE_FACTOR; }
                if (ball.pos.y - radius < 0) { ball.pos.y = radius; ball.vel.y = -ball.vel.y * WALL_BOUNCE_FACTOR; }
                if (ball.pos.y + radius > containerHeight) { ball.pos.y = containerHeight - radius; ball.vel.y = -ball.vel.y * WALL_BOUNCE_FACTOR; }

                // Damping
                ball.vel.x *= DAMPING_FACTOR; ball.vel.y *= DAMPING_FACTOR;

                // Check stop condition
                if (Math.abs(ball.vel.x) < MIN_VELOCITY_THRESHOLD && Math.abs(ball.vel.y) < MIN_VELOCITY_THRESHOLD) {
                    ball.vel.x = 0; ball.vel.y = 0;
                } else { isActive = true; }
            }
            return newBalls; // Return the updated array
       });

       // Request next frame ONLY if active
       if (isActive) { animationFrameRef.current = requestAnimationFrame(updatePhysics); }
       else { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); animationFrameRef.current = null; }
    };

    // Start/Stop loop logic (Same as before)
    const shouldStartLoop = balls.some(ball => ball.vel.x !== 0 || ball.vel.y !== 0);
    if (shouldStartLoop && !animationFrameRef.current) { animationFrameRef.current = requestAnimationFrame(updatePhysics); }
    else if (!shouldStartLoop && animationFrameRef.current) { cancelAnimationFrame(animationFrameRef.current); animationFrameRef.current = null; }

    return () => { if (animationFrameRef.current) { cancelAnimationFrame(animationFrameRef.current); animationFrameRef.current = null; }};
  }, [balls]); // Depend on the balls state array

   // Effect for global interaction listeners (mouse/touch move/end) - Same as before
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

  // --- Arrow Calculation (Same as before) ---
  const getArrowStyle = () => {
    const playerBall = balls.find(b => b.isPlayer); if (!isDragging || !playerBall || !containerRef.current) return { display: 'none' };
    const containerRect = containerRef.current.getBoundingClientRect();
    const startRelativeX = startDragPos.x - containerRect.left; const startRelativeY = startDragPos.y - containerRect.top;
    const currentRelativeX = currentDragPos.x - containerRect.left; const currentRelativeY = currentDragPos.y - containerRect.top;
    const launchVectorX = startRelativeX - currentRelativeX; const launchVectorY = startRelativeY - currentRelativeY;
    let pullDistance = Math.sqrt(launchVectorX * launchVectorX + launchVectorY * launchVectorY);
    const launchAngleRad = Math.atan2(launchVectorY, launchVectorX); const launchAngleDeg = launchAngleRad * (180 / Math.PI);
    const clampedDistance = Math.min(pullDistance, MAX_PULL_DISTANCE);
    if (clampedDistance < 5) return { display: 'none' };
    const arrowLength = clampedDistance; const arrowWidth = Math.min(ARROW_MAX_WIDTH, Math.max(2, clampedDistance / 15));
    return {
      position: 'absolute', left: `${playerBall.pos.x}px`, top: `${playerBall.pos.y}px`,
      transformOrigin: 'left center', transform: `translateY(-50%) rotate(${launchAngleDeg}deg)`,
      width: `${arrowLength}px`, height: `${arrowWidth}px`, backgroundColor: ARROW_COLOR,
      borderRadius: `${arrowWidth / 2}px`, pointerEvents: 'none', zIndex: ARROW_Z_INDEX,
    };
  };

  // --- Render (Same as before) ---
  return (
    <div className="flex justify-center items-center h-screen bg-gray-800">
      <div ref={containerRef} className="relative w-[600px] h-[400px] bg-gray-700 border-4 border-blue-400 rounded-lg overflow-hidden cursor-default" style={{ touchAction: 'none' }} >
        {balls.map(ball => (
          <div key={ball.id} ref={ball.isPlayer ? playerBallRef : null}
            className={`absolute ${ball.color} rounded-full select-none flex items-center justify-center text-white text-xs font-bold ${ball.isPlayer ? 'cursor-grab active:cursor-grabbing' : ''}`}
            style={{
              width: `${ball.size}px`, height: `${ball.size}px`, left: `${ball.pos.x}px`, top: `${ball.pos.y}px`,
              transform: 'translate(-50%, -50%)', touchAction: 'none', zIndex: BALL_Z_INDEX,
            }}
            onMouseDown={ball.isPlayer ? handleInteractionStart : undefined}
            onTouchStart={ball.isPlayer ? handleInteractionStart : undefined} >
            {ball.isPlayer ? 'DRAG' : ''}
          </div> ))}
        {isDragging && <div style={getArrowStyle()}></div>}
      </div>
    </div> );
}

export default SlingshotGame;